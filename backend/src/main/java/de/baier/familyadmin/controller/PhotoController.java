package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.RecipeResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.PhotoService;
import de.baier.familyadmin.service.RecipeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/recipes")
@RequiredArgsConstructor
public class PhotoController {

    private final PhotoService  photoService;
    private final RecipeService recipeService;

    @PostMapping("/{id}/photo")
    public ResponseEntity<RecipeResponse> uploadPhoto(@PathVariable UUID id,
                                                       @RequestParam("file") MultipartFile file,
                                                       @AuthenticationPrincipal User currentUser) throws IOException {
        byte[] compressed = photoService.compress(file.getInputStream());
        var recipe = recipeService.updatePhoto(id, compressed, "image/jpeg", currentUser);
        return ResponseEntity.ok(RecipeResponse.from(recipe));
    }

    @GetMapping("/{id}/photo")
    public ResponseEntity<byte[]> getPhoto(@PathVariable UUID id) {
        var recipe = recipeService.getById(id);
        if (recipe.getPhotoData() == null) {
            return ResponseEntity.notFound().build();
        }
        String contentType = recipe.getPhotoContentType() != null ? recipe.getPhotoContentType() : "image/jpeg";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000")
                .body(recipe.getPhotoData());
    }
}
