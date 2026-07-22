package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.NoteNode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NoteNodeRepository extends JpaRepository<NoteNode, UUID> {
    List<NoteNode> findByCategoryIdAndOwnerId(UUID categoryId, UUID ownerId);
}
