package de.baier.familyadmin.travel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TripHighlightRepository extends JpaRepository<TripHighlight, UUID> {
    Optional<TripHighlight> findByTripIdAndLocation(UUID tripId, String location);
    List<TripHighlight> findByTripIdOrderByLocation(UUID tripId);
    void deleteByTripIdAndLocation(UUID tripId, String location);
}
