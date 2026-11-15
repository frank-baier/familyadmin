package de.baier.familyadmin.service;

import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Parses Strava's bulk export ("Download your account" ZIP) — or just the activities.csv inside it —
 * into neutral activity rows.
 *
 * Quirks of activities.csv handled here:
 * - Several column names occur twice (Distance, Elapsed Time, Max Heart Rate, Relative Effort, Commute).
 *   The first block uses display units (Distance in km/mi), the later "detailed" block uses SI units
 *   (Distance in metres). The later occurrence is preferred.
 * - "Activity Date" is UTC, formatted like "Mar 15, 2021, 6:02:55 PM" (English) — other locales are tried too.
 * - Descriptions may contain commas, quotes and newlines (RFC 4180 quoting).
 */
@Component
public class StravaExportParser {

    public record ParsedActivity(
            String externalId, String name, String sportType, Instant startTime,
            Integer elapsedSeconds, Integer movingSeconds, Double distanceM, Double elevationGainM,
            Double avgHeartRate, Double maxHeartRate, Double avgSpeedMps, Double maxSpeedMps,
            Double avgWatts, Double calories, Double relativeEffort, boolean commute) {}

    public record ParseResult(List<ParsedActivity> activities, List<String> warnings) {}

    private enum Field {
        ID("activityid", "aktivitätsid", "aktivitäts-id"),
        DATE("activitydate", "aktivitätsdatum", "datumderaktivität"),
        NAME("activityname", "aktivitätsname", "namederaktivität"),
        TYPE("activitytype", "aktivitätsart", "aktivitätstyp", "sportart"),
        ELAPSED("elapsedtime", "verstrichenezeit", "gesamtzeit", "vergangenezeit"),
        MOVING("movingtime", "bewegungszeit", "zeitinbewegung"),
        DISTANCE("distance", "distanz", "strecke", "entfernung"),
        ELEVATION_GAIN("elevationgain", "höhengewinn", "anstieg", "höhenmeter", "höhenunterschied"),
        MAX_HR("maxheartrate", "maxherzfrequenz", "maximaleherzfrequenz"),
        AVG_HR("averageheartrate", "durchschnittlicheherzfrequenz", "durchschnherzfrequenz", "øherzfrequenz"),
        AVG_SPEED("averagespeed", "durchschnittsgeschwindigkeit", "durchschnittlichegeschwindigkeit"),
        MAX_SPEED("maxspeed", "maximalgeschwindigkeit", "maxgeschwindigkeit", "höchstgeschwindigkeit"),
        AVG_WATTS("averagewatts", "durchschnittlichewatt", "durchschnittswatt", "durchschnittlicheleistung"),
        CALORIES("calories", "kalorien"),
        RELATIVE_EFFORT("relativeeffort", "relativeanstrengung", "relativeleistung"),
        COMMUTE("commute", "pendeln", "pendelfahrt", "arbeitsweg");

        final List<String> aliases;

        Field(String... aliases) {
            this.aliases = Arrays.stream(aliases).map(StravaExportParser::normalizeHeader).toList();
        }
    }

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            formatter("MMM d, yyyy, h:mm:ss a", Locale.ENGLISH),
            formatter("MMM d, yyyy, H:mm:ss", Locale.ENGLISH),
            formatter("d MMM yyyy, HH:mm:ss", Locale.ENGLISH),
            formatter("d MMM yyyy, HH:mm:ss", Locale.GERMAN),
            formatter("d. MMM yyyy, HH:mm:ss", Locale.GERMAN),
            formatter("dd.MM.yyyy, HH:mm:ss", Locale.GERMAN),
            formatter("dd.MM.yyyy HH:mm:ss", Locale.GERMAN),
            formatter("yyyy-MM-dd HH:mm:ss", Locale.ROOT),
            formatter("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT)
    );

    private static DateTimeFormatter formatter(String pattern, Locale locale) {
        return new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern(pattern).toFormatter(locale);
    }

