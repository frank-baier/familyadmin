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
import java.util.*;
import java.util.regex.Matcher;
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
            "hotel|lodge|resort|park|hostel|camp|pension|big4|tasman|coral|garden|beach house|airways|unterkunft|mowbray",
            Pattern.CASE_INSENSITIVE);

    // Matches "DD.MM.YYYY" or "YYYY-MM-DD"
    private static final Pattern DATE_DE = Pattern.compile("(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})");
    private static final Pattern DATE_ISO = Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})");

    private final TripHighlightRepository highlightRepository;
    private final TripRepository tripRepository;
    private final OllamaService ollamaService;
    private final ObjectMapper objectMapper;

    public List<TripHighlightResponse> getHighlights(UUID tripId) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        List<TripKeyInfo> accommodations = trip.getKeyInfos().stream()
                .filter(this::isAccommodation)
                .sorted(Comparator.comparingLong(ki -> dateToSortKey(extractCheckDate(ki.getValue(), "in"))))
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

    // Returns "DD.MM.YYYY" or null
    private String extractCheckDate(String value, String type) {
        if (value == null) return null;
        String keyword = type.equals("in") ? "check-in" : "check-out";
        for (String line : value.split("\n")) {
            if (!line.toLowerCase().contains(keyword)) continue;
            Matcher m = DATE_DE.matcher(line);
            if (m.find()) return String.format("%02d.%02d.%s",
                    Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), m.group(3));
            Matcher m2 = DATE_ISO.matcher(line);
            if (m2.find()) return String.format("%s.%s.%s", m2.group(3), m2.group(2), m2.group(1));
        }
        return null;
    }

    // "DD.MM.YYYY" → YYYYMMDD as long for sorting (null → Long.MAX_VALUE)
    private long dateToSortKey(String date) {
        if (date == null) return Long.MAX_VALUE;
        Matcher m = Pattern.compile("(\\d{2})\\.(\\d{2})\\.(\\d{4})").matcher(date);
        if (!m.matches()) return Long.MAX_VALUE;
        return Long.parseLong(m.group(3)) * 10000L + Long.parseLong(m.group(2)) * 100L + Long.parseLong(m.group(1));
    }

    private TripHighlight generate(Trip trip, TripKeyInfo ki, String location) {
        String checkIn  = extractCheckDate(ki.getValue(), "in");
        String checkOut = extractCheckDate(ki.getValue(), "out");
        String addressContext = buildAddressContext(ki.getValue());
        String dateContext = checkIn != null
                ? "Aufenthalt vom " + checkIn + (checkOut != null ? " bis " + checkOut : "")
                : "";

        String prompt = """
                Du bist ein präziser Reiseberater mit verlässlichem geografischem Wissen.
                Eine Familie übernachtet in "%s" (%s) auf ihrer Reise nach %s. %s

                Nenne genau 4 ECHTE, tatsächlich existierende Sehenswürdigkeiten oder Aktivitäten in dieser Gegend.
                Wichtig: Erfinde KEINE Orte. Nur bekannte, belegbare Attraktionen nennen.

                Antworte NUR mit einem JSON-Array, ohne Markdown, ohne Erklärungen:
                [{"name":"exakter offizieller Name","description":"Ein bis zwei präzise Sätze. Keine erfundenen Details.","category":"Natur"}]
                Erlaubte Kategorien: Natur, Strand, Stadt, Essen, Kultur, Abenteuer, Sport, Tierwelt
                Antworte auf Deutsch.
                """.formatted(location, addressContext, trip.getDestination(), dateContext);

        try {
            String raw = ollamaService.generate(prompt);
            String json = extractJson(raw);
            objectMapper.readTree(json); // validate

            TripHighlight h = TripHighlight.builder()
                    .trip(trip)
                    .location(location)
                    .highlights(json)
                    .checkIn(checkIn)
                    .checkOut(checkOut)
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
        return Arrays.stream(value.split("\n"))
                .map(String::trim)
                .filter(l -> !l.isEmpty() && !META_RE.matcher(l).find())
                .limit(3)
                .reduce((a, b) -> a + ", " + b)
                .orElse("");
    }

    private String extractJson(String raw) throws JsonProcessingException {
        int start = raw.indexOf('[');
        int end   = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            throw new JsonProcessingException("No JSON array in: " + raw.substring(0, Math.min(200, raw.length()))) {};
        }
        return raw.substring(start, end + 1);
    }
}
