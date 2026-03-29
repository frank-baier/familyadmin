package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.ChecklistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChecklistItemRepository extends JpaRepository<ChecklistItem, UUID> {
    List<ChecklistItem> findByTaskIdOrderByPosition(UUID taskId);
}
