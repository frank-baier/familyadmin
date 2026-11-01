package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.RecipeRequest;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.*;
import de.baier.familyadmin.repository.RecipeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class RecipeService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final RecipeRepository recipeRepository;

    @Transactional(readOnly = true)
    public List<Recipe> getAll() {
        return recipeRepository.findAllByOrderByTitleAsc();
    }

    @Transactional(readOnly = true)
    public Page<Recipe> getAll(int page, int size) {
        return recipeRepository.findAllByOrderByTitleAsc(PageRequest.of(page, size));
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
                            .section(i.section())
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
                            .section(i.section())
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

    public Recipe updateRating(UUID id, Integer rating, User currentUser) {
        var recipe = getById(id);
        requireOwnerOrAdmin(recipe, currentUser);
        recipe.setRating(rating);
        return recipeRepository.save(recipe);
    }

    public void deleteRecipe(UUID id, User currentUser) {
        var recipe = getById(id);
        requireOwnerOrAdmin(recipe, currentUser);
        recipeRepository.delete(recipe);
    }

    public Recipe updatePhoto(UUID id, byte[] photoData, String contentType, User currentUser) {
        var recipe = getById(id);
        requireOwnerOrAdmin(recipe, currentUser);
        recipe.setPhotoData(photoData);
        recipe.setPhotoContentType(contentType);
        return recipeRepository.save(recipe);
    }

    /** Creates a share token (256 bit, base64url) if none exists yet; idempotent. */
    public Recipe enableSharing(UUID id) {
        var recipe = getById(id);
        if (recipe.getShareToken() == null) {
            byte[] bytes = new byte[32];
            SECURE_RANDOM.nextBytes(bytes);
            recipe.setShareToken(Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
        }
        return recipeRepository.save(recipe);
    }

    /** Revokes the share link — the old URL stops working immediately. */
    public Recipe disableSharing(UUID id) {
        var recipe = getById(id);
        recipe.setShareToken(null);
        return recipeRepository.save(recipe);
    }

    @Transactional(readOnly = true)
    public Recipe getByShareToken(String token) {
        // Reject malformed tokens without hitting the DB (43 chars base64url = 32 bytes)
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) {
            throw new ResourceNotFoundException("Shared recipe not found");
        }
        return recipeRepository.findByShareToken(token)
                .orElseThrow(() -> new ResourceNotFoundException("Shared recipe not found"));
    }

    private void requireOwnerOrAdmin(Recipe recipe, User user) {
        boolean isOwner = recipe.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("You don't have permission to modify this recipe");
        }
    }
}
