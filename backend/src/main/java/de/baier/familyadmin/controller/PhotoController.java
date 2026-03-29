package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.RecipeResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.PhotoService;
import de.baier.familyadmin.service.RecipeService;
import lombok.RequiredArgsConstructor;
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

    private final PhotoService photoService;
    private final RecipeService recipeService;

    @PostMapping("/{id}/photo")
    public ResponseEntity<RecipeResponse> uploadPhoto(@PathVariable UUID id,
                                                       @RequestParam("file") MultipartFile file,
                                                       @AuthenticationPrincipal User currentUser) throws IOException {
        String photoUrl = photoService.savePhoto(file);
        var recipe = recipeService.updatePhotoUrl(id, photoUrl, currentUser);
        return ResponseEntity.ok(RecipeResponse.from(recipe));
    }
}
