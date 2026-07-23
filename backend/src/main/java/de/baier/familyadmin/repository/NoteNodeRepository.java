package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.NoteNode;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface NoteNodeRepository extends JpaRepository<NoteNode, UUID> {
    List<NoteNode> findByCategoryIdAndOwnerId(UUID categoryId, UUID ownerId);

    @Query("""
            SELECT n FROM NoteNode n
            WHERE n.owner.id = :ownerId
              AND (LOWER(n.name) LIKE LOWER(CONCAT('%', :query, '%'))
                   OR LOWER(n.content) LIKE LOWER(CONCAT('%', :query, '%')))
            ORDER BY n.updatedAt DESC
            """)
    List<NoteNode> search(@Param("ownerId") UUID ownerId, @Param("query") String query, Pageable pageable);
}
