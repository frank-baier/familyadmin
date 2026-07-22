package de.baier.familyadmin.repository;

import de.baier.familyadmin.dto.DocumentTreeNode;
import de.baier.familyadmin.model.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    Page<Document> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("""
            SELECT new de.baier.familyadmin.dto.DocumentTreeNode(d.category, d.year, d.subcategory, COUNT(d))
            FROM Document d
            GROUP BY d.category, d.year, d.subcategory
            ORDER BY d.category NULLS LAST, d.year DESC NULLS LAST, d.subcategory NULLS LAST
            """)
    List<DocumentTreeNode> findGroupedTree();

    Optional<Document> findFirstByFilenameAndCategoryAndSubcategoryAndYear(
            String filename, String category, String subcategory, Integer year);

    @Query("""
            SELECT d FROM Document d
            WHERE (:category IS NULL OR d.category = :category)
              AND (:year IS NULL OR d.year = :year)
              AND (:subcategory IS NULL OR d.subcategory = :subcategory)
            ORDER BY d.createdAt DESC
            """)
    Page<Document> findFiltered(
            @Param("category") String category,
            @Param("year") Integer year,
            @Param("subcategory") String subcategory,
            Pageable pageable);
}
