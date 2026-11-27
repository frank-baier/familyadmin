package de.baier.familyadmin.tasks;

import jakarta.validation.constraints.NotBlank;

public record ChecklistItemRequest(
        @NotBlank String text,
        int position
) {}
