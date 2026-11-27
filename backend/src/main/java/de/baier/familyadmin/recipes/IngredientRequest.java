package de.baier.familyadmin.recipes;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public record IngredientRequest(
        @NotBlank String name,
        BigDecimal amount,
        String unit,
        int position,
        String section
) {}
