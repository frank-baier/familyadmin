package de.baier.familyadmin.tasks;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TaskTemplateRepository extends JpaRepository<TaskTemplate, UUID> {
    List<TaskTemplate> findAllByOrderByNameAsc();
}
