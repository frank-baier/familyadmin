package de.baier.familyadmin.recipes;

  
import java.time.LocalDate;
import java.util.UUID;

public record MealPlanResponse(
        UUID id,
        LocalDate planDate,
        MealSlot slot,
        RecipeResponse recipe,
        String notes
) {
    public static MealPlanResponse from(MealPlan mp) {
        return new MealPlanResponse(
                mp.getId(),
                mp.getPlanDate(),
                mp.getSlot(),
                RecipeResponse.from(mp.getRecipe()),
                mp.getNotes()
        );
    }
}
