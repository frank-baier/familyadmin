package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.MealPlanRequest;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.MealPlan;
import de.baier.familyadmin.model.MealSlot;
import de.baier.familyadmin.repository.MealPlanRepository;
import de.baier.familyadmin.repository.RecipeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class MealPlanService {

    private final MealPlanRepository mealPlanRepository;
    private final RecipeRepository recipeRepository;

    @Transactional(readOnly = true)
    public List<MealPlan> getWeek(LocalDate from, LocalDate to) {
        return mealPlanRepository.findByPlanDateBetweenOrderByPlanDateAscSlotAsc(from, to);
    }

    public MealPlan setMealPlan(LocalDate planDate, MealSlot slot, MealPlanRequest req) {
        var recipe = recipeRepository.findById(req.recipeId())
                .orElseThrow(() -> new ResourceNotFoundException("Recipe not found: " + req.recipeId()));

        var entry = mealPlanRepository.findByPlanDateAndSlot(planDate, slot)
                .orElse(MealPlan.builder()
                        .planDate(planDate)
                        .slot(slot)
                        .build());

        entry.setRecipe(recipe);
        entry.setNotes(req.notes());

        return mealPlanRepository.save(entry);
    }

    public void removeMealPlan(LocalDate planDate, MealSlot slot) {
        var entry = mealPlanRepository.findByPlanDateAndSlot(planDate, slot)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No meal plan entry for " + planDate + " / " + slot));
        mealPlanRepository.delete(entry);
    }
}
