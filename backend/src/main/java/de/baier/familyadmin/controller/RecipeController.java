package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.RecipeRequest;
import de.baier.familyadmin.dto.RecipeResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.PaprikaImportService;
import de.baier.familyadmin.service.RecipeService;
import de.baier.familyadmin.service.RecipeUrlImportService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
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

    private final RecipeService           recipeService;
    private final PaprikaImportService    paprikaImportService;
    private final RecipeUrlImportService  recipeUrlImportService;

    record RecipePage(List<RecipeResponse> content, int page, int totalPages, boolean hasNext) {}
    record UrlImportRequest(@NotBlank String url) {}

    @GetMapping
    public ResponseEntity<RecipePage> getAll(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "24") int size) {
        Page<de.baier.familyadmin.model.Recipe> result = recipeService.getAll(page, size);
        return ResponseEntity.ok(new RecipePage(
                result.getContent().stream().map(RecipeResponse::from).toList(),
                result.getNumber(),
                result.getTotalPages(),
                result.hasNext()
        ));
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

    @PostMapping("/import/web")
    public ResponseEntity<PaprikaImportService.ImportResult> importFromWeb(
            @Valid @RequestBody UrlImportRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(recipeUrlImportService.importFromUrl(request.url(), currentUser));
    }
}
