package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.Recipe;
import de.baier.familyadmin.model.RecipeIngredient;
import de.baier.familyadmin.model.RecipeStep;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RecipeResponse(
        UUID id,
        String title,
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
        String photoUrl,
        UserResponse createdBy,
        List<IngredientResponse> ingredients,
        List<StepResponse> steps,
        Instant createdAt,
        Instant updatedAt
) {
    public record IngredientResponse(UUID id, String name, BigDecimal amount, String unit, int position) {
        public static IngredientResponse from(RecipeIngredient i) {
            return new IngredientResponse(i.getId(), i.getName(), i.getAmount(), i.getUnit(), i.getPosition());
        }
    }

    public record StepResponse(UUID id, String text, int position) {
        public static StepResponse from(RecipeStep s) {
            return new StepResponse(s.getId(), s.getText(), s.getPosition());
        }
    }

    public static RecipeResponse from(Recipe recipe) {
        return new RecipeResponse(
                recipe.getId(),
                recipe.getTitle(),
                recipe.getDescription(),
                recipe.getServings(),
                recipe.getPrepMinutes(),
                recipe.getCookMinutes(),
                recipe.getTotalMinutes(),
                recipe.getSource(),
                recipe.getSourceUrl(),
                recipe.getRating(),
                recipe.getDifficulty(),
                recipe.getNotes(),
                recipe.getNutritionalInfo(),
                recipe.getCategories(),
                recipe.getPhotoUrl(),
                UserResponse.from(recipe.getCreatedBy()),
                recipe.getIngredients().stream().map(IngredientResponse::from).toList(),
                recipe.getSteps().stream().map(StepResponse::from).toList(),
                recipe.getCreatedAt(),
                recipe.getUpdatedAt()
        );
    }
}
