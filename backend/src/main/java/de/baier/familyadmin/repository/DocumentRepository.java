package de.baier.familyadmin.repository;

import de.baier.familyadmin.dto.DocumentTreeNode;
import de.baier.familyadmin.model.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    @Query("""
            SELECT d FROM Document d
            WHERE (d.uploadedBy.id = :userId
               OR d.uploadedBy IN (SELECT s.owner FROM UserDocumentShare s WHERE s.sharedWith.id = :userId))
            ORDER BY d.createdAt DESC
            """)
    Page<Document> findVisibleByUser(@Param("userId") UUID userId, Pageable pageable);

    @Query("""
            SELECT new de.baier.familyadmin.dto.DocumentTreeNode(d.category, d.year, d.subcategory, COUNT(d))
            FROM Document d
            WHERE (d.uploadedBy.id = :userId
               OR d.uploadedBy IN (SELECT s.owner FROM UserDocumentShare s WHERE s.sharedWith.id = :userId))
            GROUP BY d.category, d.year, d.subcategory
            ORDER BY d.category NULLS LAST, d.year DESC NULLS LAST, d.subcategory NULLS LAST
            """)
    List<DocumentTreeNode> findGroupedTreeForUser(@Param("userId") UUID userId);

    Optional<Document> findFirstByFilenameAndCategoryAndSubcategoryAndYear(
            String filename, String category, String subcategory, Integer year);

    @Query("""
            SELECT d FROM Document d
            WHERE (:category IS NULL OR d.category = :category)
              AND (:year IS NULL OR d.year = :year)
              AND (:subcategory IS NULL OR d.subcategory = :subcategory)
              AND (d.uploadedBy.id = :userId
               OR d.uploadedBy IN (SELECT s.owner FROM UserDocumentShare s WHERE s.sharedWith.id = :userId))
            ORDER BY d.createdAt DESC
            """)
    Page<Document> findFiltered(
            @Param("category") String category,
            @Param("year") Integer year,
            @Param("subcategory") String subcategory,
            @Param("userId") UUID userId,
            Pageable pageable);

    @Query(value = """
            SELECT * FROM documents d
            WHERE NOT EXISTS (SELECT 1 FROM document_chunks dc WHERE dc.document_id = d.id)
              AND d.indexing_skipped = false
            ORDER BY d.created_at DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM documents d
            WHERE NOT EXISTS (SELECT 1 FROM document_chunks dc WHERE dc.document_id = d.id)
              AND d.indexing_skipped = false
            """,
            nativeQuery = true)
    Page<Document> findUnindexed(Pageable pageable);

    @Modifying
    @Query(value = """
            UPDATE documents SET indexing_skipped = true
            WHERE NOT EXISTS (SELECT 1 FROM document_chunks dc WHERE dc.document_id = id)
            """, nativeQuery = true)
    int markAllUnindexedAsSkipped();
}
