package de.baier.familyadmin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.dto.TravelDocumentAnalysis;
import de.baier.familyadmin.model.*;
import de.baier.familyadmin.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class TripAutoLinkerService {

    private static final Pattern JSON_PATTERN = Pattern.compile("\\{[\\s\\S]+\\}");
    private static final int MAX_TEXT_FOR_LLM = 3_000;

    private final OllamaService ollamaService;
    private final TripRepository tripRepository;
    private final TripDocumentRepository tripDocumentRepository;
    private final ItineraryEntryRepository itineraryEntryRepository;
    private final DocumentRepository documentRepository;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    public void autoLink(UUID documentId, String extractedText,
                         String folderSubcategory, Integer folderYear, UUID uploaderId) {
        try {
            User uploader = userService.findById(uploaderId);

            // Analyze with LLM — but folder metadata is used as reliable fallback
            Optional<TravelDocumentAnalysis> analysis = analyzeWithOllama(extractedText, folderSubcategory);

            String destination = resolveDestination(analysis, folderSubcategory);
            LocalDate startDate = resolveDate(analysis.map(TravelDocumentAnalysis::startDate).orElse(null), folderYear, true);
            LocalDate endDate   = resolveDate(analysis.map(TravelDocumentAnalysis::endDate).orElse(null), folderYear, false);

            if (isPastTrip(startDate, endDate, folderYear)) {
                log.info("Document {} belongs to a past trip (year={}, start={}), skipping auto-link",
                        documentId, folderYear, startDate);
                return;
            }

            if (destination == null) {
                log.info("Document {} (trip folder): no destination resolvable, skipping auto-link", documentId);
                return;
            }

            Trip trip = findOrCreateTrip(destination, folderSubcategory, startDate, endDate, analysis, uploader);

            // Link document → trip
            if (!tripDocumentRepository.existsByDocumentId(documentId)) {
                Document doc = documentRepository.findById(documentId)
                        .orElseThrow(() -> new IllegalStateException("Document not found: " + documentId));
                tripDocumentRepository.save(TripDocument.builder().trip(trip).document(doc).build());
                log.info("Linked document '{}' to trip '{}'", doc.getFilename(), trip.getTitle());
            }

            // Create structured entries based on document type
            analysis.ifPresent(a -> {
                String type = a.documentType();
                if ("flight".equals(type) && a.flight() != null) {
                    addFlightEntry(trip, a.flight());
                } else if ("accommodation".equals(type) && a.accommodation() != null) {
                    addAccommodationKeyInfo(trip, a.accommodation());
                } else if ("car_rental".equals(type)) {
                    addCarRentalKeyInfo(trip, a);
                }
            });

        } catch (Exception e) {
            log.error("Trip auto-linking failed for document {}: {}", documentId, e.getMessage(), e);
        }
    }

    // ── LLM Analysis ──────────────────────────────────────────────────────────

    private Optional<TravelDocumentAnalysis> analyzeWithOllama(String text, String folderHint) {
        if (!StringUtils.hasText(text)) {
            return Optional.empty();
        }
        String excerpt = text.length() > MAX_TEXT_FOR_LLM ? text.substring(0, MAX_TEXT_FOR_LLM) : text;
        String prompt = buildPrompt(excerpt, folderHint);
        try {
            String response = ollamaService.generate(prompt);
            return parseAnalysis(response);
        } catch (Exception e) {
            log.warn("Ollama travel analysis failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private String buildPrompt(String text, String folderHint) {
        String hint = StringUtils.hasText(folderHint) ? " The document is likely about a trip to \"" + folderHint + "\"." : "";
        return """
                Analyze this travel document and extract structured information.%s
                Respond with ONLY a JSON object. No explanation, no markdown, no code fences.

                Document:
                %s

                JSON structure:
                {
                  "documentType": "flight" or "accommodation" or "car_rental" or "general" or "not_travel",
                  "tripTitle": "short descriptive trip name",
                  "destination": "main destination city or country",
                  "startDate": "YYYY-MM-DD or null",
                  "endDate": "YYYY-MM-DD or null",
                  "flight": {
                    "flightNumber": "e.g. LH1234 or null",
                    "airline": "airline name or null",
                    "departureAirport": "IATA code or city or null",
                    "arrivalAirport": "IATA code or city or null",
                    "departureDateTime": "YYYY-MM-DDTHH:MM or null",
                    "arrivalDateTime": "YYYY-MM-DDTHH:MM or null"
                  },
                  "accommodation": {
                    "hotelName": "hotel or apartment name or null",
                    "address": "address or null",
                    "checkinDate": "YYYY-MM-DD or null",
                    "checkoutDate": "YYYY-MM-DD or null",
                    "confirmationNumber": "booking ref or null"
                  }
                }
                Set "flight" to null if not a flight document. Set "accommodation" to null if not accommodation.
                """.formatted(hint, text);
    }

    private Optional<TravelDocumentAnalysis> parseAnalysis(String raw) {
        Matcher m = JSON_PATTERN.matcher(raw);
        if (!m.find()) {
            log.debug("No JSON block found in LLM response");
            return Optional.empty();
        }
        try {
            TravelDocumentAnalysis a = objectMapper.readValue(m.group(), TravelDocumentAnalysis.class);
            if ("not_travel".equals(a.documentType())) {
                return Optional.empty();
            }
            return Optional.of(a);
        } catch (Exception e) {
            log.debug("JSON parse failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    // ── Trip find/create ───────────────────────────────────────────────────────

    private Trip findOrCreateTrip(String destination, String folderSubcategory,
                                   LocalDate startDate, LocalDate endDate,
                                   Optional<TravelDocumentAnalysis> analysis, User uploader) {
        List<Trip> all = tripRepository.findAllByOrderByStartDateDesc();

        // 1. Look for exact folder subcategory match (most reliable)
        if (StringUtils.hasText(folderSubcategory)) {
            for (Trip t : all) {
                if (t.getTitle().equalsIgnoreCase(folderSubcategory)
                        || t.getDestination().equalsIgnoreCase(folderSubcategory)) {
                    if (startDate == null || datesOverlap(t, startDate, endDate)) {
                        log.info("Matched existing trip '{}' by folder name", t.getTitle());
                        return t;
                    }
                }
            }
        }

        // 2. Partial destination match + date overlap
        for (Trip t : all) {
            boolean destMatch = destination != null &&
                    (contains(t.getDestination(), destination) || contains(destination, t.getDestination()));
            boolean dateMatch = startDate == null || datesOverlap(t, startDate, endDate);
            if (destMatch && dateMatch) {
                log.info("Matched existing trip '{}' by destination+date", t.getTitle());
                return t;
            }
        }

        // 3. Create new trip
        String title = analysis.map(TravelDocumentAnalysis::tripTitle).filter(StringUtils::hasText)
                .orElseGet(() -> {
                    String base = StringUtils.hasText(folderSubcategory) ? folderSubcategory : destination;
                    return startDate != null ? base + " " + startDate.getYear() : base;
                });
        LocalDate sd = startDate != null ? startDate : LocalDate.now();
        LocalDate ed = endDate != null ? endDate : sd.plusDays(7);

        Trip created = tripRepository.save(Trip.builder()
                .title(title)
                .destination(destination != null ? destination : (folderSubcategory != null ? folderSubcategory : "Unbekannt"))
                .startDate(sd)
                .endDate(ed)
                .createdBy(uploader)
                .build());
        log.info("Created new trip '{}'", created.getTitle());
        return created;
    }

    // ── Entry creation ─────────────────────────────────────────────────────────

    private void addFlightEntry(Trip trip, TravelDocumentAnalysis.FlightInfo f) {
        String title = buildFlightTitle(f);
        // Deduplicate: skip if an itinerary entry with same title already exists
        boolean exists = itineraryEntryRepository
                .findByTripIdOrderByEntryDateAscEntryTimeAscPositionAsc(trip.getId())
                .stream().anyMatch(e -> e.getTitle().equalsIgnoreCase(title));
        if (exists) return;

        LocalDate date = parseLocalDate(f.departureDateTime() != null
                ? f.departureDateTime().split("T")[0] : null);
        LocalTime time = parseLocalTime(f.departureDateTime());
        if (date == null) date = trip.getStartDate();

        itineraryEntryRepository.save(ItineraryEntry.builder()
                .trip(trip)
                .entryDate(date)
                .entryTime(time)
                .title(title)
                .description(buildFlightDescription(f))
                .location(f.departureAirport())
                .build());
        log.info("Added flight entry '{}' to trip '{}'", title, trip.getTitle());
    }

    private String buildFlightTitle(TravelDocumentAnalysis.FlightInfo f) {
        String num = StringUtils.hasText(f.flightNumber()) ? f.flightNumber() : "";
        String dep = StringUtils.hasText(f.departureAirport()) ? f.departureAirport() : "?";
        String arr = StringUtils.hasText(f.arrivalAirport()) ? f.arrivalAirport() : "?";
        return ("✈ " + (StringUtils.hasText(num) ? num + " " : "") + dep + " → " + arr).strip();
    }

    private String buildFlightDescription(TravelDocumentAnalysis.FlightInfo f) {
        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(f.airline())) sb.append(f.airline()).append("\n");
        if (StringUtils.hasText(f.departureDateTime())) sb.append("Abflug: ").append(f.departureDateTime()).append("\n");
        if (StringUtils.hasText(f.arrivalDateTime())) sb.append("Ankunft: ").append(f.arrivalDateTime()).append("\n");
        return sb.toString().strip();
    }

    private void addAccommodationKeyInfo(Trip trip, TravelDocumentAnalysis.AccommodationInfo a) {
        String label = StringUtils.hasText(a.hotelName()) ? a.hotelName() : "Unterkunft";
        if (keyInfoExists(trip, label)) return;

        StringBuilder val = new StringBuilder();
        if (StringUtils.hasText(a.address())) val.append(a.address()).append("\n");
        if (StringUtils.hasText(a.checkinDate())) val.append("Check-in: ").append(a.checkinDate()).append("\n");
        if (StringUtils.hasText(a.checkoutDate())) val.append("Check-out: ").append(a.checkoutDate()).append("\n");
        if (StringUtils.hasText(a.confirmationNumber())) val.append("Buchung: ").append(a.confirmationNumber()).append("\n");

        addKeyInfo(trip, label, val.toString().strip(), trip.getKeyInfos().size());
        log.info("Added accommodation '{}' to trip '{}'", label, trip.getTitle());
    }

    private void addCarRentalKeyInfo(Trip trip, TravelDocumentAnalysis a) {
        String label = "Mietwagen";
        if (keyInfoExists(trip, label)) return;
        String val = StringUtils.hasText(a.destination()) ? "Ziel: " + a.destination() : "Details im Dokument";
        addKeyInfo(trip, label, val, trip.getKeyInfos().size());
        log.info("Added car rental info to trip '{}'", trip.getTitle());
    }

    private void addKeyInfo(Trip trip, String label, String value, int position) {
        trip.getKeyInfos().add(TripKeyInfo.builder()
                .trip(trip).label(label).value(value).position(position).build());
        tripRepository.save(trip);
    }

    private boolean keyInfoExists(Trip trip, String label) {
        return trip.getKeyInfos().stream()
                .anyMatch(k -> k.getLabel().equalsIgnoreCase(label));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private boolean isPastTrip(LocalDate startDate, LocalDate endDate, Integer folderYear) {
        LocalDate today = LocalDate.now();
        // Prefer explicit dates from LLM extraction
        if (endDate != null) return endDate.isBefore(today);
        if (startDate != null) return startDate.isBefore(today.minusDays(30));
        // Fall back to folder year: skip years strictly in the past
        if (folderYear != null) return folderYear < today.getYear();
        return false; // unknown — don't skip
    }

    private String resolveDestination(Optional<TravelDocumentAnalysis> analysis, String folderSubcategory) {
        return analysis.map(TravelDocumentAnalysis::destination)
                .filter(StringUtils::hasText)
                .orElse(folderSubcategory);
    }

    private LocalDate resolveDate(String dateStr, Integer folderYear, boolean isStart) {
        LocalDate parsed = parseLocalDate(dateStr);
        if (parsed != null) return parsed;
        if (folderYear != null) {
            return isStart ? LocalDate.of(folderYear, 1, 1) : LocalDate.of(folderYear, 12, 31);
        }
        return null;
    }

    private LocalDate parseLocalDate(String s) {
        if (!StringUtils.hasText(s)) return null;
        try { return LocalDate.parse(s.length() > 10 ? s.substring(0, 10) : s); }
        catch (DateTimeParseException e) { return null; }
    }

    private LocalTime parseLocalTime(String datetime) {
        if (!StringUtils.hasText(datetime) || !datetime.contains("T")) return null;
        try { return LocalTime.parse(datetime.split("T")[1].substring(0, 5)); }
        catch (Exception e) { return null; }
    }

    private boolean datesOverlap(Trip t, LocalDate start, LocalDate end) {
        if (start == null) return true;
        LocalDate tripEnd = end != null ? end : start;
        return !t.getStartDate().isAfter(tripEnd) && !t.getEndDate().isBefore(start);
    }

    private boolean contains(String haystack, String needle) {
        return haystack != null && needle != null
                && haystack.toLowerCase().contains(needle.toLowerCase());
    }
}
