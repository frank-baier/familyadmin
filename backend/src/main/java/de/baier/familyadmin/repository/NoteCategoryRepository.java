package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.NoteCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NoteCategoryRepository extends JpaRepository<NoteCategory, UUID> {
    List<NoteCategory> findByOwnerIdOrderByPositionAscCreatedAtAsc(UUID ownerId);

    boolean existsByOwnerIdAndNameIgnoreCase(UUID ownerId, String name);
}
