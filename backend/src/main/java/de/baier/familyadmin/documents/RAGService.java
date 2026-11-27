package de.baier.familyadmin.documents;

import de.baier.familyadmin.ai.AnthropicChatService;
import de.baier.familyadmin.ai.AnthropicCreditAlertService;
import de.baier.familyadmin.ai.OllamaService;

import de.baier.familyadmin.ai.AnthropicChatService.Turn;
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

    /** How many earlier turns of a session are passed to the model. */
    static final int MAX_HISTORY_TURNS = 6;

    private static final String CONDENSE_PROMPT = """
            Du formulierst Folgefragen aus einem Gespräch über Familiendokumente in eine eigenständige
            Suchfrage um. Ersetze Pronomen und Bezüge ("das", "dort", "davor") durch die gemeinten Dinge
            aus dem Verlauf. Antworte nur mit der umformulierten Frage auf Deutsch, ohne Erklärung.
            Ist die Frage schon eigenständig, gib sie unverändert zurück.""";

    private final OllamaService ollamaService;
    private final AnthropicChatService anthropicChatService;
    private final AnthropicCreditAlertService creditAlertService;
    private final JdbcTemplate jdbcTemplate;

    /** "anthropic" (Claude via API, falls back to Ollama on errors) or "ollama" (local only). */
    @Value("${rag.llm-provider:anthropic}")
    private String llmProvider;

    public ChatResponse query(String question) {
        return query(question, List.of(), partial -> {});
    }

    /**
     * @param history earlier turns of the same chat session, oldest first (may be empty)
     */
    public ChatResponse query(String question, List<Turn> history, Consumer<String> onPartial) {
        long start = System.currentTimeMillis();
        List<Turn> recent = history.size() > MAX_HISTORY_TURNS
                ? history.subList(history.size() - MAX_HISTORY_TURNS, history.size())
                : history;

        Generation searchQuery = recent.isEmpty()
                ? new Generation(question, null, BigDecimal.ZERO)
                : condense(question, recent);
        List<ChunkResult> chunks = retrieve(searchQuery.text());

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

        log.debug("RAG query: '{}' (search: '{}') — {} chunks from {} sources", question, searchQuery.text(),
                chunks.size(), chunks.stream().map(ChunkResult::filename).distinct().count());

        Generation generation = generate(system, recent, userMessage, onPartial);

        List<String> sources = chunks.stream()
                .map(ChunkResult::filename)
                .distinct()
                .toList();

        return new ChatResponse(generation.text().strip(), sources, generation.model(),
                generation.costUsd().add(searchQuery.costUsd()), System.currentTimeMillis() - start);
    }

    record Generation(String text, String model, BigDecimal costUsd) {}

    /**
     * Turns a follow-up ("und wann war das?") into a standalone search query so retrieval
     * finds the right documents. Without Claude, the previous question is prepended instead.
     */
    Generation condense(String question, List<Turn> history) {
        String fallback = history.get(history.size() - 1).question() + " " + question;
        if (!useClaude()) return new Generation(fallback, null, BigDecimal.ZERO);
        try {
            String transcript = history.stream()
                    .map(t -> "Frage: " + t.question() + "\nAntwort: " + t.answer())
                    .collect(Collectors.joining("\n\n"));
            var result = anthropicChatService.complete(CONDENSE_PROMPT,
                    "Gesprächsverlauf:\n" + transcript + "\n\nFolgefrage: " + question);
            return new Generation(result.text(), anthropicChatService.model(), result.costUsd());
        } catch (Exception e) {
            log.warn("Rephrasing follow-up failed, using concatenation: {}", e.getMessage());
            if (AnthropicCreditAlertService.isCreditExhausted(e)) {
                creditAlertService.notifyCreditExhausted("Dokumenten-Chat");
            }
            return new Generation(fallback, null, BigDecimal.ZERO);
        }
    }

    Generation generate(String system, List<Turn> history, String userMessage, Consumer<String> onPartial) {
        boolean creditExhausted = false;
        if (useClaude()) {
            try {
                var result = anthropicChatService.generateStreaming(system, history, userMessage, onPartial);
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
        StringBuilder prompt = new StringBuilder(system).append("\n\n");
        if (!history.isEmpty()) {
            prompt.append("Bisheriger Gesprächsverlauf:\n");
            history.forEach(t -> prompt.append("Frage: ").append(t.question())
                    .append("\nAntwort: ").append(t.answer()).append("\n\n"));
        }
        prompt.append(userMessage).append("\nAntwort:");
        String text = ollamaService.generateStreaming(prompt.toString(), TEMPERATURE, onPartial);
        if (creditExhausted) text = text.strip() + CREDIT_HINT;
        return new Generation(text, "ollama:" + ollamaService.chatModel(), BigDecimal.ZERO);
    }

    private boolean useClaude() {
        return "anthropic".equalsIgnoreCase(llmProvider) && anthropicChatService.isConfigured();
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
