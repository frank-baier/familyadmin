package de.baier.familyadmin.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.dto.TripHighlightResponse;
import de.baier.familyadmin.model.Trip;
import de.baier.familyadmin.model.TripHighlight;
import de.baier.familyadmin.model.TripKeyInfo;
import de.baier.familyadmin.repository.TripHighlightRepository;
import de.baier.familyadmin.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class HighlightService {

    private static final Pattern META_RE = Pattern.compile(
            "^(check-in|check-out|buchung|ref:|nacht:|storno|powered site|price|additional|your group|arriving|departing|staying)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern CAR_RENTAL_RE = Pattern.compile(
            "mietwagen|camper|wohnmobil|car hire|rental car", Pattern.CASE_INSENSITIVE);
    private static final Pattern TRANSIT_RE = Pattern.compile(
            "transit|stpc|stopover", Pattern.CASE_INSENSITIVE);
    private static final Pattern ACCOM_LABEL_RE = Pattern.compile(
            "hotel|lodge|resort|park|hostel|camp|pension|big4|tasman|coral|garden|beach house|airways",
            Pattern.CASE_INSENSITIVE);

    private final TripHighlightRepository highlightRepository;
    private final TripRepository tripRepository;
    private final OllamaService ollamaService;
    private final ObjectMapper objectMapper;

    public List<TripHighlightResponse> getHighlights(UUID tripId) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        List<TripKeyInfo> accommodations = trip.getKeyInfos().stream()
                .filter(this::isAccommodation)
                .toList();

        List<TripHighlightResponse> results = new ArrayList<>();
        for (TripKeyInfo ki : accommodations) {
            String location = ki.getLabel().trim();
            TripHighlight highlight = highlightRepository
                    .findByTripIdAndLocation(tripId, location)
                    .orElseGet(() -> generate(trip, ki, location));
            if (highlight != null) {
                results.add(TripHighlightResponse.from(highlight));
            }
        }
        return results;
    }

    public void deleteHighlight(UUID tripId, UUID highlightId) {
        TripHighlight h = highlightRepository.findById(highlightId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!h.getTrip().getId().equals(tripId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        highlightRepository.delete(h);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private boolean isAccommodation(TripKeyInfo ki) {
        String lbl = ki.getLabel().toLowerCase();
        String val = ki.getValue() != null ? ki.getValue().toLowerCase() : "";
        if (CAR_RENTAL_RE.matcher(lbl).find()) return false;
        if (TRANSIT_RE.matcher(lbl).find()) return false;
        return val.contains("check-in") || val.contains("check-out")
                || ACCOM_LABEL_RE.matcher(lbl).find();
    }

    private TripHighlight generate(Trip trip, TripKeyInfo ki, String location) {
        String addressContext = buildAddressContext(ki.getValue());
        String prompt = """
                Du bist ein erfahrener Reiseberater. Eine Familie übernachtet in "%s" (%s) auf ihrer Reise nach %s.
                Nenne genau 4 Highlights, Sehenswürdigkeiten oder Aktivitäten in dieser Gegend, die man unbedingt erlebt haben muss.
                Antworte NUR mit einem JSON-Array ohne weitere Erklärungen, Markdown oder Text davor/danach:
                [{"name":"...","description":"Ein bis zwei informative Sätze.","category":"..."}]
                Erlaubte Kategorien: Natur, Strand, Stadt, Essen, Kultur, Abenteuer, Sport, Tierwelt
                Antworte auf Deutsch.
                """.formatted(location, addressContext, trip.getDestination());

        try {
            String raw = ollamaService.generate(prompt);
            String json = extractJson(raw);
            // validate it parses
            objectMapper.readTree(json);

            TripHighlight h = TripHighlight.builder()
                    .trip(trip)
                    .location(location)
                    .highlights(json)
                    .generatedAt(Instant.now())
                    .build();
            return highlightRepository.save(h);
        } catch (Exception e) {
            log.error("Failed to generate highlights for '{}': {}", location, e.getMessage());
            return null;
        }
    }

    private String buildAddressContext(String value) {
        if (value == null || value.isBlank()) return "";
        List<String> parts = new ArrayList<>();
        for (String line : value.split("\n")) {
            String l = line.trim();
            if (!l.isEmpty() && !META_RE.matcher(l).find()) {
                parts.add(l);
            }
        }
        return String.join(", ", parts.stream().limit(3).toList());
    }

    // Pull the first [...] block out of the LLM response
    private String extractJson(String raw) throws JsonProcessingException {
        int start = raw.indexOf('[');
        int end   = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            throw new JsonProcessingException("No JSON array found in: " + raw.substring(0, Math.min(200, raw.length()))) {};
        }
        return raw.substring(start, end + 1);
    }
}
