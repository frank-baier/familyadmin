package de.baier.familyadmin.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.model.TripHighlight;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record TripHighlightResponse(
        UUID id,
        String location,
        String checkIn,
        String checkOut,
        List<HighlightItem> highlights,
        Instant generatedAt
) {
    public record HighlightItem(String name, String description, String category) {}

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static TripHighlightResponse from(TripHighlight h) {
        try {
            List<HighlightItem> items = MAPPER.readValue(h.getHighlights(),
                    new TypeReference<>() {});
            return new TripHighlightResponse(
                    h.getId(), h.getLocation(),
                    h.getCheckIn(), h.getCheckOut(),
                    items, h.getGeneratedAt());
        } catch (Exception e) {
            return new TripHighlightResponse(
                    h.getId(), h.getLocation(),
                    h.getCheckIn(), h.getCheckOut(),
                    List.of(), h.getGeneratedAt());
        }
    }
}
