package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.RecipeRequest;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.*;
import de.baier.familyadmin.repository.RecipeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class RecipeService {

    private final RecipeRepository recipeRepository;

    @Transactional(readOnly = true)
    public List<Recipe> getAll() {
        return recipeRepository.findAllByOrderByTitleAsc();
    }

    @Transactional(readOnly = true)
    public Recipe getById(UUID id) {
        return recipeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Recipe not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<Recipe> search(String query) {
        return recipeRepository.findByTitleContainingIgnoreCase(query);
    }

    public Recipe createRecipe(RecipeRequest req, User currentUser) {
        var recipe = Recipe.builder()
                .title(req.title())
                .description(req.description())
                .servings(req.servings())
                .prepMinutes(req.prepMinutes())
                .cookMinutes(req.cookMinutes())
                .totalMinutes(req.totalMinutes())
                .source(req.source())
                .sourceUrl(req.sourceUrl())
                .rating(req.rating())
                .difficulty(req.difficulty())
                .notes(req.notes())
                .nutritionalInfo(req.nutritionalInfo())
                .categories(req.categories())
                .createdBy(currentUser)
                .build();

        if (req.ingredients() != null) {
            req.ingredients().forEach(i -> recipe.getIngredients().add(
                    RecipeIngredient.builder()
                            .recipe(recipe)
                            .name(i.name())
                            .amount(i.amount())
                            .unit(i.unit())
                            .position(i.position())
                            .build()));
        }

        if (req.steps() != null) {
            req.steps().forEach(s -> recipe.getSteps().add(
                    RecipeStep.builder()
                            .recipe(recipe)
                            .text(s.text())
                            .position(s.position())
                            .build()));
        }

        return recipeRepository.save(recipe);
    }

    public Recipe updateRecipe(UUID id, RecipeRequest req, User currentUser) {
        var recipe = getById(id);
        requireOwnerOrAdmin(recipe, currentUser);

        recipe.setTitle(req.title());
        recipe.setDescription(req.description());
        recipe.setServings(req.servings());
        recipe.setPrepMinutes(req.prepMinutes());
        recipe.setCookMinutes(req.cookMinutes());
        recipe.setTotalMinutes(req.totalMinutes());
        recipe.setSource(req.source());
        recipe.setSourceUrl(req.sourceUrl());
        recipe.setRating(req.rating());
        recipe.setDifficulty(req.difficulty());
        recipe.setNotes(req.notes());
        recipe.setNutritionalInfo(req.nutritionalInfo());
        recipe.setCategories(req.categories());

        recipe.getIngredients().clear();
        if (req.ingredients() != null) {
            req.ingredients().forEach(i -> recipe.getIngredients().add(
                    RecipeIngredient.builder()
                            .recipe(recipe)
                            .name(i.name())
                            .amount(i.amount())
                            .unit(i.unit())
                            .position(i.position())
                            .build()));
        }

        recipe.getSteps().clear();
        if (req.steps() != null) {
            req.steps().forEach(s -> recipe.getSteps().add(
                    RecipeStep.builder()
                            .recipe(recipe)
                            .text(s.text())
                            .position(s.position())
                            .build()));
        }

        return recipeRepository.save(recipe);
    }

    public void deleteRecipe(UUID id, User currentUser) {
        var recipe = getById(id);
        requireOwnerOrAdmin(recipe, currentUser);
        recipeRepository.delete(recipe);
    }

    public Recipe updatePhotoUrl(UUID id, String photoUrl, User currentUser) {
        var recipe = getById(id);
        requireOwnerOrAdmin(recipe, currentUser);
        recipe.setPhotoUrl(photoUrl);
        return recipeRepository.save(recipe);
    }

    private void requireOwnerOrAdmin(Recipe recipe, User user) {
        boolean isOwner = recipe.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("You don't have permission to modify this recipe");
        }
    }
}
