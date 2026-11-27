package de.baier.familyadmin.documents;

import de.baier.familyadmin.ai.OllamaService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
* Fills in embeddings for chunks that have none — e.g. after the switch to a new
* embedding model (V36). Works from the stored chunk_text, so no OCR or trip
* auto-linking is repeated. Runs batch by batch until nothing is left.
*/
@Slf4j
@Component
@RequiredArgsConstructor
public class EmbeddingBackfillScheduler {

    private static final int BATCH_SIZE = 50;

    private final OllamaService ollamaService;
    private final JdbcTemplate jdbcTemplate;

    @Scheduled(fixedDelay = 600_000, initialDelay = 120_000)
    public void backfillMissingEmbeddings() {
        Integer missing = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM document_chunks WHERE embedding IS NULL", Integer.class);
        if (missing == null || missing == 0) {
            return;
        }
        log.info("Embedding backfill: {} chunk(s) without embedding — starting", missing);

        int done = 0;
        int failed = 0;
        while (true) {
            List<Chunk> batch = jdbcTemplate.query(
                    "SELECT id, chunk_text FROM document_chunks WHERE embedding IS NULL ORDER BY created_at LIMIT ?",
                    (rs, i) -> new Chunk(UUID.fromString(rs.getString("id")), rs.getString("chunk_text")),
                    BATCH_SIZE);
            if (batch.isEmpty()) break;

            int failedInBatch = 0;
            for (Chunk chunk : batch) {
                try {
                    float[] embedding = ollamaService.embed(chunk.text());
                    jdbcTemplate.update(
                            "UPDATE document_chunks SET embedding = ?::vector WHERE id = ?::uuid",
                            toVectorString(embedding), chunk.id().toString());
                    done++;
                } catch (Exception e) {
                    failedInBatch++;
                    log.warn("Embedding backfill failed for chunk {}: {}", chunk.id(), e.getMessage());
                }
            }
            failed += failedInBatch;
            if (failedInBatch == batch.size()) {
                // Ollama unreachable or model missing — retry on the next run instead of spinning.
                log.warn("Embedding backfill: whole batch failed, pausing until next run");
                break;
            }
            if (done % 500 < BATCH_SIZE) {
                log.info("Embedding backfill progress: {}/{} chunk(s) embedded", done, missing);
            }
        }
        log.info("Embedding backfill finished: {} embedded, {} failed", done, failed);
    }

    private String toVectorString(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(embedding[i]);
        }
        return sb.append("]").toString();
    }

    private record Chunk(UUID id, String text) {}
}
