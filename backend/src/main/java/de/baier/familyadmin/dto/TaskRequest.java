package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record TaskRequest(
        @NotBlank String title,
        String description,
        UUID assigneeId,
        LocalDate dueDate,
        List<ChecklistItemRequest> checklistItems
) {}
