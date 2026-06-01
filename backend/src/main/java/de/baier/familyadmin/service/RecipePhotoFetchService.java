package de.baier.familyadmin.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.model.Recipe;
import de.baier.familyadmin.repository.RecipeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.coobird.thumbnailator.Thumbnails;
import org.jsoup.Jsoup;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecipePhotoFetchService {

    private static final String  UNSPLASH_BASE          = "https://api.unsplash.com";
    private static final String  CHEFKOCH_SEARCH        = "https://www.chefkoch.de/suche.php?suche=";
    private static final String  CHEFKOCH_BASE          = "https://www.chefkoch.de";
    private static final Pattern CHEFKOCH_RECIPE_HREF   = Pattern.compile("/rezepte/\\d+/");

    private final RecipeRepository       recipeRepository;
    private final ObjectMapper           objectMapper;
    private final RecipeUrlImportService recipeUrlImportService;

    @Value("${app.recipe.photo.unsplash-access-key:}")
    private String unsplashAccessKey;

    // Plain client for Unsplash API + CDN downloads
    private final RestClient restClient = RestClient.builder().build();

    // Browser-like client for Chefkoch (bot detection avoidance)
    private final RestClient browserClient = RestClient.builder()
            .defaultHeader("User-Agent",
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .defaultHeader("Accept-Language", "de-DE,de;q=0.9,en;q=0.8")
            .build();

    /**
     * Tries Chefkoch first (no API key, food-specific results), then Unsplash as fallback.
     * Never throws — returns false on any failure so callers can continue.
     */
    public boolean fetchAndSave(Recipe recipe) {
        // 1. Chefkoch — no key required, results are directly food-relevant
        try {
            if (fetchFromChefkoch(recipe)) return true;
        } catch (Exception e) {
            log.debug("Chefkoch photo fetch failed for '{}': {}", recipe.getTitle(), e.getMessage());
        }

        // 2. Unsplash fallback
        if (!StringUtils.hasText(unsplashAccessKey)) {
            log.warn("No photo found via Chefkoch and Unsplash key not configured — skipping '{}'",
                    recipe.getTitle());
            return false;
        }
        try {
            return fetchFromUnsplash(recipe);
        } catch (Exception e) {
            log.warn("Failed to auto-fetch photo for recipe '{}': {}", recipe.getTitle(), e.getMessage());
            return false;
        }
    }

    // ─── Chefkoch ────────────────────────────────────────────────────────────

    private boolean fetchFromChefkoch(Recipe recipe) throws IOException {
        String encoded = URLEncoder.encode(recipe.getTitle(), StandardCharsets.UTF_8);
        String searchHtml = browserClient.get()
                .uri(CHEFKOCH_SEARCH + encoded)
                .retrieve()
                .body(String.class);
        if (searchHtml == null) return false;

        // Find the first /rezepte/{id}/ link in the search results
        String recipePageUrl = null;
        for (org.jsoup.nodes.Element link : Jsoup.parse(searchHtml).select("a[href]")) {
            String href = link.attr("href");
            if (CHEFKOCH_RECIPE_HREF.matcher(href).find()) {
                recipePageUrl = href.startsWith("http") ? href : CHEFKOCH_BASE + href;
                break;
            }
        }
        if (recipePageUrl == null) {
            log.debug("No Chefkoch result for '{}'", recipe.getTitle());
            return false;
        }

        String imageUrl = recipeUrlImportService.extractPhotoUrl(recipePageUrl);
        if (!StringUtils.hasText(imageUrl)) {
            log.debug("No image on Chefkoch result page for '{}'", recipe.getTitle());
            return false;
        }

        return downloadCompressAndSave(recipe, imageUrl);
    }

    // ─── Unsplash ─────────────────────────────────────────────────────────────

    private boolean fetchFromUnsplash(Recipe recipe) throws IOException {
        URI searchUri = UriComponentsBuilder
                .fromUriString(UNSPLASH_BASE + "/search/photos")
                .queryParam("query",     buildQuery(recipe))
                .queryParam("per_page",  1)
                .queryParam("client_id", unsplashAccessKey)
                .build()
                .toUri();

        String responseBody = restClient.get().uri(searchUri).retrieve().body(String.class);
        UnsplashSearchResponse resp = objectMapper.readValue(responseBody, UnsplashSearchResponse.class);

        if (resp.results() == null || resp.results().isEmpty()) {
            log.warn("No Unsplash results for recipe '{}'", recipe.getTitle());
            return false;
        }
        String imageUrl = resp.results().get(0).urls().small();
        if (!StringUtils.hasText(imageUrl)) {
            log.warn("Unsplash result has no image URL for recipe '{}'", recipe.getTitle());
            return false;
        }
        return downloadCompressAndSave(recipe, imageUrl);
    }

    // ─── Shared helpers ───────────────────────────────────────────────────────

    private boolean downloadCompressAndSave(Recipe recipe, String imageUrl) throws IOException {
        byte[] raw = restClient.get().uri(imageUrl).retrieve().body(byte[].class);
        if (raw == null || raw.length == 0) {
            log.warn("Downloaded empty image for recipe '{}'", recipe.getTitle());
            return false;
        }
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Thumbnails.of(new ByteArrayInputStream(raw))
                .size(600, 600)
                .outputFormat("JPEG")
                .outputQuality(0.82)
                .toOutputStream(baos);
        recipe.setPhotoData(baos.toByteArray());
        recipe.setPhotoContentType("image/jpeg");
        recipeRepository.save(recipe);
        log.info("Auto-fetched photo for recipe '{}'", recipe.getTitle());
        return true;
    }

    private String buildQuery(Recipe recipe) {
        StringBuilder sb = new StringBuilder(recipe.getTitle()).append(" food recipe");
        if (StringUtils.hasText(recipe.getCategories())) {
            sb.append(' ').append(recipe.getCategories());
        }
        return sb.toString();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record UnsplashSearchResponse(List<UnsplashResult> results) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record UnsplashResult(UnsplashUrls urls) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record UnsplashUrls(String small) {}
}
