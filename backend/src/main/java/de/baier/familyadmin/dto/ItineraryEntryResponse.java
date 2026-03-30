package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.ItineraryEntry;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record ItineraryEntryResponse(
        UUID id,
        LocalDate entryDate,
        LocalTime entryTime,
        String title,
        String description,
        String location,
        int position
) {
    public static ItineraryEntryResponse from(ItineraryEntry entry) {
        return new ItineraryEntryResponse(
                entry.getId(),
                entry.getEntryDate(),
                entry.getEntryTime(),
                entry.getTitle(),
                entry.getDescription(),
                entry.getLocation(),
                entry.getPosition()
        );
    }
}
