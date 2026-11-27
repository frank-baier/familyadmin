package de.baier.familyadmin.recipes;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/meal-plan")
@RequiredArgsConstructor
public class MealPlanController {

    private final MealPlanService mealPlanService;

    @GetMapping
    public ResponseEntity<List<MealPlanResponse>> getWeek(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(
                mealPlanService.getWeek(from, to).stream().map(MealPlanResponse::from).toList());
    }

    @PutMapping("/{date}/{slot}")
    public ResponseEntity<MealPlanResponse> setMealPlan(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable MealSlot slot,
            @Valid @RequestBody MealPlanRequest request) {
        return ResponseEntity.ok(MealPlanResponse.from(mealPlanService.setMealPlan(date, slot, request)));
    }

    @DeleteMapping("/{date}/{slot}")
    public ResponseEntity<Void> removeMealPlan(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @PathVariable MealSlot slot) {
        mealPlanService.removeMealPlan(date, slot);
        return ResponseEntity.noContent().build();
    }
}