    /** Accepts either the full export ZIP or a bare activities.csv. */
    public ParseResult parse(InputStream in, String filename) throws IOException {
        String lower = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".zip")) {
            try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(in), StandardCharsets.UTF_8)) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    String name = entry.getName().replace('\\', '/');
                    if (!entry.isDirectory() && (name.equals("activities.csv") || name.endsWith("/activities.csv"))) {
                        // Do not close: closing the reader would close the ZIP stream.
                        return parseCsv(new InputStreamReader(zip, StandardCharsets.UTF_8));
                    }
                }
            }
            throw new IllegalArgumentException(
                    "Keine activities.csv im ZIP gefunden — ist das der Strava-Konto-Export?");
        }
        return parseCsv(new InputStreamReader(in, StandardCharsets.UTF_8));
    }

    ParseResult parseCsv(Reader reader) throws IOException {
        CsvReader csv = new CsvReader(new BufferedReader(reader));
        List<String> header = csv.next();
        if (header == null || header.isEmpty()) {
            throw new IllegalArgumentException("activities.csv ist leer.");
        }

        Map<Field, List<Integer>> columns = mapColumns(header);
        List<Field> missing = new ArrayList<>();
        for (Field required : List.of(Field.ID, Field.DATE, Field.TYPE)) {
            if (!columns.containsKey(required)) missing.add(required);
        }
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Unbekanntes CSV-Format — Pflichtspalten fehlen " + missing
                    + ". Gefundene Spalten: " + String.join(", ", header.subList(0, Math.min(header.size(), 12))) + " …");
        }

        List<ParsedActivity> result = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<String> row;
        int line = 1;
        while ((row = csv.next()) != null) {
            line++;
            if (row.size() == 1 && row.get(0).isBlank()) continue;
            try {
                result.add(toActivity(row, columns));
            } catch (RuntimeException e) {
                if (warnings.size() < 20) warnings.add("Zeile " + line + " übersprungen: " + e.getMessage());
            }
        }
        if (warnings.size() == 20) warnings.add("… weitere Zeilen übersprungen.");
        return new ParseResult(result, warnings);
    }

    private Map<Field, List<Integer>> mapColumns(List<String> header) {
        Map<Field, List<Integer>> columns = new EnumMap<>(Field.class);
        for (int i = 0; i < header.size(); i++) {
            String h = normalizeHeader(header.get(i));
            for (Field f : Field.values()) {
                if (f.aliases.contains(h)) {
                    columns.computeIfAbsent(f, k -> new ArrayList<>()).add(i);
                    break;
                }
            }
        }
        return columns;
    }

    private ParsedActivity toActivity(List<String> row, Map<Field, List<Integer>> columns) {
        String id = first(row, columns, Field.ID);
        if (id == null) throw new IllegalArgumentException("keine Activity ID");
        String type = first(row, columns, Field.TYPE);
        if (type == null) throw new IllegalArgumentException("kein Aktivitätstyp");
        Instant start = parseDate(first(row, columns, Field.DATE));

        Integer elapsed = toInt(latest(row, columns, Field.ELAPSED));
        Integer moving = toInt(latest(row, columns, Field.MOVING));
        Double distanceM = distanceMetres(row, columns.get(Field.DISTANCE));
        Double avgSpeed = toDouble(latest(row, columns, Field.AVG_SPEED));
        if ((avgSpeed == null || avgSpeed <= 0) && distanceM != null && distanceM > 0) {
            Integer t = moving != null && moving > 0 ? moving : elapsed;
            if (t != null && t > 0) avgSpeed = distanceM / t;
        }

        String commute = latest(row, columns, Field.COMMUTE);
        return new ParsedActivity(
                id.trim(),
                first(row, columns, Field.NAME),
                type.trim(),
                start,
                elapsed, moving, distanceM,
                positiveOrNull(toDouble(latest(row, columns, Field.ELEVATION_GAIN))),
                positiveOrNull(toDouble(latest(row, columns, Field.AVG_HR))),
                positiveOrNull(toDouble(latest(row, columns, Field.MAX_HR))),
                positiveOrNull(avgSpeed),
                positiveOrNull(toDouble(latest(row, columns, Field.MAX_SPEED))),
                positiveOrNull(toDouble(latest(row, columns, Field.AVG_WATTS))),
                positiveOrNull(toDouble(latest(row, columns, Field.CALORIES))),
                positiveOrNull(toDouble(latest(row, columns, Field.RELATIVE_EFFORT))),
                commute != null && (commute.equalsIgnoreCase("true") || commute.equals("1")));
    }

    /** With two Distance columns the later one is metres; a lone Distance column is km. */
    private Double distanceMetres(List<String> row, List<Integer> idx) {
        if (idx == null || idx.isEmpty()) return null;
        if (idx.size() >= 2) {
            Double metres = toDouble(cell(row, idx.get(idx.size() - 1)));
            if (metres != null) return metres;
        }
        Double km = toDouble(cell(row, idx.get(0)));
        return km == null ? null : km * 1000.0;
    }

    private static String first(List<String> row, Map<Field, List<Integer>> columns, Field f) {
        List<Integer> idx = columns.get(f);
        if (idx == null) return null;
        for (int i : idx) {
            String v = cell(row, i);
            if (v != null) return v;
        }
        return null;
    }

    private static String latest(List<String> row, Map<Field, List<Integer>> columns, Field f) {
        List<Integer> idx = columns.get(f);
        if (idx == null) return null;
        for (int i = idx.size() - 1; i >= 0; i--) {
            String v = cell(row, idx.get(i));
            if (v != null) return v;
        }
        return null;
    }

    private static String cell(List<String> row, int i) {
        if (i >= row.size()) return null;
        String v = row.get(i).trim();
        return v.isEmpty() ? null : v;
    }

    static Instant parseDate(String raw) {
        if (raw == null) throw new IllegalArgumentException("kein Datum");
        String v = raw.replace(' ', ' ').replace(' ', ' ').trim();
        try {
            return OffsetDateTime.parse(v).toInstant();
        } catch (DateTimeParseException ignored) {
            // fall through to local formats
        }
        for (DateTimeFormatter f : DATE_FORMATS) {
            try {
                return LocalDateTime.parse(v, f).toInstant(ZoneOffset.UTC);
            } catch (DateTimeParseException ignored) {
                // try next
            }
        }
        throw new IllegalArgumentException("unbekanntes Datumsformat '" + raw + "'");
    }

    static Double toDouble(String raw) {
        if (raw == null) return null;
        String v = raw.trim();
        if (v.isEmpty()) return null;
        if (v.contains(",") && v.contains(".")) {
            v = v.replace(",", "");            // 1,234.5
        } else if (v.contains(",")) {
            v = v.replace(',', '.');           // 12,5
        }
        try {
            double d = Double.parseDouble(v);
            return Double.isFinite(d) ? d : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer toInt(String raw) {
        Double d = toDouble(raw);
        return d == null ? null : (int) Math.round(d);
    }

    private static Double positiveOrNull(Double d) {
        return d != null && d > 0 ? d : null;
    }

    static String normalizeHeader(String h) {
        return h.replace("﻿", "").toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }

    /** Minimal RFC 4180 reader: quoted fields, escaped quotes, newlines inside quotes. */
    static final class CsvReader {
        private final Reader in;
        private boolean eof = false;

        CsvReader(Reader in) {
            this.in = in;
        }

        List<String> next() throws IOException {
            if (eof) return null;
            List<String> fields = new ArrayList<>();
            StringBuilder cur = new StringBuilder();
            boolean quoted = false;
            boolean any = false;
            int c;
            while (true) {
                c = in.read();
                if (c == -1) {
                    eof = true;
                    if (!any && cur.isEmpty() && fields.isEmpty()) return null;
                    fields.add(cur.toString());
                    return fields;
                }
                any = true;
                char ch = (char) c;
                if (quoted) {
                    if (ch == '"') {
                        in.mark(1);
                        int n = in.read();
                        if (n == '"') {
                            cur.append('"');
                        } else {
                            quoted = false;
                            if (n == -1) {
                                eof = true;
                                fields.add(cur.toString());
                                return fields;
                            }
                            in.reset();
                        }
                    } else {
                        cur.append(ch);
                    }
                } else if (ch == '"') {
                    quoted = true;
                } else if (ch == ',') {
                    fields.add(cur.toString());
                    cur.setLength(0);
                } else if (ch == '\n') {
                    fields.add(cur.toString());
                    return fields;
                } else if (ch != '\r') {
                    cur.append(ch);
                }
            }
        }
    }
}
