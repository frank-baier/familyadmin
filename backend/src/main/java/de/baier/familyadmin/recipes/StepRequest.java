package de.baier.familyadmin.recipes;

import jakarta.validation.constraints.NotBlank;

public record StepRequest(
        @NotBlank String text,
        int position
) {}
