package de.baier.familyadmin.documents;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.Semaphore;

/**
 * Runs the Claude analysis for scan inbox items in the background, one at a time so a
 * batch of scans reuses the cached folder catalogue and stays within rate limits.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ScanInboxAnalyzer {

    private static final Semaphore ONE_AT_A_TIME = new Semaphore(1);

    private final ScanInboxService service;
    private final ScanFilingSuggestionService suggestionService;
    private final ScanCatalogSelector catalogSelector;
    private final DocumentIndexingService indexingService;

    @Async
    public void analyzeAsync(UUID id) {
        analyze(id);
    }

    void analyze(UUID id) {
        try {
            ONE_AT_A_TIME.acquire();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        }
        try {
            var input = service.analysisInput(id);
            if (input.isEmpty()) return;
            var in = input.get();
            try {
                service.saveSuggestion(id, suggest(in.sourceName(), in.contentType(), in.data(), in.hint(),
                        in.mailContext(), in.catalog(), in.ownerId()));
            } catch (Exception e) {
                log.warn("Scan analysis failed for '{}': {}", in.sourceName(), e.getMessage());
                service.saveAnalysisError(id, "Analyse fehlgeschlagen: " + e.getMessage());
            }
        } finally {
            ONE_AT_A_TIME.release();
        }
    }

    /**
     * Sends Claude only the folders that fit this document. They are chosen by the text
     * layer, or by local OCR (Tesseract) when there is none; Claude itself still reads
     * the original scan.
     */
    ScanFilingSuggestionService.Suggestion suggest(String sourceName, String contentType, byte[] data, String hint,
                                                   String mailContext, java.util.List<ScanInboxDtos.CatalogFolder> catalog,
                                                   UUID ownerId) {
        return suggest(sourceName, contentType, data, hint, mailContext, catalog, ownerId, null);
    }

    ScanFilingSuggestionService.Suggestion suggest(String sourceName, String contentType, byte[] data, String hint,
                                                   String mailContext, java.util.List<ScanInboxDtos.CatalogFolder> catalog,
                                                   UUID ownerId, String modelOverride) {
        String text = "application/pdf".equalsIgnoreCase(contentType) || sourceName.toLowerCase().endsWith(".pdf")
                ? ScanFilingSuggestionService.pdfText(data) : "";
        if (ScanFilingSuggestionService.nonBlankLength(text) < ScanFilingSuggestionService.MIN_TEXT_CHARS) {
            try {
                text = indexingService.extractText(data, sourceName);
            } catch (Exception e) {
                log.debug("Local OCR for folder choice failed: {}", e.getMessage());
            }
        }
        String context = String.join("\n", sourceName, hint == null ? "" : hint,
                mailContext == null ? "" : mailContext, text == null ? "" : text);
        var folders = catalogSelector.select(catalog, context, ownerId);
        return suggestionService.suggest(sourceName, contentType, data, folders, hint, mailContext, modelOverride);
    }

    /** Picks up analyses lost by a restart. */
    @Scheduled(fixedDelay = 15 * 60 * 1000L, initialDelay = 2 * 60 * 1000L)
    void resumeStuck() {
        for (UUID id : service.stuckAnalyses(Instant.now().minus(Duration.ofMinutes(15)))) {
            analyze(id);
        }
    }
}
