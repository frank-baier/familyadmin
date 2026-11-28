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
                service.saveSuggestion(id, suggestionService.suggest(
                        in.sourceName(), in.contentType(), in.data(), in.catalog(), in.hint(), in.mailContext()));
            } catch (Exception e) {
                log.warn("Scan analysis failed for '{}': {}", in.sourceName(), e.getMessage());
                service.saveAnalysisError(id, "Analyse fehlgeschlagen: " + e.getMessage());
            }
        } finally {
            ONE_AT_A_TIME.release();
        }
    }

    /** Picks up analyses lost by a restart. */
    @Scheduled(fixedDelay = 15 * 60 * 1000L, initialDelay = 2 * 60 * 1000L)
    void resumeStuck() {
        for (UUID id : service.stuckAnalyses(Instant.now().minus(Duration.ofMinutes(15)))) {
            analyze(id);
        }
    }
}
