package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.PublicRecipeResponse;
import de.baier.familyadmin.service.RecipeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Unauthenticated access to recipes via their share token (see SecurityConfig: /api/public/**).
 * Lookup is by token only — recipe UUIDs never grant access here.
 */
@RestController
@RequestMapping("/api/public/recipes")
@RequiredArgsConstructor
public class PublicRecipeController {

    private final RecipeService recipeService;

    @GetMapping("/{token}")
    public ResponseEntity<PublicRecipeResponse> getShared(@PathVariable String token) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Robots-Tag", "noindex, nofollow")
                .body(PublicRecipeResponse.from(recipeService.getByShareToken(token)));
    }

    @GetMapping("/{token}/photo")
    public ResponseEntity<byte[]> getSharedPhoto(@PathVariable String token) {
        var recipe = recipeService.getByShareToken(token);
        if (recipe.getPhotoData() == null) {
            return ResponseEntity.notFound().build();
        }
        String contentType = recipe.getPhotoContentType() != null ? recipe.getPhotoContentType() : "image/jpeg";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                .header("X-Robots-Tag", "noindex, nofollow")
                .body(recipe.getPhotoData());
    }
}
