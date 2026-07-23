package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.NoteCategoryRequest;
import de.baier.familyadmin.dto.NoteCategoryResponse;
import de.baier.familyadmin.dto.NoteNodeRequest;
import de.baier.familyadmin.dto.NoteNodeResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.NoteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;

    @GetMapping("/categories")
    public List<NoteCategoryResponse> getCategories(@AuthenticationPrincipal User currentUser) {
        return noteService.getCategories(currentUser).stream()
                .map(NoteCategoryResponse::from)
                .toList();
    }

    @GetMapping("/search")
    public List<NoteNodeResponse> search(
            @RequestParam("q") String query,
            @AuthenticationPrincipal User currentUser) {
        return noteService.search(currentUser, query).stream()
                .map(NoteNodeResponse::from)
                .toList();
    }

    @PostMapping("/categories")
    public ResponseEntity<NoteCategoryResponse> createCategory(
            @Valid @RequestBody NoteCategoryRequest request,
            @AuthenticationPrincipal User currentUser) {
        var category = noteService.createCategory(currentUser, request.name());
        return ResponseEntity
                .created(URI.create("/api/notes/categories/" + category.getId()))
                .body(NoteCategoryResponse.from(category));
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<NoteCategoryResponse> renameCategory(
            @PathVariable UUID id,
            @Valid @RequestBody NoteCategoryRequest request,
            @AuthenticationPrincipal User currentUser) {
        var category = noteService.renameCategory(id, currentUser, request.name());
        return ResponseEntity.ok(NoteCategoryResponse.from(category));
    }

    @DeleteMapping("/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        noteService.deleteCategory(id, currentUser);
    }

    @GetMapping("/categories/{categoryId}/nodes")
    public List<NoteNodeResponse> getNodes(
            @PathVariable UUID categoryId,
            @AuthenticationPrincipal User currentUser) {
        return noteService.getNodes(categoryId, currentUser).stream()
                .map(NoteNodeResponse::from)
                .toList();
    }

    @PostMapping("/categories/{categoryId}/nodes")
    public ResponseEntity<NoteNodeResponse> createNode(
            @PathVariable UUID categoryId,
            @Valid @RequestBody NoteNodeRequest request,
            @AuthenticationPrincipal User currentUser) {
        var node = noteService.createNode(categoryId, currentUser, request);
        return ResponseEntity
                .created(URI.create("/api/notes/nodes/" + node.getId()))
                .body(NoteNodeResponse.from(node));
    }

    @PutMapping("/nodes/{id}")
    public ResponseEntity<NoteNodeResponse> updateNode(
            @PathVariable UUID id,
            @Valid @RequestBody NoteNodeRequest request,
            @AuthenticationPrincipal User currentUser) {
        var node = noteService.updateNode(id, currentUser, request);
        return ResponseEntity.ok(NoteNodeResponse.from(node));
    }

    @DeleteMapping("/nodes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNode(@PathVariable UUID id, @AuthenticationPrincipal User currentUser) {
        noteService.deleteNode(id, currentUser);
    }
}
