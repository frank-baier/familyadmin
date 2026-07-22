package de.baier.familyadmin.scheduler;

import de.baier.familyadmin.service.DocumentIndexingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Component
@RequiredArgsConstructor
public class DocumentIndexingScheduler {

    private final DocumentIndexingService documentIndexingService;
    private final JdbcTemplate jdbcTemplate;

    // Start 60s after boot, then every hour after the previous run completes.
    @Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000)
    public void indexPendingDocuments() {
        AtomicInteger total = new AtomicInteger();
        Integer pending = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM documents d WHERE NOT EXISTS (SELECT 1 FROM document_chunks dc WHERE dc.document_id = d.id)",
                Integer.class);

        if (pending == null || pending == 0) {
            log.debug("Document indexing scan: nothing to do");
            return;
        }

        log.info("Document indexing scan: {} unindexed document(s) found — starting", pending);

        // Stream rows one-by-one to avoid loading all BYTEA data into memory at once.
        jdbcTemplate.query(
                """
                SELECT d.id, d.data, d.content_type, d.filename,
                       d.category, d.subcategory, d.year, d.uploaded_by
                FROM documents d
                WHERE NOT EXISTS (
                    SELECT 1 FROM document_chunks dc WHERE dc.document_id = d.id
                )
                ORDER BY d.created_at ASC
                """,
                rs -> {
                    UUID id         = UUID.fromString(rs.getString("id"));
                    byte[] data     = rs.getBytes("data");
                    String type     = rs.getString("content_type");
                    String name     = rs.getString("filename");
                    String cat      = rs.getString("category");
                    String sub      = rs.getString("subcategory");
                    Integer year    = rs.getObject("year", Integer.class);
                    String upStr    = rs.getString("uploaded_by");
                    UUID uploader   = upStr != null ? UUID.fromString(upStr) : null;

                    documentIndexingService.doIndex(id, data, type, name, cat, sub, year, uploader);
                    total.incrementAndGet();
                }
        );

        log.info("Document indexing scan complete: {} document(s) processed", total.get());
    }
}
