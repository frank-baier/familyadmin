package de.baier.familyadmin.travel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ItineraryEntryRepository extends JpaRepository<ItineraryEntry, UUID> {
    List<ItineraryEntry> findByTripIdOrderByEntryDateAscEntryTimeAscPositionAsc(UUID tripId);
}
