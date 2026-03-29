package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

public record StepRequest(
        @NotBlank String text,
        int position
) {}
