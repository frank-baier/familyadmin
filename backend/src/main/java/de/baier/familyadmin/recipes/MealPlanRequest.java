package de.baier.familyadmin.recipes;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

public record MealPlanRequest(
        @NotNull LocalDate planDate,
        @NotNull MealSlot slot,
        @NotNull UUID recipeId,
        String notes
) {}
