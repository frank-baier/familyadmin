package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public record IngredientRequest(
        @NotBlank String name,
        BigDecimal amount,
        String unit,
        int position
) {}
