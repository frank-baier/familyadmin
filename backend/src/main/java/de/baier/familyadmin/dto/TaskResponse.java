package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.Task;
import de.baier.familyadmin.model.TaskStatus;

import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record TaskResponse(
        UUID id,
        String title,
        String description,
        TaskStatus status,
        UserResponse assignee,
        UserResponse createdBy,
        LocalDate dueDate,
        Instant completedAt,
        List<ChecklistItemResponse> checklistItems,
        Instant createdAt
) {
    public static TaskResponse from(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getStatus(),
                task.getAssignee() != null ? UserResponse.from(task.getAssignee()) : null,
                UserResponse.from(task.getCreatedBy()),
                task.getDueDate(),
                task.getCompletedAt(),
                task.getChecklistItems().stream().map(ChecklistItemResponse::from).toList(),
                task.getCreatedAt()
        );
    }
}
