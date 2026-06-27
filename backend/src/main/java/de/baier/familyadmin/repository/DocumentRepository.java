package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.Document;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    @EntityGraph(attributePaths = "uploadedBy")
    List<Document> findAllByOrderByCreatedAtDesc();
}
