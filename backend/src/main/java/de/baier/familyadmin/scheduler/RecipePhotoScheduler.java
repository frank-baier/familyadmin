package de.baier.familyadmin.scheduler;

import de.baier.familyadmin.model.Recipe;
import de.baier.familyadmin.repository.RecipeRepository;
import de.baier.familyadmin.service.RecipePhotoFetchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class RecipePhotoScheduler {

    private final RecipeRepository        recipeRepository;
    private final RecipePhotoFetchService fetchService;

    @Value("${app.recipe.photo.auto-fetch-enabled:true}")
    private boolean autoFetchEnabled;

    // Unsplash demo tier: 50 API requests/hour. Capping well below that.
    @Value("${app.recipe.photo.max-per-run:40}")
    private int maxPerRun;

    @Scheduled(cron = "0 0 3 * * *")
    public void scheduledFetch() {
        if (!autoFetchEnabled) {
            log.info("Recipe photo auto-fetch is disabled — skipping");
            return;
        }
        log.info("Starting scheduled recipe photo fetch (max {} per run)", maxPerRun);
        runFetchJob();
    }

    /**
     * Runs the fetch job synchronously. Extracted so the admin endpoint can call it
     * on demand and return the result without duplicating the loop.
     */
    public FetchResult runFetchJob() {
        List<Recipe> recipes = recipeRepository.findByPhotoDataIsNull();
        log.info("Found {} recipe(s) without a photo", recipes.size());

        int updated   = 0;
        int failed    = 0;
        int processed = 0;

        for (Recipe recipe : recipes) {
            if (processed >= maxPerRun) {
                log.info("Reached max-per-run limit ({}) — {} recipe(s) queued for the next run",
                        maxPerRun, recipes.size() - processed);
                break;
            }

            boolean success = fetchService.fetchAndSave(recipe);
            if (success) updated++; else failed++;
            processed++;

            // 2s pause between Unsplash API calls — keeps throughput at ~30 req/min,
            // far below the 50 req/hour demo limit even if maxPerRun is increased.
            if (processed < maxPerRun && processed < recipes.size()) {
                try {
                    Thread.sleep(2_000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    log.warn("Recipe photo fetch interrupted after {} processed", processed);
                    break;
                }
            }
        }

        log.info("Recipe photo fetch complete: {} updated, {} failed", updated, failed);
        return new FetchResult(updated, failed);
    }

    public record FetchResult(int updated, int failed) {}
}
