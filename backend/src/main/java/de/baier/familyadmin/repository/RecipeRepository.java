package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RecipeRepository extends JpaRepository<Recipe, UUID> {
    List<Recipe> findByTitleContainingIgnoreCase(String title);
    List<Recipe> findAllByOrderByTitleAsc();
}
