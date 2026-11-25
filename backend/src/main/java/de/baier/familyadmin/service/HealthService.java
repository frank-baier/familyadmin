package de.baier.familyadmin.service;

import com.fasterxml.jackson.databind.JsonNode;
import de.baier.familyadmin.dto.HealthDailyResponse;
import de.baier.familyadmin.dto.HealthIngestResult;
import de.baier.familyadmin.dto.HealthTokenResponse;
import de.baier.familyadmin.model.HealthDailyMetric;
import de.baier.familyadmin.model.HealthMetric;
import de.baier.familyadmin.model.HealthSyncToken;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.HealthDailyMetricRepository;
import de.baier.familyadmin.repository.HealthSyncTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Apple Health sync. Apple offers no server API, so an iOS Shortcuts automation on the iPhone
 * reads the day's values and POSTs them here, authenticated with a per-user sync token.
 * Data is strictly per user and must never be fed into the RAG chatbot.
 */
@Service
@RequiredArgsConstructor
public class HealthService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern NUMBER = Pattern.compile("-?\\d+(?:\\.\\d+)?");
    private static final ZoneId ZONE = ZoneId.of("Europe/Zurich");
    private static final int MAX_DAYS_PER_REQUEST = 400;

    private final HealthDailyMetricRepository metricRepository;
    private final HealthSyncTokenRepository tokenRepository;

    // ─── Ingest (called by the iOS Shortcut, token-authenticated) ─────────────

    /**
     * Accepts one day as a flat object {"date":"2026-11-24","steps":8421,...}
     * or several as {"days":[{...},{...}]}. Unknown keys and implausible values become warnings.
     */
    @Transactional
    public HealthIngestResult ingest(String rawToken, JsonNode payload) {
        HealthSyncToken token = resolveToken(rawToken);
        if (payload == null || !payload.isObject()) {
            throw new IllegalArgumentException("JSON-Objekt erwartet.");
        }

        List<JsonNode> days = new ArrayList<>();
        if (payload.has("days") && payload.get("days").isArray()) {
            payload.get("days").forEach(days::add);
        } else {
            days.add(payload);
        }
        if (days.size() > MAX_DAYS_PER_REQUEST) {
            throw new IllegalArgumentException("Maximal " + MAX_DAYS_PER_REQUEST + " Tage pro Anfrage.");
        }

        List<String> warnings = new ArrayList<>();
        int saved = 0;
        LocalDate today = LocalDate.now(ZONE);
        for (JsonNode day : days) {
            LocalDate date = parseDate(day.path("date").asText(null));
            if (date == null) {
                warnings.add("Eintrag ohne gültiges Datum (yyyy-MM-dd) übersprungen.");
                continue;
            }
            if (date.isAfter(today.plusDays(1)) || date.isBefore(today.minusYears(20))) {
                warnings.add(date + ": Datum außerhalb des gültigen Bereichs.");
                continue;
            }
            Iterator<Map.Entry<String, JsonNode>> fields = day.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> f = fields.next();
                String key = f.getKey();
                if (key.equals("date")) continue;

                Double value = parseNumber(f.getValue());
                if (value == null) continue; // empty value: no data that day, not an error

                // Shortcuts deliver durations in seconds or minutes — accept both for sleep.
                if (key.equalsIgnoreCase("sleep_seconds")) { key = "sleep_hours"; value = value / 3600; }
                else if (key.equalsIgnoreCase("sleep_minutes")) { key = "sleep_hours"; value = value / 60; }

                Optional<HealthMetric> metric = HealthMetric.fromKey(key);
                if (metric.isEmpty()) {
                    warnings.add("Unbekannter Wert „" + key + "“ ignoriert.");
                    continue;
                }
                HealthMetric m = metric.get();
                if (value < m.min || value > m.max) {
                    // 0 is how Shortcuts reports "no samples" for averages — skip silently.
                    if (value != 0) warnings.add(date + " " + m.key + "=" + value + " unplausibel, ignoriert.");
                    continue;
                }
                metricRepository.upsert(token.getUserId(), date, m.key, value);
                saved++;
            }
        }
        token.setLastUsedAt(Instant.now());
        tokenRepository.save(token);
        return new HealthIngestResult(saved, warnings);
    }

    private HealthSyncToken resolveToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sync-Token fehlt.");
        }
        return tokenRepository.findByTokenHash(sha256(rawToken.trim()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Ungültiger Sync-Token."));
    }

    static LocalDate parseDate(String s) {
        if (s == null || s.length() < 10) return null;
        try {
            return LocalDate.parse(s.substring(0, 10)); // tolerates full ISO timestamps
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** Accepts JSON numbers and strings like "8’421", "78,4 kg" or "7.2 h". */
    static Double parseNumber(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isNumber()) return node.asDouble();
        if (!node.isTextual()) return null;
        String s = node.asText().replaceAll("[\\s'’]", "");
        if (s.contains(",") && s.contains(".")) s = s.replace(",", "");
        else s = s.replace(',', '.');
        Matcher m = NUMBER.matcher(s);
        return m.find() ? Double.parseDouble(m.group()) : null;
    }

    // ─── Read (JWT, current user only) ───────────────────────────────────────

    @Transactional(readOnly = true)
    public HealthDailyResponse getDaily(User user, int days) {
        int span = Math.max(1, Math.min(days, 3650));
        LocalDate from = LocalDate.now(ZONE).minusDays(span - 1L);
        Map<LocalDate, Map<String, Double>> byDate = new TreeMap<>();
        for (HealthDailyMetric m : metricRepository
                .findByUserIdAndMetricDateGreaterThanEqualOrderByMetricDateAsc(user.getId(), from)) {
            byDate.computeIfAbsent(m.getMetricDate(), d -> new TreeMap<>()).put(m.getMetric(), m.getValue());
        }
        List<HealthDailyResponse.Day> list = byDate.entrySet().stream()
                .map(e -> new HealthDailyResponse.Day(e.getKey(), e.getValue()))
                .toList();
        Instant lastSync = tokenRepository.findById(user.getId()).map(HealthSyncToken::getLastUsedAt).orElse(null);
        return new HealthDailyResponse(list, lastSync);
    }

    @Transactional
    public long deleteAll(User user) {
        return metricRepository.deleteByUserId(user.getId());
    }

    // ─── Token management (JWT, current user only) ───────────────────────────

    @Transactional(readOnly = true)
    public HealthTokenResponse getTokenStatus(User user) {
        return tokenRepository.findById(user.getId())
                .map(t -> new HealthTokenResponse(true, t.getCreatedAt(), t.getLastUsedAt(), null))
                .orElse(new HealthTokenResponse(false, null, null, null));
    }

    /** Creates or replaces the user's token; the plain value is returned exactly once. */
    @Transactional
    public HealthTokenResponse rotateToken(User user) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = "fah_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        HealthSyncToken t = tokenRepository.findById(user.getId())
                .orElseGet(() -> HealthSyncToken.builder().userId(user.getId()).build());
        t.setTokenHash(sha256(raw));
        t.setCreatedAt(Instant.now());
        t.setLastUsedAt(null);
        tokenRepository.save(t);
        return new HealthTokenResponse(true, t.getCreatedAt(), null, raw);
    }

    @Transactional
    public void revokeToken(User user) {
        tokenRepository.deleteById(user.getId());
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
