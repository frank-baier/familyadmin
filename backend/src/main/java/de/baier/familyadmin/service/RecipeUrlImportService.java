package de.baier.familyadmin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.model.Recipe;
import de.baier.familyadmin.model.RecipeIngredient;
import de.baier.familyadmin.model.RecipeStep;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.RecipeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.coobird.thumbnailator.Thumbnails;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecipeUrlImportService {

    private final RecipeRepository recipeRepository;
    private final ObjectMapper     objectMapper;

    private final RestClient restClient = RestClient.builder()
            .defaultHeader("User-Agent",
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .defaultHeader("Accept",
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .defaultHeader("Accept-Language", "de-DE,de;q=0.9,en;q=0.8")
            .build();

    @Transactional
    public PaprikaImportService.ImportResult importFromUrl(String url, User currentUser) {
        try {
            JsonNode node = extractRecipeJsonLd(url);
            Recipe recipe = buildRecipe(node, url, currentUser);
            return new PaprikaImportService.ImportResult(recipe.getId(), recipe.getTitle(), "success", null);
        } catch (Exception e) {
            log.warn("Failed to import recipe from URL {}: {}", url, e.getMessage());
            return new PaprikaImportService.ImportResult(null, url, "error", e.getMessage());
        }
    }

    // ─── JSON-LD extraction ──────────────────────────────────────────────────

    private JsonNode extractRecipeJsonLd(String url) throws Exception {
        String html = restClient.get().uri(url).retrieve().body(String.class);
        if (html == null || html.isBlank()) {
            throw new IllegalArgumentException("Leere Antwort von URL: " + url);
        }
        org.jsoup.nodes.Document doc = Jsoup.parse(html);
        for (org.jsoup.nodes.Element script : doc.select("script[type=application/ld+json]")) {
            String json = script.data().strip();
            if (json.isBlank()) continue;
            try {
                JsonNode found = findRecipeNode(objectMapper.readTree(json));
                if (found != null) return found;
            } catch (Exception e) {
                log.debug("Skipping unparseable ld+json block: {}", e.getMessage());
            }
        }
        throw new IllegalArgumentException(
                "Kein schema.org/Recipe JSON-LD auf der Seite gefunden. " +
                "Bitte eine direkte Rezept-URL von chefkoch.de oder rezeptewelt.de verwenden.");
    }

    private JsonNode findRecipeNode(JsonNode node) {
        if (node.isArray()) {
            for (JsonNode el : node) {
                JsonNode found = findRecipeNode(el);
                if (found != null) return found;
            }
        } else if (node.isObject()) {
            if (isRecipeType(node.path("@type"))) return node;
            JsonNode graph = node.path("@graph");
            if (graph.isArray()) {
                for (JsonNode el : graph) {
                    JsonNode found = findRecipeNode(el);
                    if (found != null) return found;
                }
            }
        }
        return null;
    }

    private boolean isRecipeType(JsonNode typeNode) {
        if (typeNode.isTextual()) return typeNode.asText().contains("Recipe");
        if (typeNode.isArray()) {
            for (JsonNode t : typeNode) {
                if (t.asText().contains("Recipe")) return true;
            }
        }
        return false;
    }

    // ─── Recipe builder ──────────────────────────────────────────────────────

    private Recipe buildRecipe(JsonNode node, String sourceUrl, User currentUser) {
        String title = node.path("name").asText("Untitled").strip();
        if (title.isBlank()) title = "Untitled";

        String rawDesc = node.path("description").asText(null);
        String description = rawDesc != null ? Jsoup.parse(rawDesc).text() : null;

        Recipe recipe = Recipe.builder()
                .title(title)
                .description(description)
                .servings(parseServings(node.path("recipeYield").asText(null)))
                .prepMinutes(parseDuration(node.path("prepTime").asText(null)))
                .cookMinutes(parseDuration(node.path("cookTime").asText(null)))
                .totalMinutes(parseDuration(node.path("totalTime").asText(null)))
                .source(extractAuthorName(node.path("author")))
                .sourceUrl(sourceUrl)
                .categories(extractCategories(node.path("recipeCategory")))
                .createdBy(currentUser)
                .build();

        // Ingredients
        JsonNode ingredientsNode = node.path("recipeIngredient");
        if (ingredientsNode.isArray()) {
            int pos = 0;
            for (JsonNode ing : ingredientsNode) {
                String text = ing.asText("").strip();
                if (!text.isBlank()) {
                    RecipeIngredient ri = parseIngredientLine(text);
                    ri.setRecipe(recipe);
                    ri.setPosition(pos++);
                    recipe.getIngredients().add(ri);
                }
            }
        }

        // Steps
        List<RecipeStep> steps = parseInstructions(node.path("recipeInstructions"));
        for (int i = 0; i < steps.size(); i++) {
            steps.get(i).setRecipe(recipe);
            steps.get(i).setPosition(i);
        }
        recipe.getSteps().addAll(steps);

        // Photo
        String imageUrl = extractImageUrl(node.path("image"));
        if (imageUrl != null) {
            byte[] photoBytes = downloadAndCompressPhoto(imageUrl);
            if (photoBytes != null) {
                recipe.setPhotoData(photoBytes);
                recipe.setPhotoContentType("image/jpeg");
            }
        }

        return recipeRepository.save(recipe);
    }

    // ─── Instruction parsing ─────────────────────────────────────────────────

    private static final Pattern STEP_PREFIX = Pattern.compile("^(Step\\s+\\d+[:.\\s]+|\\d+[.)\\s]+)");

    private List<RecipeStep> parseInstructions(JsonNode node) {
        List<RecipeStep> steps = new ArrayList<>();
        if (node == null || node.isMissingNode()) return steps;

        if (node.isTextual()) {
            String text = node.asText();
            String[] blocks = text.split("\n\n+");
            if (blocks.length == 1) blocks = text.split("\n");
            for (String block : blocks) {
                String step = STEP_PREFIX.matcher(block.trim()).replaceFirst("").trim();
                if (!step.isBlank()) steps.add(RecipeStep.builder().text(step).build());
            }
        } else if (node.isArray()) {
            for (JsonNode item : node) {
                if (item.isTextual()) {
                    addStep(Jsoup.parse(item.asText()).text(), steps);
                } else {
                    String type = item.path("@type").asText("");
                    if (type.contains("HowToSection")) {
                        for (JsonNode sub : item.path("itemListElement")) {
                            addStep(Jsoup.parse(sub.path("text").asText("")).text(), steps);
                        }
                    } else {
                        addStep(Jsoup.parse(item.path("text").asText("")).text(), steps);
                    }
                }
            }
        }
        return steps;
    }

    private void addStep(String text, List<RecipeStep> steps) {
        String cleaned = text.strip();
        if (!cleaned.isBlank()) steps.add(RecipeStep.builder().text(cleaned).build());
    }

    // ─── Ingredient parsing (adapted from PaprikaImportService, +German units) ─

    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
            "^(\\d+(?:[\\s]\\d+/\\d+|/\\d+|\\.\\d+)?)\\s*"
    );

    private static final Set<String> KNOWN_UNITS = Set.of(
            // English
            "cup", "cups", "tbsp", "tsp", "tablespoon", "tablespoons", "teaspoon", "teaspoons",
            "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
            "g", "gram", "grams", "kg", "kilogram", "kilograms",
            "ml", "milliliter", "milliliters", "l", "liter", "liters", "litre", "litres",
            "clove", "cloves", "can", "cans", "package", "packages", "pkg",
            "bunch", "bunches", "slice", "slices", "piece", "pieces",
            "pinch", "dash", "handful", "sprig", "sprigs",
            "medium", "large", "small", "whole",
            // German (lowercase for case-insensitive comparison)
            "el", "tl", "prise", "bund", "scheibe", "scheiben",
            "stück", "stücke", "dose", "dosen", "päckchen", "pck", "becher",
            "zehe", "zehen", "msp", "messerspitze"
    );

    private RecipeIngredient parseIngredientLine(String line) {
        BigDecimal amount = null;
        String unit = null;
        String name = line;

        Matcher amountMatcher = AMOUNT_PATTERN.matcher(line);
        int cursor = 0;
        if (amountMatcher.find()) {
            String amountStr = amountMatcher.group(1).trim();
            amount = parseFraction(amountStr);
            cursor = amountMatcher.end();
        }

        if (cursor < line.length()) {
            String rest = line.substring(cursor).trim();
            String[] tokens = rest.split("\\s+", 2);
            if (tokens.length > 0 && KNOWN_UNITS.contains(tokens[0].toLowerCase())) {
                unit = tokens[0];
                name = tokens.length > 1 ? tokens[1].trim() : "";
            } else {
                name = rest;
            }
        }

        if (name.isEmpty()) {
            name = line;
            amount = null;
            unit = null;
        }

        return RecipeIngredient.builder().name(name).amount(amount).unit(unit).build();
    }

    private BigDecimal parseFraction(String s) {
        try {
            s = s.trim();
            if (s.contains(" ")) {
                String[] parts = s.split("\\s+", 2);
                return new BigDecimal(parts[0]).add(parseFraction(parts[1]));
            }
            if (s.contains("/")) {
                String[] parts = s.split("/");
                return new BigDecimal(parts[0]).divide(new BigDecimal(parts[1]), 3, RoundingMode.HALF_UP);
            }
            return new BigDecimal(s);
        } catch (Exception e) {
            return null;
        }
    }

    // ─── Field extraction helpers ────────────────────────────────────────────

    private Integer parseDuration(String iso) {
        if (iso == null || iso.isBlank()) return null;
        int total = 0;
        Matcher h = Pattern.compile("(\\d+)H").matcher(iso.toUpperCase());
        if (h.find()) total += Integer.parseInt(h.group(1)) * 60;
        Matcher m = Pattern.compile("(\\d+)M").matcher(iso.toUpperCase());
        if (m.find()) total += Integer.parseInt(m.group(1));
        return total > 0 ? total : null;
    }

    private Integer parseServings(String s) {
        if (s == null || s.isBlank()) return null;
        Matcher m = Pattern.compile("\\d+").matcher(s);
        return m.find() ? Integer.parseInt(m.group()) : null;
    }

    private String extractImageUrl(JsonNode img) {
        if (img == null || img.isMissingNode()) return null;
        if (img.isTextual()) { String u = img.asText(); return u.isBlank() ? null : u; }
        if (img.isArray() && img.size() > 0) {
            JsonNode first = img.get(0);
            if (first.isTextual()) { String u = first.asText(); return u.isBlank() ? null : u; }
            String u = first.path("url").asText(null);
            return (u != null && !u.isBlank()) ? u : null;
        }
        String u = img.path("url").asText(null);
        return (u != null && !u.isBlank()) ? u : null;
    }

    private String extractAuthorName(JsonNode author) {
        if (author == null || author.isMissingNode()) return null;
        if (author.isTextual()) return author.asText();
        if (author.isArray() && author.size() > 0) {
            JsonNode first = author.get(0);
            return first.isTextual() ? first.asText() : first.path("name").asText(null);
        }
        return author.path("name").asText(null);
    }

    private String extractCategories(JsonNode cat) {
        if (cat == null || cat.isMissingNode()) return null;
        if (cat.isTextual()) return cat.asText();
        if (cat.isArray()) {
            List<String> cats = new ArrayList<>();
            for (JsonNode c : cat) cats.add(c.asText());
            return cats.isEmpty() ? null : String.join(", ", cats);
        }
        return null;
    }

    // ─── Photo download ──────────────────────────────────────────────────────

    private byte[] downloadAndCompressPhoto(String imageUrl) {
        try {
            byte[] raw = restClient.get().uri(imageUrl).retrieve().body(byte[].class);
            if (raw == null || raw.length == 0) return null;
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            Thumbnails.of(new ByteArrayInputStream(raw))
                    .size(600, 600)
                    .outputFormat("JPEG")
                    .outputQuality(0.82)
                    .toOutputStream(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            log.warn("Failed to download/compress photo from {}: {}", imageUrl, e.getMessage());
            return null;
        }
    }
}
