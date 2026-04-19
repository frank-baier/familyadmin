package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.ChecklistItemResponse;
import de.baier.familyadmin.dto.TaskRequest;
import de.baier.familyadmin.dto.TaskResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.TaskService;
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
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping
    public ResponseEntity<List<TaskResponse>> getAllTasks() {
        return ResponseEntity.ok(taskService.getAllTasks().stream().map(TaskResponse::from).toList());
    }

    @GetMapping("/mine")
    public ResponseEntity<List<TaskResponse>> getMyTasks(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(taskService.getMyTasks(currentUser.getId()).stream().map(TaskResponse::from).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskResponse> getTask(@PathVariable UUID id) {
        return ResponseEntity.ok(TaskResponse.from(taskService.getTaskById(id)));
    }

    @PostMapping
    public ResponseEntity<TaskResponse> createTask(@Valid @RequestBody TaskRequest request,
                                                    @AuthenticationPrincipal User currentUser) {
        var task = taskService.createTask(request, currentUser);
        return ResponseEntity
                .created(URI.create("/api/tasks/" + task.getId()))
                .body(TaskResponse.from(task));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<TaskResponse> updateTask(@PathVariable UUID id,
                                                    @Valid @RequestBody TaskRequest request,
                                                    @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(TaskResponse.from(taskService.updateTask(id, request, currentUser)));
    }

    @PatchMapping("/{id}/complete")
    public ResponseEntity<TaskResponse> completeTask(@PathVariable UUID id,
                                                      @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(TaskResponse.from(taskService.completeTask(id, currentUser)));
    }

    @PatchMapping("/{id}/checklist/{itemId}")
    public ResponseEntity<ChecklistItemResponse> toggleChecklistItem(@PathVariable UUID id,
                                                                      @PathVariable UUID itemId) {
        return ResponseEntity.ok(ChecklistItemResponse.from(taskService.toggleChecklistItem(id, itemId)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable UUID id,
                                           @AuthenticationPrincipal User currentUser) {
        taskService.deleteTask(id, currentUser);
        return ResponseEntity.noContent().build();
    }
}
