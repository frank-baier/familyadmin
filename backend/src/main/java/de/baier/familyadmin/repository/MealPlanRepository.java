package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.MealPlan;
import de.baier.familyadmin.model.MealSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MealPlanRepository extends JpaRepository<MealPlan, UUID> {
    List<MealPlan> findByPlanDateBetweenOrderByPlanDateAscSlotAsc(LocalDate from, LocalDate to);
    Optional<MealPlan> findByPlanDateAndSlot(LocalDate planDate, MealSlot slot);
}
