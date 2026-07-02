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
import java.util.Map;
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
    private static final Pattern IATA_PATTERN = Pattern.compile("\\b([A-Z]{3})\\b");
    private static final Pattern DD_MM_PATTERN = Pattern.compile("(\\d{1,2})\\.(\\d{2})\\.");
    private static final Pattern FOLDER_YEAR_PATTERN = Pattern.compile("^(\\d{4})");
    private static final int MAX_TEXT_FOR_LLM = 3_000;

    private static final Map<String, Integer> DE_MONTHS = Map.ofEntries(
            Map.entry("jan", 1), Map.entry("feb", 2), Map.entry("mär", 3), Map.entry("mar", 3),
            Map.entry("apr", 4), Map.entry("mai", 5), Map.entry("jun", 6), Map.entry("jul", 7),
            Map.entry("aug", 8), Map.entry("sep", 9), Map.entry("okt", 10), Map.entry("nov", 11),
            Map.entry("dez", 12));

    private final OllamaService ollamaService;
    private final TripRepository tripRepository;
    private final TripDocumentRepository tripDocumentRepository;
    private final ItineraryEntryRepository itineraryEntryRepository;
    private final DocumentRepository documentRepository;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    /**
     * Step 1: Ollama analysis — called OUTSIDE any @Transactional context so no DB connection is held
     * while waiting for the LLM. Returns empty if text is blank or LLM fails.
     */
    public Optional<TravelDocumentAnalysis> analyzeDocument(String extractedText, String folderSubcategory) {
        return analyzeWithOllama(extractedText, folderSubcategory);
    }

    /**
     * Step 2: DB work only — transaction is short because the slow Ollama call already happened.
     */
    public void autoLink(UUID documentId, Optional<TravelDocumentAnalysis> analysis,
                         String folderSubcategory, Integer folderYear, UUID uploaderId) {
        try {
            User uploader = userService.findById(uploaderId);

            String destination = resolveDestination(analysis, folderSubcategory);
            LocalDate startDate = resolveDate(analysis.map(TravelDocumentAnalysis::startDate).orElse(null), folderYear, true);
            LocalDate endDate   = resolveDate(analysis.map(TravelDocumentAnalysis::endDate).orElse(null), folderYear, false);

            if (isPastTrip(startDate, endDate, folderYear, folderSubcategory)) {
                log.info("Document {} belongs to a past trip (folder={}, year={}, start={}), skipping auto-link",
                        documentId, folderSubcategory, folderYear, startDate);
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
                log.debug("Document {} LLM type: {}", documentId, type);
                if ("flight".equals(type) && a.flight() != null) {
                    addFlightEntry(trip, a.flight());
                } else if ("accommodation".equals(type) && a.accommodation() != null) {
                    addAccommodationKeyInfo(trip, a.accommodation());
                } else if ("car_rental".equals(type)) {
                    addCarRentalKeyInfo(trip, a);
                } else {
                    log.info("Document {} classified as '{}' — no structured entry created", documentId, type);
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

                IMPORTANT: If the document is a flight booking confirmation, e-ticket, itinerary, or receipt from any airline booking site (FlightNetwork, Check24, Expedia, etc.), set documentType to "flight".
                If the document mentions car, campervan, motorhome, or vehicle rental, set documentType to "car_rental".
                If the document mentions hotel, apartment, hostel, holiday park, caravan park, resort, campground, Airbnb, guest house, or any accommodation/lodging booking, set documentType to "accommodation".

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
                    "departureAirport": "IATA code or city (e.g. ZRH or Zurich)",
                    "arrivalAirport": "IATA code or city (e.g. BNE or Brisbane)",
                    "departureDateTime": "YYYY-MM-DDTHH:MM or null",
                    "arrivalDateTime": "YYYY-MM-DDTHH:MM or null"
                  },
                  "accommodation": {
                    "hotelName": "hotel or apartment name or null",
                    "address": "address or null",
                    "checkinDate": "YYYY-MM-DD or null",
                    "checkoutDate": "YYYY-MM-DD or null",
                    "confirmationNumber": "booking ref or null"
                  },
                  "carRental": {
                    "company": "rental company name or null",
                    "vehicleType": "vehicle description or null",
                    "pickupDate": "YYYY-MM-DD or null",
                    "returnDate": "YYYY-MM-DD or null",
                    "pickupLocation": "city or address or null",
                    "returnLocation": "city or address or null",
                    "confirmationNumber": "booking ref or null"
                  }
                }
                Set "flight" to null if not a flight document. Set "accommodation" to null if not accommodation. Set "carRental" to null if not a car/vehicle rental.
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
        // Deduplicate by IATA airport codes (handles slight title variations across re-analyses)
        String depCode = extractIata(f.departureAirport());
        String arrCode = extractIata(f.arrivalAirport());
        boolean exists = itineraryEntryRepository
                .findByTripIdOrderByEntryDateAscEntryTimeAscPositionAsc(trip.getId())
                .stream().anyMatch(e -> {
                    if (!e.getTitle().startsWith("✈")) return false;
                    if (e.getTitle().equalsIgnoreCase(title)) return true;
                    // Same route by IATA codes
                    return depCode != null && arrCode != null
                            && e.getTitle().contains(depCode) && e.getTitle().contains(arrCode);
                });
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
        StringBuilder val = new StringBuilder();
        TravelDocumentAnalysis.CarRentalInfo cr = a.carRental();
        if (cr != null) {
            if (StringUtils.hasText(cr.company())) val.append(cr.company()).append("\n");
            if (StringUtils.hasText(cr.vehicleType())) val.append(cr.vehicleType()).append("\n");
            if (StringUtils.hasText(cr.pickupDate())) val.append("Abholung: ").append(cr.pickupDate());
            if (StringUtils.hasText(cr.pickupLocation())) val.append(" – ").append(cr.pickupLocation());
            if (StringUtils.hasText(cr.pickupDate()) || StringUtils.hasText(cr.pickupLocation())) val.append("\n");
            if (StringUtils.hasText(cr.returnDate())) val.append("Rückgabe: ").append(cr.returnDate());
            if (StringUtils.hasText(cr.returnLocation())) val.append(" – ").append(cr.returnLocation());
            if (StringUtils.hasText(cr.returnDate()) || StringUtils.hasText(cr.returnLocation())) val.append("\n");
            if (StringUtils.hasText(cr.confirmationNumber())) val.append("Buchung: ").append(cr.confirmationNumber()).append("\n");
        }
        if (val.isEmpty() && StringUtils.hasText(a.destination())) val.append("Ziel: ").append(a.destination());
        if (val.isEmpty()) val.append("Details im Dokument");
        addKeyInfo(trip, label, val.toString().strip(), trip.getKeyInfos().size());
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

    private boolean isPastTrip(LocalDate startDate, LocalDate endDate, Integer folderYear, String folderSubcategory) {
        LocalDate today = LocalDate.now();
        // 1. Explicit dates from LLM are most reliable
        if (endDate != null) return endDate.isBefore(today);
        if (startDate != null) return startDate.isBefore(today.minusDays(30));
        // 2. Try to extract month (and day) from German folder name like "01_Berlin_Mai_2026" or "4_Australien_10.08._02.09.2026"
        LocalDate folderDate = parseFolderStartDate(folderSubcategory, folderYear);
        if (folderDate != null) return folderDate.isBefore(today.minusDays(30));
        // 3. Year-only fallback: strictly past years
        if (folderYear != null) return folderYear < today.getYear();
        return false;
    }

    /**
     * Extracts an approximate start date from a folder name.
     * Understands German month abbreviations (Mai, Jun, …) and DD.MM. patterns.
     * Also detects folders that open with a year (e.g. "2015 und älter") and treats them as very old.
     */
    private LocalDate parseFolderStartDate(String folder, Integer folderYear) {
        if (!StringUtils.hasText(folder)) return null;
        LocalDate today = LocalDate.now();

        // Folder starts with 4-digit year < 2 years ago → treat as old
        Matcher yearStart = FOLDER_YEAR_PATTERN.matcher(folder);
        if (yearStart.find()) {
            int yr = Integer.parseInt(yearStart.group(1));
            if (yr < today.getYear() - 1) return LocalDate.of(yr, 12, 31);
        }

        int yr = folderYear != null ? folderYear : today.getYear();

        // German month name (3-letter prefix)
        String lower = folder.toLowerCase();
        for (Map.Entry<String, Integer> e : DE_MONTHS.entrySet()) {
            if (lower.contains(e.getKey())) {
                return LocalDate.of(yr, e.getValue(), 1);
            }
        }

        // DD.MM. date pattern — first occurrence is the start date
        Matcher dm = DD_MM_PATTERN.matcher(folder);
        if (dm.find()) {
            int day = Integer.parseInt(dm.group(1));
            int month = Integer.parseInt(dm.group(2));
            try { return LocalDate.of(yr, month, day); } catch (Exception ignore) {}
        }

        return null;
    }

    private String extractIata(String airport) {
        if (!StringUtils.hasText(airport)) return null;
        Matcher m = IATA_PATTERN.matcher(airport.toUpperCase());
        return m.find() ? m.group(1) : null;
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
