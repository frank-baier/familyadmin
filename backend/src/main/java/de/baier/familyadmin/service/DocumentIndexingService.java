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
import org.apache.tika.parser.pdf.PDFParserConfig;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

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
        String text = extractTextViaTika(data, filename);
        if (!text.isBlank()) return text;

        // PDFBox cannot render image-only PDFs on Alpine (no AWT graphics).
        // Fall back to pdftoppm (Poppler) + Tesseract directly.
        if (filename.toLowerCase().endsWith(".pdf")) {
            try {
                text = extractTextPdfOcr(data, filename);
            } catch (Exception e) {
                log.warn("pdftoppm OCR fallback failed for '{}': {}", filename, e.getMessage());
            }
        }
        return text;
    }

    private String extractTextViaTika(byte[] data, String filename) {
        try {
            TesseractOCRConfig ocrConfig = new TesseractOCRConfig();
            ocrConfig.setLanguage("deu+eng");
            ocrConfig.setTimeoutSeconds(30);

            PDFParserConfig pdfConfig = new PDFParserConfig();
            pdfConfig.setExtractInlineImages(true);
            pdfConfig.setOcrStrategy(PDFParserConfig.OCR_STRATEGY.AUTO);

            AutoDetectParser parser = new AutoDetectParser();
            ParseContext context = new ParseContext();
            context.set(TesseractOCRConfig.class, ocrConfig);
            context.set(PDFParserConfig.class, pdfConfig);
            context.set(Parser.class, parser);

            BodyContentHandler handler = new BodyContentHandler(2_000_000);
            parser.parse(new ByteArrayInputStream(data), handler, new Metadata(), context);
            return handler.toString();
        } catch (Exception e) {
            log.warn("Text extraction failed for '{}': {}", filename, e.getMessage());
            return "";
        }
    }

    private String extractTextPdfOcr(byte[] data, String filename) throws Exception {
        Path tmpPdf = Files.createTempFile("ocr_", ".pdf");
        Path tmpDir = Files.createTempDirectory("ocr_pages_");
        try {
            Files.write(tmpPdf, data);

            // Render PDF pages to PNG images via pdftoppm
            Process pdfProc = new ProcessBuilder(
                    "pdftoppm", "-png", "-r", "150",
                    tmpPdf.toString(), tmpDir.resolve("page").toString())
                    .redirectErrorStream(true).start();
            if (!pdfProc.waitFor(60, TimeUnit.SECONDS)) {
                pdfProc.destroyForcibly();
                return "";
            }

            // Run Tesseract on each page image
            File[] pages = tmpDir.toFile().listFiles((d, n) -> n.endsWith(".png"));
            if (pages == null || pages.length == 0) return "";
            Arrays.sort(pages, Comparator.comparing(File::getName));

            StringBuilder fullText = new StringBuilder();
            for (File page : pages) {
                Path outBase = tmpDir.resolve("out_" + page.getName());
                Process ocrProc = new ProcessBuilder(
                        "tesseract", page.getAbsolutePath(), outBase.toString(), "-l", "deu+eng")
                        .redirectErrorStream(true).start();
                if (!ocrProc.waitFor(120, TimeUnit.SECONDS)) {
                    ocrProc.destroyForcibly();
                    continue;
                }
                Path outTxt = Path.of(outBase + ".txt");
                if (Files.exists(outTxt)) {
                    fullText.append(Files.readString(outTxt)).append("\n");
                }
            }
            String result = fullText.toString().strip();
            if (!result.isBlank()) {
                log.info("pdftoppm OCR extracted {} chars from '{}'", result.length(), filename);
            }
            return result;
        } finally {
            Files.deleteIfExists(tmpPdf);
            try (Stream<Path> files = Files.walk(tmpDir)) {
                files.sorted(Comparator.reverseOrder()).forEach(p -> {
                    try { Files.deleteIfExists(p); } catch (Exception ignored) {}
                });
            }
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
