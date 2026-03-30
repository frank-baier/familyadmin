package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.ItineraryEntryRequest;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.ItineraryEntry;
import de.baier.familyadmin.model.Trip;
import de.baier.familyadmin.repository.ItineraryEntryRepository;
import de.baier.familyadmin.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class ItineraryService {

    private final ItineraryEntryRepository itineraryEntryRepository;
    private final TripRepository tripRepository;

    @Transactional(readOnly = true)
    public List<ItineraryEntry> getEntriesByTrip(UUID tripId) {
        return itineraryEntryRepository.findByTripIdOrderByEntryDateAscEntryTimeAscPositionAsc(tripId);
    }

    public ItineraryEntry addEntry(UUID tripId, ItineraryEntryRequest req) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found: " + tripId));

        var entry = ItineraryEntry.builder()
                .trip(trip)
                .entryDate(req.entryDate())
                .entryTime(req.entryTime())
                .title(req.title())
                .description(req.description())
                .location(req.location())
                .position(req.position())
                .build();
        return itineraryEntryRepository.save(entry);
    }

    public ItineraryEntry updateEntry(UUID entryId, ItineraryEntryRequest req) {
        ItineraryEntry entry = itineraryEntryRepository.findById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("Itinerary entry not found: " + entryId));

        entry.setEntryDate(req.entryDate());
        entry.setEntryTime(req.entryTime());
        entry.setTitle(req.title());
        entry.setDescription(req.description());
        entry.setLocation(req.location());
        entry.setPosition(req.position());
        return itineraryEntryRepository.save(entry);
    }

    public void deleteEntry(UUID entryId) {
        if (!itineraryEntryRepository.existsById(entryId)) {
            throw new ResourceNotFoundException("Itinerary entry not found: " + entryId);
        }
        itineraryEntryRepository.deleteById(entryId);
    }
}
