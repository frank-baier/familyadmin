package de.baier.familyadmin.service;

import de.baier.familyadmin.model.Role;
import de.baier.familyadmin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.Parser;
import org.apache.tika.parser.ocr.TesseractOCRConfig;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentIndexingService {

    private final OllamaService ollamaService;
    private final JdbcTemplate jdbcTemplate;
    private final TripAutoLinkerService tripAutoLinkerService;
    private final UserRepository userRepository;

    private static final int CHUNK_SIZE = 2000;
    private static final int OVERLAP = 200;

    @Async
    public void indexAsync(UUID documentId, byte[] data, String contentType, String filename,
                           String category, String subcategory, Integer year, UUID uploaderId) {
        doIndex(documentId, data, contentType, filename, category, subcategory, year, uploaderId);
    }

    public void doIndex(UUID documentId, byte[] data, String contentType, String filename,
                        String category, String subcategory, Integer year, UUID uploaderId) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM document_chunks WHERE document_id = ?::uuid",
                    Integer.class, documentId.toString());
            if (count != null && count > 0) {
                log.debug("Document {} already indexed, skipping", filename);
                return;
            }

            String text = extractText(data, filename);
            if (text.isBlank()) {
                log.warn("No text extracted from {} — may be a scanned/image-only document", filename);
            } else {
                List<String> chunks = chunk(text);
                log.info("Indexing '{}' → {} chunks", filename, chunks.size());
                for (int i = 0; i < chunks.size(); i++) {
                    float[] embedding = ollamaService.embed(chunks.get(i));
                    jdbcTemplate.update(
                            "INSERT INTO document_chunks (document_id, chunk_index, chunk_text, embedding) VALUES (?::uuid, ?, ?, ?::vector)",
                            documentId.toString(), i, chunks.get(i), toVectorString(embedding));
                }
                log.info("Finished indexing '{}' ({} chunks)", filename, chunks.size());
            }

            if ("Reisen".equalsIgnoreCase(category)) {
                UUID effectiveUploader = uploaderId;
                if (effectiveUploader == null) {
                    effectiveUploader = userRepository.findByRole(Role.ADMIN).stream()
                            .findFirst().map(u -> u.getId()).orElse(null);
                }
                if (effectiveUploader != null) {
                    var analysis = tripAutoLinkerService.analyzeDocument(text, subcategory);
                    tripAutoLinkerService.autoLink(documentId, analysis, subcategory, year, effectiveUploader);
                }
            }

        } catch (Exception e) {
            log.error("Failed to index document '{}': {}", filename, e.getMessage(), e);
        }
    }

    private String extractText(byte[] data, String filename) {
        try {
            TesseractOCRConfig ocrConfig = new TesseractOCRConfig();
            ocrConfig.setLanguage("deu+eng");
            ocrConfig.setTimeoutSeconds(120);

            AutoDetectParser parser = new AutoDetectParser();
            ParseContext context = new ParseContext();
            context.set(TesseractOCRConfig.class, ocrConfig);
            context.set(Parser.class, parser);

            BodyContentHandler handler = new BodyContentHandler(500_000);
            parser.parse(new ByteArrayInputStream(data), handler, new Metadata(), context);
            return handler.toString();
        } catch (Exception e) {
            log.warn("Text extraction failed for '{}': {}", filename, e.getMessage());
            return "";
        }
    }

    private List<String> chunk(String text) {
        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < text.length()) {
            int end = Math.min(start + CHUNK_SIZE, text.length());
            String chunk = text.substring(start, end).strip();
            if (!chunk.isBlank()) {
                chunks.add(chunk);
            }
            if (end == text.length()) break;
            start += CHUNK_SIZE - OVERLAP;
        }
        return chunks;
    }

    private String toVectorString(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(embedding[i]);
        }
        return sb.append("]").toString();
    }
}
