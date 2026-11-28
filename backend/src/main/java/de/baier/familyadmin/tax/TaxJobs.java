package de.baier.familyadmin.tax;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.Semaphore;

/**
 * Background AI jobs of the tax assistant. The caller marks the job as running
 * ({@link TaxService#startJob}) before; every job ends in IDLE or ERROR.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TaxJobs {

    static final int HINT_BATCH = 15;
    /** One Claude call at a time keeps us far away from rate limits. */
    private static final Semaphore ONE_AT_A_TIME = new Semaphore(1);

    private final TaxService service;
    private final TaxAiService ai;

    @Async
    public void checklistAsync(UUID ownerId, int year) {
        runChecklist(ownerId, year);
    }

    void runChecklist(UUID ownerId, int year) {
        try {
            var ctx = service.checklistContext(ownerId, year);
            var result = withPermit(() -> ai.checklist(ctx.input()));
            service.saveChecklist(ownerId, year, ctx, result);
        } catch (Exception e) {
            log.warn("Tax checklist {} failed: {}", year, e.getMessage());
            service.failJob(ownerId, year, TaxService.Job.CHECKLIST, "Abgleich fehlgeschlagen: " + e.getMessage());
        }
    }

    @Async
    public void hintsAsync(UUID ownerId, int year) {
        try {
            List<TaxAiService.Candidate> candidates = service.candidates(ownerId, year);
            List<String> current = service.listing(ownerId, year).files().stream()
                    .map(f -> TaxRubrics.fileName(f.path())).sorted().toList();
            log.info("Tax hints {}: checking {} documents", year, candidates.size());
            for (int i = 0; i < candidates.size(); i += HINT_BATCH) {
                var batch = candidates.subList(i, Math.min(candidates.size(), i + HINT_BATCH));
                var result = withPermit(() -> ai.classify(year, current, batch));
                service.saveVerdicts(ownerId, year, result);
            }
            service.finishHints(ownerId, year);
        } catch (Exception e) {
            log.warn("Tax hints {} failed: {}", year, e.getMessage());
            service.failJob(ownerId, year, TaxService.Job.HINTS, "Suche fehlgeschlagen: " + e.getMessage());
        }
    }

    /**
     * Reads the return of {@code year - 1}; afterwards the checklist of {@code year} is
     * rebuilt with it (if no comparison is running already).
     */
    @Async
    public void returnAsync(UUID ownerId, int year, String filename, String contentType, byte[] data) {
        try {
            var result = withPermit(() -> ai.readReturn(year - 1, filename, contentType, data));
            service.saveReturn(ownerId, year, filename, result);
        } catch (Exception e) {
            log.warn("Tax return import {} failed: {}", year - 1, e.getMessage());
            service.failJob(ownerId, year, TaxService.Job.RETURN, "Import fehlgeschlagen: " + e.getMessage());
            return;
        }
        try {
            service.startJob(ownerId, year, TaxService.Job.CHECKLIST);
        } catch (Exception alreadyRunning) {
            return;
        }
        runChecklist(ownerId, year);
    }

    private interface Call<T> {
        T run() throws Exception;
    }

    private static <T> T withPermit(Call<T> call) throws Exception {
        ONE_AT_A_TIME.acquire();
        try {
            return call.run();
        } finally {
            ONE_AT_A_TIME.release();
        }
    }
}
