package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.RecipeRequest;
import de.baier.familyadmin.dto.RecipeResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.PaprikaImportService;
import de.baier.familyadmin.service.RecipeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/recipes")
@RequiredArgsConstructor
public class RecipeController {

    private final RecipeService recipeService;
    private final PaprikaImportService paprikaImportService;

    @GetMapping
    public ResponseEntity<List<RecipeResponse>> getAll() {
        return ResponseEntity.ok(recipeService.getAll().stream().map(RecipeResponse::from).toList());
    }

    @GetMapping("/search")
    public ResponseEntity<List<RecipeResponse>> search(@RequestParam String q) {
        return ResponseEntity.ok(recipeService.search(q).stream().map(RecipeResponse::from).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RecipeResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(RecipeResponse.from(recipeService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<RecipeResponse> create(@Valid @RequestBody RecipeRequest request,
                                                  @AuthenticationPrincipal User currentUser) {
        var recipe = recipeService.createRecipe(request, currentUser);
        return ResponseEntity
                .created(URI.create("/api/recipes/" + recipe.getId()))
                .body(RecipeResponse.from(recipe));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RecipeResponse> update(@PathVariable UUID id,
                                                  @Valid @RequestBody RecipeRequest request,
                                                  @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(RecipeResponse.from(recipeService.updateRecipe(id, request, currentUser)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                       @AuthenticationPrincipal User currentUser) {
        recipeService.deleteRecipe(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/import/paprika")
    public ResponseEntity<List<PaprikaImportService.ImportResult>> importPaprika(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User currentUser) throws IOException {
        return ResponseEntity.ok(paprikaImportService.importPaprikaFile(file, currentUser));
    }
}
