package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.ChatResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RAGService {

    private static final int CANDIDATES_PER_RETRIEVER = 20;
    private static final int CONTEXT_CHUNKS = 10;
    private static final double TEMPERATURE = 0.1;

    static final String NOT_FOUND = "Dazu habe ich in deinen Dokumenten nichts gefunden.";

    private static final String SYSTEM_PROMPT = """
            Du bist ein sorgfältiger Assistent, der Fragen zu den persönlichen Dokumenten einer Familie beantwortet.

            Regeln:
            - Antworte ausschließlich anhand der Dokumentauszüge in der Nachricht. Nutze kein Vorwissen.
            - Steht die Antwort nicht in den Auszügen, antworte genau: "%s"
            - Übernimm Daten, Beträge, Nummern und Namen exakt so, wie sie im Dokument stehen.
            - Nenne bei jeder Angabe in Klammern den Dateinamen, aus dem sie stammt.
            - Antworte kurz und auf Deutsch.""";

    static final String CREDIT_HINT =
            "\n\n(Hinweis: Das Anthropic-Guthaben ist aufgebraucht – diese Antwort stammt vom lokalen Modell.)";

    private final OllamaService ollamaService;
    private final AnthropicChatService anthropicChatService;
    private final AnthropicCreditAlertService creditAlertService;
    private final JdbcTemplate jdbcTemplate;

    /** "anthropic" (Claude via API, falls back to Ollama on errors) or "ollama" (local only). */
    @Value("${rag.llm-provider:anthropic}")
    private String llmProvider;

    public ChatResponse query(String question) {
        return query(question, partial -> {});
    }

    public ChatResponse query(String question, Consumer<String> onPartial) {
        long start = System.currentTimeMillis();
        List<ChunkResult> chunks = retrieve(question);

        if (chunks.isEmpty()) {
            return new ChatResponse(
                    "Es sind noch keine Dokumente indexiert. Bitte lade zuerst Dokumente hoch.",
                    List.of());
        }

        String context = chunks.stream()
                .map(ChunkResult::asContext)
                .collect(Collectors.joining("\n\n---\n\n"));

        String system = SYSTEM_PROMPT.formatted(NOT_FOUND);
        String userMessage = """
                Dokumentauszüge:

                %s

                Frage: %s""".formatted(context, question);

        log.debug("RAG query: '{}' — {} chunks from {} sources", question, chunks.size(),
                chunks.stream().map(ChunkResult::filename).distinct().count());

        Generation generation = generate(system, userMessage, onPartial);

        List<String> sources = chunks.stream()
                .map(ChunkResult::filename)
                .distinct()
                .toList();

        return new ChatResponse(generation.text().strip(), sources, generation.model(),
                generation.costUsd(), System.currentTimeMillis() - start);
    }

    record Generation(String text, String model, BigDecimal costUsd) {}

    Generation generate(String system, String userMessage, Consumer<String> onPartial) {
        boolean creditExhausted = false;
        if ("anthropic".equalsIgnoreCase(llmProvider) && anthropicChatService.isConfigured()) {
            try {
                var result = anthropicChatService.generateStreaming(system, userMessage, onPartial);
                return new Generation(result.text(), anthropicChatService.model(), result.costUsd());
            } catch (Exception e) {
                // onPartial always receives the full text so far, so a restart on Ollama
                // simply replaces whatever partial answer was shown.
                log.warn("Claude ({}) failed, falling back to Ollama: {}",
                        anthropicChatService.model(), e.getMessage());
                if (AnthropicCreditAlertService.isCreditExhausted(e)) {
                    creditExhausted = true;
                    creditAlertService.notifyCreditExhausted("Dokumenten-Chat");
                }
            }
        }
        String prompt = system + "\n\n" + userMessage + "\nAntwort:";
        String text = ollamaService.generateStreaming(prompt, TEMPERATURE, onPartial);
        if (creditExhausted) text = text.strip() + CREDIT_HINT;
        return new Generation(text, "ollama:" + ollamaService.chatModel(), BigDecimal.ZERO);
    }

    /**
     * Hybrid retrieval: semantic vector search (finds paraphrases) plus German full-text
     * search (finds exact terms such as invoice numbers, names, amounts), merged with
     * Reciprocal Rank Fusion. Chunks still waiting for re-embedding are found via full text.
     */
    private List<ChunkResult> retrieve(String question) {
        String vectorStr = toVectorString(ollamaService.embed(question));

        return jdbcTemplate.query(
                """
                WITH q AS (
                    SELECT to_tsquery('german',
                             replace(plainto_tsquery('german', ?)::text, ' & ', ' | ')) AS tsq
                ),
                vec AS (
                    SELECT id, row_number() OVER (ORDER BY dist) AS rnk
                    FROM (
                        SELECT id, embedding <=> ?::vector AS dist
                        FROM document_chunks
                        WHERE embedding IS NOT NULL
                        ORDER BY dist
                        LIMIT ?
                    ) v
                ),
                kw AS (
                    SELECT id, row_number() OVER (ORDER BY rank DESC) AS rnk
                    FROM (
                        SELECT dc.id, ts_rank_cd(dc.search_tsv, q.tsq) AS rank
                        FROM document_chunks dc, q
                        WHERE dc.search_tsv @@ q.tsq
                        ORDER BY rank DESC
                        LIMIT ?
                    ) k
                ),
                fused AS (
                    SELECT id, SUM(1.0 / (60 + rnk)) AS score
                    FROM (SELECT * FROM vec UNION ALL SELECT * FROM kw) u
                    GROUP BY id
                )
                SELECT dc.chunk_text, d.filename, d.category, d.subcategory, d.year
                FROM fused f
                JOIN document_chunks dc ON dc.id = f.id
                JOIN documents d ON d.id = dc.document_id
                ORDER BY f.score DESC
                LIMIT ?
                """,
                (rs, rowNum) -> new ChunkResult(
                        rs.getString("chunk_text"),
                        rs.getString("filename"),
                        rs.getString("category"),
                        rs.getString("subcategory"),
                        rs.getObject("year", Integer.class)),
                question, vectorStr, CANDIDATES_PER_RETRIEVER, CANDIDATES_PER_RETRIEVER, CONTEXT_CHUNKS);
    }

    private String toVectorString(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(embedding[i]);
        }
        return sb.append("]").toString();
    }

    private record ChunkResult(String chunkText, String filename, String category,
                               String subcategory, Integer year) {
        String asContext() {
            StringBuilder header = new StringBuilder("[Datei: ").append(filename);
            if (category != null && !category.isBlank()) {
                header.append(" | Kategorie: ").append(category);
                if (subcategory != null && !subcategory.isBlank()) header.append(" / ").append(subcategory);
            }
            if (year != null) header.append(" | Jahr: ").append(year);
            return header.append("]\n").append(chunkText).toString();
        }
    }
}
