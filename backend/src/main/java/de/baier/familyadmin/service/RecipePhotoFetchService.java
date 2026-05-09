package de.baier.familyadmin.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.model.Recipe;
import de.baier.familyadmin.repository.RecipeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class RecipePhotoFetchService {

    private static final String UNSPLASH_BASE = "https://api.unsplash.com";
    private static final String UPLOAD_DIR    = "uploads";

    private final RecipeRepository recipeRepository;
    private final ObjectMapper     objectMapper;

    @Value("${app.recipe.photo.unsplash-access-key:}")
    private String unsplashAccessKey;

    private final RestClient restClient = RestClient.builder().build();

    public RecipePhotoFetchService(RecipeRepository recipeRepository, ObjectMapper objectMapper) {
        this.recipeRepository = recipeRepository;
        this.objectMapper     = objectMapper;
    }

    /**
     * Searches Unsplash for a food photo matching the recipe, downloads it,
     * saves to disk, and updates the recipe's photoUrl in the DB.
     * Never throws — returns false on any failure so callers can continue.
     */
    public boolean fetchAndSave(Recipe recipe) {
        if (!StringUtils.hasText(unsplashAccessKey)) {
            log.warn("Unsplash access key not configured — skipping photo fetch for '{}'", recipe.getTitle());
            return false;
        }

        try {
            URI searchUri = UriComponentsBuilder
                    .fromUriString(UNSPLASH_BASE + "/search/photos")
                    .queryParam("query",     buildQuery(recipe))
                    .queryParam("per_page",  1)
                    .queryParam("client_id", unsplashAccessKey)
                    .build()
                    .toUri();

            String responseBody = restClient.get()
                    .uri(searchUri)
                    .retrieve()
                    .body(String.class);

            UnsplashSearchResponse searchResponse = objectMapper.readValue(responseBody, UnsplashSearchResponse.class);
            if (searchResponse.results() == null || searchResponse.results().isEmpty()) {
                log.warn("No Unsplash results for recipe '{}'", recipe.getTitle());
                return false;
            }

            String imageUrl = searchResponse.results().get(0).urls().small();
            if (!StringUtils.hasText(imageUrl)) {
                log.warn("Unsplash result has no image URL for recipe '{}'", recipe.getTitle());
                return false;
            }

            // Image download is from Unsplash CDN — does not count against the API rate limit
            byte[] imageBytes = restClient.get()
                    .uri(imageUrl)
                    .retrieve()
                    .body(byte[].class);

            if (imageBytes == null || imageBytes.length == 0) {
                log.warn("Downloaded empty image for recipe '{}'", recipe.getTitle());
                return false;
            }

            String photoUrl = saveImageBytes(imageBytes);
            recipe.setPhotoUrl(photoUrl);
            recipeRepository.save(recipe);

            log.info("Auto-fetched photo for recipe '{}' → {}", recipe.getTitle(), photoUrl);
            return true;

        } catch (Exception e) {
            log.warn("Failed to auto-fetch photo for recipe '{}': {}", recipe.getTitle(), e.getMessage());
            return false;
        }
    }

    private String buildQuery(Recipe recipe) {
        StringBuilder sb = new StringBuilder(recipe.getTitle()).append(" food recipe");
        if (StringUtils.hasText(recipe.getCategories())) {
            sb.append(' ').append(recipe.getCategories());
        }
        return sb.toString();
    }

    private String saveImageBytes(byte[] bytes) throws IOException {
        Path uploadPath = Paths.get(UPLOAD_DIR);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }
        String filename = UUID.randomUUID() + ".jpg";
        Files.write(uploadPath.resolve(filename), bytes);
        return "/uploads/" + filename;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record UnsplashSearchResponse(List<UnsplashResult> results) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record UnsplashResult(UnsplashUrls urls) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record UnsplashUrls(String small) {}
}
