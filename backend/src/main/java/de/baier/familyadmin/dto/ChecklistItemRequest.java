package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

public record ChecklistItemRequest(
        @NotBlank String text,
        int position
) {}
