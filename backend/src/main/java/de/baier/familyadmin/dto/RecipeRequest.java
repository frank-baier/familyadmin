package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record RecipeRequest(
        @NotBlank String title,
        String description,
        Integer servings,
        Integer prepMinutes,
        Integer cookMinutes,
        List<IngredientRequest> ingredients,
        List<StepRequest> steps
) {}
