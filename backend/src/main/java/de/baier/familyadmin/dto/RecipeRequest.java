package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record RecipeRequest(
        @NotBlank String title,
        String description,
        Integer servings,
        Integer prepMinutes,
        Integer cookMinutes,
        Integer totalMinutes,
        String source,
        String sourceUrl,
        Integer rating,
        String difficulty,
        String notes,
        String nutritionalInfo,
        String categories,
        List<IngredientRequest> ingredients,
        List<StepRequest> steps
) {}
