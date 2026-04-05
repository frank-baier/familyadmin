package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record TaskTemplateRequest(
        @NotBlank String name,
        String description,
        List<SubtaskRequest> subtasks
) {
    public record SubtaskRequest(
            @NotBlank String text,
            int position
    ) {}
}
