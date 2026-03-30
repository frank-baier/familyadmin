package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.ItineraryEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ItineraryEntryRepository extends JpaRepository<ItineraryEntry, UUID> {
    List<ItineraryEntry> findByTripIdOrderByEntryDateAscEntryTimeAscPositionAsc(UUID tripId);
}
