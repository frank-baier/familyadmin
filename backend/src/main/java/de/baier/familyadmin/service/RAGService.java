package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.ChatResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RAGService {

    private final OllamaService ollamaService;
    private final JdbcTemplate jdbcTemplate;

    public ChatResponse query(String question) {
        float[] queryEmbedding = ollamaService.embed(question);
        String vectorStr = toVectorString(queryEmbedding);

        List<ChunkResult> chunks = jdbcTemplate.query(
                """
                SELECT dc.chunk_text, d.filename
                FROM document_chunks dc
                JOIN documents d ON d.id = dc.document_id
                ORDER BY dc.embedding <=> ?::vector
                LIMIT 5
                """,
                (rs, rowNum) -> new ChunkResult(rs.getString("chunk_text"), rs.getString("filename")),
                vectorStr);

        if (chunks.isEmpty()) {
            return new ChatResponse(
                    "No documents have been indexed yet. Please upload some documents first.",
                    List.of());
        }

        String context = chunks.stream()
                .map(c -> "[" + c.filename() + "]\n" + c.chunkText())
                .collect(Collectors.joining("\n\n"));

        String prompt = """
                You are a helpful assistant answering questions about personal family documents.
                Answer based ONLY on the document excerpts provided below.
                If the answer is not in the documents, say exactly: "I could not find this information in the available documents."
                Be concise and precise. For dates, amounts, and names, be exact.

                Documents:
                %s

                Question: %s
                Answer:""".formatted(context, question);

        log.debug("RAG query: '{}' — {} chunks from {} sources", question, chunks.size(),
                chunks.stream().map(ChunkResult::filename).distinct().count());

        String answer = ollamaService.generate(prompt);

        List<String> sources = chunks.stream()
                .map(ChunkResult::filename)
                .distinct()
                .toList();

        return new ChatResponse(answer.strip(), sources);
    }

    private String toVectorString(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(embedding[i]);
        }
        return sb.append("]").toString();
    }

    private record ChunkResult(String chunkText, String filename) {}
}
