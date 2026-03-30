package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.ItineraryEntryRequest;
import de.baier.familyadmin.dto.ItineraryEntryResponse;
import de.baier.familyadmin.service.ItineraryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trips/{tripId}/itinerary")
@RequiredArgsConstructor
public class ItineraryController {

    private final ItineraryService itineraryService;

    @GetMapping
    public ResponseEntity<List<ItineraryEntryResponse>> getEntries(@PathVariable UUID tripId) {
        return ResponseEntity.ok(
                itineraryService.getEntriesByTrip(tripId)
                        .stream().map(ItineraryEntryResponse::from).toList()
        );
    }

    @PostMapping
    public ResponseEntity<ItineraryEntryResponse> addEntry(
            @PathVariable UUID tripId,
            @Valid @RequestBody ItineraryEntryRequest request) {
        var entry = itineraryService.addEntry(tripId, request);
        return ResponseEntity
                .created(URI.create("/api/trips/" + tripId + "/itinerary/" + entry.getId()))
                .body(ItineraryEntryResponse.from(entry));
    }

    @PutMapping("/{entryId}")
    public ResponseEntity<ItineraryEntryResponse> updateEntry(
            @PathVariable UUID tripId,
            @PathVariable UUID entryId,
            @Valid @RequestBody ItineraryEntryRequest request) {
        return ResponseEntity.ok(ItineraryEntryResponse.from(itineraryService.updateEntry(entryId, request)));
    }

    @DeleteMapping("/{entryId}")
    public ResponseEntity<Void> deleteEntry(@PathVariable UUID tripId,
                                             @PathVariable UUID entryId) {
        itineraryService.deleteEntry(entryId);
        return ResponseEntity.noContent().build();
    }
}
