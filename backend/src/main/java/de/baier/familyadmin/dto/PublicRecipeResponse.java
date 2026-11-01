package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.Recipe;

import java.math.BigDecimal;
import java.util.List;

/**
 * Reduced recipe view for unauthenticated share links.
 * Deliberately omits internal IDs, creator, rating and private notes.
 */
public record PublicRecipeResponse(
        String title,
        String description,
        Integer servings,
        Integer prepMinutes,
        Integer cookMinutes,
        Integer totalMinutes,
        String difficulty,
        String categories,
        String source,
        String sourceUrl,
        String photoUrl,
        List<Ingredient> ingredients,
        List<Step> steps
) {
    public record Ingredient(String name, BigDecimal amount, String unit, int position, String section) {}

    public record Step(String text, int position) {}

    public static PublicRecipeResponse from(Recipe recipe) {
        String photoUrl = recipe.getPhotoData() != null
                ? "/api/public/recipes/" + recipe.getShareToken() + "/photo"
                : null;
        return new PublicRecipeResponse(
                recipe.getTitle(),
                recipe.getDescription(),
                recipe.getServings(),
                recipe.getPrepMinutes(),
                recipe.getCookMinutes(),
                recipe.getTotalMinutes(),
                recipe.getDifficulty(),
                recipe.getCategories(),
                recipe.getSource(),
                recipe.getSourceUrl(),
                photoUrl,
                recipe.getIngredients().stream()
                        .map(i -> new Ingredient(i.getName(), i.getAmount(), i.getUnit(), i.getPosition(), i.getSection()))
                        .toList(),
                recipe.getSteps().stream()
                        .map(s -> new Step(s.getText(), s.getPosition()))
                        .toList()
        );
    }
}
