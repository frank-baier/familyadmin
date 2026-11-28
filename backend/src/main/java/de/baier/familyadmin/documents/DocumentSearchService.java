package de.baier.familyadmin.documents;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.ai.AnthropicChatService;
import de.baier.familyadmin.ai.AnthropicCreditAlertService;
import de.baier.familyadmin.ai.OllamaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.Instant;
import java.time.Year;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Finds documents (not answers): "Fernwärmevertrag" or "alle Rechnungen zum Thema Fernwärme".
 *
 * <ol>
 *   <li>Claude Haiku turns the query into topic terms (incl. synonyms and compound parts),
 *       document types and years. Without Claude the words of the query are used.</li>
 *   <li>Three signals per document: topic terms in file name / folder path, German full-text
 *       match in the indexed text, and semantic closeness (bge-m3 embeddings).</li>
 *   <li>The score is weighted by document type and year, identical copies in several
 *       folders are merged into one hit.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentSearchService {

    static final int MAX_RESULTS = 60;
    private static final int VECTOR_CANDIDATES = 60;
    /** bge-m3 cosine distances lie close together; only chunks near the best one count. */
    private static final double VECTOR_WINDOW = 0.045;
    private static final double MIN_SCORE = 0.12;
    private static final int PLAN_CACHE_SIZE = 300;

    private static final String PLAN_PROMPT = """
            Du übersetzt eine Suchanfrage für ein privates Familien-Dokumentenarchiv (deutsch, Dateien wie
            "Re_Stadtwerke_05.2026.pdf" in Ordnern wie "Lieferanten/Heizung") in Suchbegriffe.

            Antworte nur mit JSON:
            {"terms": [...], "types": [...], "years": [...]}

            - terms: 1–8 Begriffe für das THEMA (Gegenstand, Firma, Person, Ort). Zerlege zusammengesetzte
              Wörter und ergänze gängige Synonyme und Fachbegriffe, z.B. "Fernwärmevertrag" →
              ["Fernwärme", "Wärmelieferung", "Wärmenetz", "Nahwärme", "Hausanschluss"].
              Keine Dokumenttypen, keine allgemeinen Wörter wie "Dokument", "alle", "Thema".
            - types: gewünschte Dokumentart mit Varianten, z.B. Rechnung → ["Rechnung", "Abrechnung", "Re",
              "Invoice", "Quittung"]; Vertrag → ["Vertrag", "Vereinbarung", "Police"]. Leer, wenn keine genannt.
            - years: genannte Jahre als Zahlen (heute ist %d; "letztes Jahr" = %d). Leer, wenn keine genannt.""";

    private final AnthropicChatService anthropicChatService;
    private final AnthropicCreditAlertService creditAlertService;
    private final OllamaService ollamaService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    private final Map<String, Plan> planCache = Collections.synchronizedMap(
            new LinkedHashMap<>(64, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Plan> eldest) {
                    return size() > PLAN_CACHE_SIZE;
                }
            });

    // ─── Public API ───────────────────────────────────────────────────────────

    public record Plan(List<String> terms, List<String> types, List<Integer> years,
                       String model, BigDecimal costUsd) {}

    public record Hit(UUID id, String filename, String contentType, long fileSize,
                      String category, String subcategory, Integer year, Instant createdAt,
                      String downloadUrl, String snippet, List<String> matchedBy,
                      List<String> alsoIn, double score) {}

    public record SearchResponse(String query, List<String> terms, List<String> types, List<Integer> years,
                                 List<Hit> results, String model, BigDecimal costUsd, long durationMs) {}

    public SearchResponse search(String rawQuery, UUID userId) {
        long start = System.currentTimeMillis();
        String query = rawQuery == null ? "" : rawQuery.strip();
        if (query.isEmpty()) {
            return new SearchResponse(query, List.of(), List.of(), List.of(), List.of(), null, BigDecimal.ZERO, 0);
        }

        Plan plan;
        float[] embedding;
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var planF = CompletableFuture.supplyAsync(() -> plan(query), executor);
            var embF = CompletableFuture.supplyAsync(() -> embed(query), executor);
            plan = planF.join();
            embedding = embF.join();
        }

        List<Meta> docs = visibleDocuments(userId);
        Map<UUID, Meta> byId = docs.stream().collect(Collectors.toMap(Meta::id, m -> m));

        Map<UUID, Double> text = textMatches(plan.terms());
        Map<UUID, Double> vector = embedding == null ? Map.of() : vectorMatches(embedding);

        List<Scored> scored = new ArrayList<>();
        for (Meta doc : docs) {
            Scored s = score(doc, plan, text.get(doc.id()), vector.get(doc.id()));
            if (s != null) scored.add(s);
        }
        scored.sort(Comparator.comparingDouble(Scored::score).reversed());

        List<Scored> merged = mergeCopies(scored);
        if (merged.size() > MAX_RESULTS) merged = merged.subList(0, MAX_RESULTS);

        Map<UUID, String> snippets = snippets(
                merged.stream().filter(s -> s.matchedBy().contains("Inhalt")).map(s -> s.doc().id()).toList(),
                plan.terms());

        List<Hit> hits = merged.stream().map(s -> {
            Meta d = s.doc();
            return new Hit(d.id(), d.filename(), d.contentType(), d.fileSize(), d.category(), d.subcategory(),
                    d.year(), d.createdAt(), "/api/documents/" + d.id() + "/download",
                    snippets.get(d.id()), s.matchedBy(), s.alsoIn(), Math.round(s.score() * 1000) / 1000.0);
        }).toList();

        long duration = System.currentTimeMillis() - start;
        log.info("Document search '{}' → terms {} types {} years {}: {} hits ({} ms)",
                query, plan.terms(), plan.types(), plan.years(), hits.size(), duration);
        return new SearchResponse(query, plan.terms(), plan.types(), plan.years(), hits,
                plan.model(), plan.costUsd(), duration);
    }

    // ─── Query understanding ──────────────────────────────────────────────────

    Plan plan(String query) {
        String key = query.toLowerCase(Locale.ROOT);
        Plan cached = planCache.get(key);
        if (cached != null) return new Plan(cached.terms(), cached.types(), cached.years(), cached.model(), BigDecimal.ZERO);

        Plan plan = null;
        if (anthropicChatService.isConfigured()) {
            try {
                int year = Year.now().getValue();
                var result = anthropicChatService.complete(PLAN_PROMPT.formatted(year, year - 1), "Suche: " + query);
                plan = parsePlan(result.text(), query, anthropicChatService.model(), result.costUsd());
            } catch (Exception e) {
                log.warn("Search query interpretation failed, using plain words: {}", e.getMessage());
                if (AnthropicCreditAlertService.isCreditExhausted(e)) {
                    creditAlertService.notifyCreditExhausted("Dokumentensuche");
                }
            }
        }
        if (plan == null) plan = fallbackPlan(query);
        else planCache.put(key, plan);
        return plan;
    }

    Plan parsePlan(String answer, String query, String model, BigDecimal cost) {
        int s = answer.indexOf('{');
        int e = answer.lastIndexOf('}');
        if (s < 0 || e <= s) return fallbackPlan(query);
        try {
            JsonNode json = objectMapper.readTree(answer.substring(s, e + 1));
            List<String> terms = strings(json.get("terms"), 10);
            List<String> types = strings(json.get("types"), 10);
            List<Integer> years = new ArrayList<>();
            if (json.has("years") && json.get("years").isArray()) {
                json.get("years").forEach(y -> {
                    int v = y.asInt(0);
                    if (v >= 1950 && v <= 2100 && !years.contains(v)) years.add(v);
                });
            }
            if (terms.isEmpty() && types.isEmpty() && years.isEmpty()) return fallbackPlan(query);
            return new Plan(terms, types, years, model, cost);
        } catch (Exception ex) {
            return fallbackPlan(query);
        }
    }

    private static List<String> strings(JsonNode node, int max) {
        List<String> out = new ArrayList<>();
        if (node == null || !node.isArray()) return out;
        for (JsonNode n : node) {
            String v = n.asText("").strip();
            if (!v.isEmpty() && v.length() <= 60 && out.stream().noneMatch(v::equalsIgnoreCase)) out.add(v);
            if (out.size() >= max) break;
        }
        return out;
    }

    private static final Set<String> STOPWORDS = Set.of(
            "alle", "allen", "aller", "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "zum",
            "zur", "von", "vom", "mit", "für", "fuer", "und", "oder", "thema", "zeige", "zeig", "mir", "meine",
            "mein", "unsere", "unser", "dokument", "dokumente", "datei", "dateien", "über", "ueber", "bitte", "wo",
            "ist", "sind", "im", "in", "am", "an", "auf", "aus");
    private static final Pattern YEAR = Pattern.compile("\\b(19[5-9]\\d|20\\d{2})\\b");

    static Plan fallbackPlan(String query) {
        List<Integer> years = new ArrayList<>();
        Matcher m = YEAR.matcher(query);
        while (m.find()) years.add(Integer.parseInt(m.group(1)));
        List<String> terms = Arrays.stream(query.split("[^\\p{L}\\p{N}]+"))
                .filter(w -> w.length() >= 3 && !STOPWORDS.contains(w.toLowerCase(Locale.ROOT)) && !YEAR.matcher(w).matches())
                .distinct()
                .toList();
        return new Plan(terms, List.of(), years, null, BigDecimal.ZERO);
    }

    private float[] embed(String query) {
        try {
            return ollamaService.embed(query);
        } catch (Exception e) {
            log.warn("Embedding for search failed, searching without semantics: {}", e.getMessage());
            return null;
        }
    }

    // ─── Retrieval ────────────────────────────────────────────────────────────

    record Meta(UUID id, String filename, String contentType, long fileSize, String category,
                String subcategory, Integer year, Instant createdAt) {
        String path() {
            if (category == null || category.isBlank()) return subcategory == null ? "" : subcategory;
            return subcategory == null || subcategory.isBlank() ? category : category + "/" + subcategory;
        }
    }

    private List<Meta> visibleDocuments(UUID userId) {
        return jdbcTemplate.query("""
                SELECT id, filename, content_type, file_size, category, subcategory, year, created_at
                FROM documents d
                WHERE d.uploaded_by = ?
                   OR d.uploaded_by IN (SELECT owner_id FROM user_document_shares WHERE shared_with_id = ?)
                """,
                (rs, i) -> {
                    Timestamp ts = rs.getTimestamp("created_at");
                    return new Meta(rs.getObject("id", UUID.class), rs.getString("filename"),
                            rs.getString("content_type"), rs.getLong("file_size"), rs.getString("category"),
                            rs.getString("subcategory"), rs.getObject("year", Integer.class),
                            ts == null ? null : ts.toInstant());
                },
                userId, userId);
    }

    /** Best full-text rank per document, normalised to 0..1. */
    private Map<UUID, Double> textMatches(List<String> terms) {
        String tsquery = tsquery(terms);
        if (tsquery.isEmpty()) return Map.of();
        Map<UUID, Double> raw = new HashMap<>();
        jdbcTemplate.query("""
                SELECT dc.document_id, MAX(ts_rank_cd(dc.search_tsv, q.tsq)) AS rank
                FROM document_chunks dc, (SELECT to_tsquery('german', ?) AS tsq) q
                WHERE dc.search_tsv @@ q.tsq
                GROUP BY dc.document_id
                ORDER BY rank DESC
                LIMIT 400
                """,
                rs -> { raw.put(rs.getObject("document_id", UUID.class), rs.getDouble("rank")); },
                tsquery);
        double max = raw.values().stream().mapToDouble(Double::doubleValue).max().orElse(0);
        if (max <= 0) return Map.of();
        // sqrt flattens the curve: a document mentioning the topic once is still a real hit.
        Map<UUID, Double> out = new HashMap<>();
        raw.forEach((id, r) -> out.put(id, Math.sqrt(r / max)));
        return out;
    }

    /** Closeness 0..1 of each document's best chunk relative to the best chunk overall. */
    private Map<UUID, Double> vectorMatches(float[] embedding) {
        StringBuilder vec = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) vec.append(',');
            vec.append(embedding[i]);
        }
        vec.append(']');
        Map<UUID, Double> dist = new LinkedHashMap<>();
        jdbcTemplate.query("""
                SELECT document_id, MIN(dist) AS dist FROM (
                    SELECT document_id, embedding <=> ?::vector AS dist
                    FROM document_chunks
                    WHERE embedding IS NOT NULL
                    ORDER BY dist
                    LIMIT ?
                ) v GROUP BY document_id ORDER BY dist
                """,
                rs -> { dist.put(rs.getObject("document_id", UUID.class), rs.getDouble("dist")); },
                vec.toString(), VECTOR_CANDIDATES);
        if (dist.isEmpty()) return Map.of();
        double best = dist.values().iterator().next();
        Map<UUID, Double> out = new HashMap<>();
        dist.forEach((id, d) -> {
            double closeness = 1.0 - (d - best) / VECTOR_WINDOW;
            if (closeness > 0) out.put(id, closeness);
        });
        return out;
    }

    private Map<UUID, String> snippets(List<UUID> ids, List<String> terms) {
        String tsquery = tsquery(terms);
        if (ids.isEmpty() || tsquery.isEmpty()) return Map.of();
        Map<UUID, String> out = new HashMap<>();
        jdbcTemplate.query("""
                SELECT DISTINCT ON (dc.document_id) dc.document_id,
                       ts_headline('german', dc.chunk_text, q.tsq,
                                   'StartSel=[[, StopSel=]], MaxWords=28, MinWords=12, MaxFragments=1') AS snippet
                FROM document_chunks dc, (SELECT to_tsquery('german', ?) AS tsq) q
                WHERE dc.document_id = ANY(?) AND dc.search_tsv @@ q.tsq
                ORDER BY dc.document_id, ts_rank_cd(dc.search_tsv, q.tsq) DESC
                """,
                rs -> {
                    String snippet = rs.getString("snippet");
                    if (snippet != null) out.put(rs.getObject("document_id", UUID.class),
                            snippet.replaceAll("\\s+", " ").strip());
                },
                tsquery, ids.toArray(new UUID[0]));
        return out;
    }

    /** "Fernwärme", "Wärme Lieferung" → "(fernwärme:*) | (wärme:* & lieferung:*)". */
    static String tsquery(List<String> terms) {
        List<String> parts = new ArrayList<>();
        for (String term : terms) {
            List<String> words = Arrays.stream(term.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+"))
                    .filter(w -> w.length() >= 3)
                    .map(w -> w + ":*")
                    .toList();
            if (!words.isEmpty()) parts.add("(" + String.join(" & ", words) + ")");
        }
        return String.join(" | ", parts);
    }

    // ─── Scoring ──────────────────────────────────────────────────────────────

    record Scored(Meta doc, double score, List<String> matchedBy, List<String> alsoIn) {}

    static Scored score(Meta doc, Plan plan, Double text, Double vector) {
        String name = fold(doc.filename());
        String path = fold(doc.path());
        Set<String> nameTokens = tokens(doc.filename());
        Set<String> pathTokens = tokens(doc.path());

        double nameScore = 0;
        int nameHits = 0;
        boolean inName = false, inPath = false;
        for (String term : plan.terms()) {
            if (matches(term, name, nameTokens)) { inName = true; nameHits++; }
            else if (matches(term, path, pathTokens)) { inPath = true; nameHits++; }
        }
        if (nameHits > 0) nameScore = (inName ? 1.0 : 0.75) + 0.15 * (nameHits - 1);

        double textScore = text == null ? 0 : text;
        double vectorScore = vector == null ? 0 : vector;
        double base = 0.55 * Math.min(nameScore, 1.3) + 0.35 * textScore + 0.3 * vectorScore;

        boolean typeOnly = plan.terms().isEmpty() && !plan.types().isEmpty();
        boolean typeInName = plan.types().stream().anyMatch(t -> matches(t, name, nameTokens) || matches(t, path, pathTokens));
        if (typeOnly) {
            // e.g. "Rechnungen 2025": the type itself is the topic.
            if (typeInName) base = Math.max(base, 0.6);
        } else if (!plan.types().isEmpty()) {
            if (typeInName) base *= 1.25;
            else if (textScore == 0 && vectorScore < 0.5) base *= 0.45;
            else base *= 0.7;
        }

        boolean yearMatch = false;
        if (!plan.years().isEmpty()) {
            yearMatch = plan.years().stream().anyMatch(y -> hasYear(doc, y));
            if (plan.terms().isEmpty() && plan.types().isEmpty()) {
                base = yearMatch ? 0.6 : 0;
            } else {
                base *= yearMatch ? 1.2 : 0.35;
            }
        }

        if (base < MIN_SCORE) return null;
        List<String> by = new ArrayList<>();
        if (inName) by.add("Name");
        if (inPath) by.add("Ordner");
        if (textScore > 0) by.add("Inhalt");
        if (vectorScore > 0) by.add("Bedeutung");
        if (by.isEmpty() && typeInName) by.add("Dokumentart");
        if (by.isEmpty() && yearMatch) by.add("Jahr");
        return new Scored(doc, base, by, List.of());
    }

    /** Short words ("Re", "AOK") must be whole words, longer ones may be part of a compound. */
    static boolean matches(String term, String folded, Set<String> tokens) {
        String t = fold(term);
        if (t.isEmpty()) return false;
        if (t.length() <= 3) return tokens.contains(t);
        return folded.contains(t);
    }

    static boolean hasYear(Meta doc, int year) {
        if (doc.year() != null && doc.year() == year) return true;
        String text = doc.filename() + " " + doc.path();
        String y = String.valueOf(year);
        String yy = y.substring(2);
        return Pattern.compile("(^|\\D)" + y + "(\\D|$)").matcher(text).find()
                // "05.25", "_25.pdf" style short years after a month
                || Pattern.compile("\\d{1,2}[._-]" + yy + "(\\D|$)").matcher(text).find();
    }

    /** Lower case, umlauts folded (ä → ae), separators removed: "Haus-Anschluss" → "hausanschluss". */
    static String fold(String s) {
        if (s == null) return "";
        String lower = Normalizer.normalize(s, Normalizer.Form.NFC).toLowerCase(Locale.ROOT)
                .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss");
        return lower.replaceAll("[^\\p{L}\\p{N}]+", "");
    }

    static Set<String> tokens(String s) {
        if (s == null) return Set.of();
        return Arrays.stream(Normalizer.normalize(s, Normalizer.Form.NFC).split("[^\\p{L}\\p{N}]+"))
                .map(DocumentSearchService::fold)
                .filter(w -> !w.isEmpty())
                .collect(Collectors.toSet());
    }

    /** The same file (name + size) filed in several folders becomes one hit. */
    static List<Scored> mergeCopies(List<Scored> sorted) {
        Map<String, Integer> index = new HashMap<>();
        List<Scored> out = new ArrayList<>();
        for (Scored s : sorted) {
            String key = s.doc().filename().toLowerCase(Locale.ROOT) + "|" + s.doc().fileSize();
            Integer at = index.get(key);
            if (at == null) {
                index.put(key, out.size());
                out.add(s);
            } else {
                Scored first = out.get(at);
                List<String> also = new ArrayList<>(first.alsoIn());
                String p = s.doc().path();
                if (!p.equals(first.doc().path()) && !also.contains(p)) also.add(p);
                out.set(at, new Scored(first.doc(), first.score(), first.matchedBy(), also));
            }
        }
        return out;
    }
}
