package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.TaskTemplateRequest;
import de.baier.familyadmin.dto.TaskTemplateResponse;
import de.baier.familyadmin.dto.TaskResponse;
import de.baier.familyadmin.dto.UseTemplateRequest;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.TaskTemplateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/task-templates")
@RequiredArgsConstructor
public class TaskTemplateController {

    private final TaskTemplateService templateService;

    @GetMapping
    public ResponseEntity<List<TaskTemplateResponse>> getAll() {
        return ResponseEntity.ok(
                templateService.getAll().stream().map(TaskTemplateResponse::from).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskTemplateResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(TaskTemplateResponse.from(templateService.getById(id)));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<TaskTemplateResponse> create(
            @Valid @RequestBody TaskTemplateRequest request,
            @AuthenticationPrincipal User currentUser) {
        var template = templateService.create(request, currentUser);
        return ResponseEntity
                .created(URI.create("/api/task-templates/" + template.getId()))
                .body(TaskTemplateResponse.from(template));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<TaskTemplateResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody TaskTemplateRequest request) {
        return ResponseEntity.ok(TaskTemplateResponse.from(templateService.update(id, request)));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        templateService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/use")
    public ResponseEntity<TaskResponse> useTemplate(
            @PathVariable UUID id,
            @RequestBody UseTemplateRequest request,
            @AuthenticationPrincipal User currentUser) {
        var task = templateService.useTemplate(id, request, currentUser);
        return ResponseEntity
                .created(URI.create("/api/tasks/" + task.getId()))
                .body(TaskResponse.from(task));
    }
}
