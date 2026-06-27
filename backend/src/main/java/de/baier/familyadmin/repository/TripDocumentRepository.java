package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.TripDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TripDocumentRepository extends JpaRepository<TripDocument, UUID> {

    @Query("SELECT td FROM TripDocument td JOIN FETCH td.document d WHERE td.trip.id = :tripId ORDER BY d.createdAt DESC")
    List<TripDocument> findByTripIdOrderByDocumentCreatedAtDesc(@Param("tripId") UUID tripId);

    Optional<TripDocument> findByTripIdAndDocumentId(UUID tripId, UUID documentId);

    boolean existsByDocumentId(UUID documentId);
}
