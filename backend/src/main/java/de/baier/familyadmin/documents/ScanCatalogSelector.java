package de.baier.familyadmin.documents;

import de.baier.familyadmin.ai.OllamaService;
import de.baier.familyadmin.documents.ScanInboxDtos.CatalogFolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Year;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Picks the part of the folder catalogue (≈1,600 folders, ~72k tokens) that Claude needs
 * for one document, ~5–8k tokens:
 * <ul>
 *   <li>all folders of the top two levels (orientation, no examples),</li>
 *   <li>the tax folders of this and last year (plus years named in the document),</li>
 *   <li>the folders whose names / example file names fit the document best, plus the
 *       folders where similar archived documents lie (embeddings), with examples,
 *       their parents and their direct subfolders (e.g. year folders).</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ScanCatalogSelector {

    static final int RELEVANT_FOLDERS = 30;
    static final int RELEVANT_EXAMPLES = 3;
    static final int CHILDREN_PER_FOLDER = 12;
    static final String TAX_ROOT = "Behörden/Finanzamt/Steuerunterlagen ";
    private static final int SIMILAR_CHUNKS = 30;
    private static final int EMBED_CHARS = 2000;

    private final OllamaService ollamaService;
    private final JdbcTemplate jdbcTemplate;

    /**
     * @param text whatever text is known about the document (text layer or local OCR,
     *             file name, hint, mail subject); may be empty
     */
    public List<CatalogFolder> select(List<CatalogFolder> catalog, String text, UUID ownerId) {
        if (catalog == null || catalog.isEmpty()) return List.of();
        Map<String, Double> similar = text.isBlank() ? Map.of() : similarFolders(text, ownerId);
        return prune(catalog, text, similar, Year.now().getValue());
    }

    /** Archive paths ("category/sub", year) of documents similar to the text, weighted 0..1. */
    private Map<String, Double> similarFolders(String text, UUID ownerId) {
        try {
            float[] emb = ollamaService.embed(text.length() > EMBED_CHARS ? text.substring(0, EMBED_CHARS) : text);
            StringBuilder vec = new StringBuilder("[");
            for (int i = 0; i < emb.length; i++) vec.append(i > 0 ? "," : "").append(emb[i]);
            vec.append(']');
            Map<String, Double> out = new HashMap<>();
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                    SELECT d.category, d.subcategory, d.year
                    FROM (SELECT document_id, embedding <=> ?::vector AS dist FROM document_chunks
                          WHERE embedding IS NOT NULL ORDER BY dist LIMIT ?) c
                    JOIN documents d ON d.id = c.document_id
                    WHERE d.uploaded_by = ?
                       OR d.uploaded_by IN (SELECT owner_id FROM user_document_shares WHERE shared_with_id = ?)
                    ORDER BY c.dist
                    """, vec.toString(), SIMILAR_CHUNKS, ownerId, ownerId);
            for (int i = 0; i < rows.size(); i++) {
                Map<String, Object> r = rows.get(i);
                List<String> segs = new ArrayList<>();
                if (r.get("category") != null) segs.add(r.get("category").toString());
                if (r.get("subcategory") != null) segs.addAll(List.of(r.get("subcategory").toString().split("/")));
                if (r.get("year") != null) segs.add(r.get("year").toString());
                if (segs.isEmpty()) continue;
                out.merge(String.join("/", segs), 1.0 - (double) i / rows.size(), Double::sum);
            }
            return out;
        } catch (Exception e) {
            log.warn("Similar documents for folder choice failed: {}", e.getMessage());
            return Map.of();
        }
    }

    // ─── Pure selection logic (tested) ────────────────────────────────────────

    static List<CatalogFolder> prune(List<CatalogFolder> catalog, String text, Map<String, Double> similar, int thisYear) {
        Map<String, CatalogFolder> byPath = new LinkedHashMap<>();
        for (CatalogFolder f : catalog) {
            if (f.path() != null && !f.path().isBlank() && !f.path().startsWith("_Wohin")) byPath.put(f.path(), f);
        }

        // path → number of examples to show (0 = path only)
        Map<String, Integer> keep = new HashMap<>();

        // 1. Orientation: the top two levels.
        byPath.keySet().stream().filter(p -> depth(p) <= 2).forEach(p -> keep.put(p, 0));

        // 2. Tax folders: this and last year, plus up to two years named in the document.
        Set<Integer> taxYears = new LinkedHashSet<>(List.of(thisYear, thisYear - 1));
        taxYears.addAll(yearsIn(text, thisYear));
        for (String p : byPath.keySet()) {
            for (int y : taxYears) {
                String root = TAX_ROOT + y;
                if (p.equals(root) || (p.startsWith(root + "/") && depth(p) == depth(root) + 1)) {
                    keep.merge(p, 1, Math::max);
                }
            }
            String template = TAX_ROOT + "Template 2";
            if (p.equals(template) || (p.startsWith(template + "/") && depth(p) == depth(template) + 1)) {
                keep.putIfAbsent(p, 0);
            }
        }

        // 3. Best-fitting folders by name and example names, plus where similar documents lie.
        Map<String, Double> scores = scoreFolders(byPath.values(), words(text));
        similar.forEach((archivePath, weight) -> {
            String folder = bestFolderFor(archivePath, byPath.keySet());
            if (folder != null) scores.merge(folder, 4.0 * weight, Double::sum);
        });
        List<String> best = scores.entrySet().stream()
                .filter(e -> e.getValue() > 0)
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(RELEVANT_FOLDERS)
                .map(Map.Entry::getKey)
                .toList();
        for (String p : best) {
            keep.merge(p, RELEVANT_EXAMPLES, Math::max);
            for (String a = parent(p); a != null; a = parent(a)) keep.putIfAbsent(a, 0);
            byPath.keySet().stream()
                    .filter(c -> c.startsWith(p + "/") && depth(c) == depth(p) + 1)
                    .sorted(Comparator.reverseOrder())   // newest year folders first
                    .limit(CHILDREN_PER_FOLDER)
                    .forEach(c -> keep.putIfAbsent(c, 0));
        }

        List<CatalogFolder> out = new ArrayList<>();
        for (CatalogFolder f : byPath.values()) {
            Integer examples = keep.get(f.path());
            if (examples == null) continue;
            List<String> files = f.files() == null ? List.of() : f.files();
            out.add(new CatalogFolder(f.path(), files.subList(0, Math.min(examples, files.size()))));
        }
        return out;
    }

    /** IDF-weighted overlap of folder name tokens (and example file names) with the document's words. */
    static Map<String, Double> scoreFolders(Collection<CatalogFolder> folders, Set<String> docWords) {
        Map<String, Map<String, Double>> tokensByFolder = new HashMap<>();
        Map<String, Integer> df = new HashMap<>();
        for (CatalogFolder f : folders) {
            Map<String, Double> t = new HashMap<>();
            String[] segs = f.path().split("/");
            for (int i = 0; i < segs.length; i++) {
                double w = i == segs.length - 1 ? 2.0 : 0.5;
                for (String tok : tokens(segs[i])) t.merge(tok, w, Math::max);
            }
            if (f.files() != null) {
                for (String file : f.files()) for (String tok : tokens(file)) t.merge(tok, 0.7, Math::max);
            }
            tokensByFolder.put(f.path(), t);
            t.keySet().forEach(tok -> df.merge(tok, 1, Integer::sum));
        }
        TreeSet<String> sortedWords = new TreeSet<>(docWords);
        int n = Math.max(folders.size(), 1);
        Map<String, Double> scores = new HashMap<>();
        tokensByFolder.forEach((path, toks) -> {
            double s = 0;
            for (var e : toks.entrySet()) {
                if (matchesWord(e.getKey(), sortedWords)) {
                    s += e.getValue() * Math.log((double) n / df.get(e.getKey()));
                }
            }
            if (s > 0) scores.put(path, s);
        });
        return scores;
    }

    /** Exact word, or the folder token is the start of a longer compound word ("fernwaerme" → "fernwaermeanschluss"). */
    static boolean matchesWord(String token, TreeSet<String> words) {
        if (words.contains(token)) return true;
        if (token.length() < 5) return false;
        String next = words.ceiling(token);
        return next != null && next.startsWith(token);
    }

    /** The shortest catalogue folder containing all segments of an archive path. */
    static String bestFolderFor(String archivePath, Set<String> folders) {
        List<String> segs = Arrays.stream(archivePath.split("/")).map(String::toLowerCase).toList();
        String best = null;
        for (String f : folders) {
            List<String> fs = Arrays.stream(f.split("/")).map(String::toLowerCase).toList();
            if (!fs.get(0).equals(segs.get(0)) || !fs.containsAll(segs)) continue;
            if (best == null || f.length() < best.length()) best = f;
        }
        return best;
    }

    private static final Pattern YEAR = Pattern.compile("(?<!\\d)(20\\d{2})(?!\\d)");

    /** Up to two years mentioned most often in the text, within the last six years. */
    static List<Integer> yearsIn(String text, int thisYear) {
        if (text == null) return List.of();
        Map<Integer, Integer> count = new HashMap<>();
        Matcher m = YEAR.matcher(text);
        while (m.find()) {
            int y = Integer.parseInt(m.group(1));
            if (y >= thisYear - 6 && y <= thisYear) count.merge(y, 1, Integer::sum);
        }
        return count.entrySet().stream()
                .sorted(Map.Entry.<Integer, Integer>comparingByValue().reversed())
                .limit(2).map(Map.Entry::getKey).toList();
    }

    static Set<String> words(String text) {
        if (text == null) return Set.of();
        return Arrays.stream(text.split("[^\\p{L}\\p{N}]+"))
                .map(DocumentSearchService::fold)
                .filter(w -> w.length() >= 3 && !w.chars().allMatch(Character::isDigit))
                .collect(Collectors.toSet());
    }

    static Set<String> tokens(String s) {
        return words(s);
    }

    static int depth(String path) {
        return path.split("/").length;
    }

    static String parent(String path) {
        int i = path.lastIndexOf('/');
        return i > 0 ? path.substring(0, i) : null;
    }
}
