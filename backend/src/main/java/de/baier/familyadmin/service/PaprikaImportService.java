package de.baier.familyadmin.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.model.Recipe;
import de.baier.familyadmin.model.RecipeIngredient;
import de.baier.familyadmin.model.RecipeStep;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.RecipeRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaprikaImportService {

    private final RecipeRepository recipeRepository;
    private final ObjectMapper objectMapper;

    public record ImportResult(UUID id, String title, String status, String error) {}

    @Transactional
    public List<ImportResult> importPaprikaFile(MultipartFile file, User currentUser) throws IOException {
        List<ImportResult> results = new ArrayList<>();

        try (ZipInputStream zip = new ZipInputStream(file.getInputStream())) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String entryName = entry.getName();
                if (entryName.endsWith(".paprikarecipe")) {
                    try {
                        byte[] gzippedData = zip.readAllBytes();
                        byte[] jsonData;
                        try (GZIPInputStream gzip = new GZIPInputStream(new ByteArrayInputStream(gzippedData))) {
                            jsonData = gzip.readAllBytes();
                        }
                        PaprikaRecipeJson paprikaRecipe = objectMapper.readValue(jsonData, PaprikaRecipeJson.class);
                        Recipe recipe = importSingleRecipe(paprikaRecipe, currentUser);
                        results.add(new ImportResult(recipe.getId(), recipe.getTitle(), "success", null));
                        log.info("Imported recipe: {}", recipe.getTitle());
                    } catch (Exception e) {
                        log.warn("Failed to import {}: {}", entryName, e.getMessage());
                        results.add(new ImportResult(null, entryName, "error", e.getMessage()));
                    }
                }
                zip.closeEntry();
            }
        }

        return results;
    }

    private Recipe importSingleRecipe(PaprikaRecipeJson json, User currentUser) throws IOException {
        var recipe = Recipe.builder()
                .title(json.getName() != null ? json.getName() : "Untitled")
                .description(json.getDescription())
                .servings(parseServings(json.getServings()))
                .prepMinutes(parseTimeToMinutes(json.getPrepTime()))
                .cookMinutes(parseTimeToMinutes(json.getCookTime()))
                .totalMinutes(parseTimeToMinutes(json.getTotalTime()))
                .source(json.getSource())
                .sourceUrl(json.getSourceUrl())
                .rating(json.getRating())
                .difficulty(json.getDifficulty())
                .notes(json.getNotes())
                .nutritionalInfo(json.getNutritionalInfo())
                .categories(json.getCategories() != null ? String.join(", ", json.getCategories()) : null)
                .createdBy(currentUser)
                .build();

        if (json.getIngredients() != null && !json.getIngredients().isBlank()) {
            List<RecipeIngredient> ingredients = parseIngredients(json.getIngredients());
            for (int i = 0; i < ingredients.size(); i++) {
                ingredients.get(i).setRecipe(recipe);
                ingredients.get(i).setPosition(i);
            }
            recipe.getIngredients().addAll(ingredients);
        }

        if (json.getDirections() != null && !json.getDirections().isBlank()) {
            List<RecipeStep> steps = parseDirections(json.getDirections());
            for (int i = 0; i < steps.size(); i++) {
                steps.get(i).setRecipe(recipe);
                steps.get(i).setPosition(i);
            }
            recipe.getSteps().addAll(steps);
        }

        if (json.getPhoto() != null && !json.getPhoto().isBlank()) {
            try {
                String photoUrl = saveBase64Photo(json.getPhoto());
                recipe.setPhotoUrl(photoUrl);
            } catch (Exception e) {
                log.warn("Failed to save photo for '{}': {}", json.getName(), e.getMessage());
            }
        }

        return recipeRepository.save(recipe);
    }

    private String saveBase64Photo(String base64Data) throws IOException {
        byte[] imageData = Base64.getDecoder().decode(base64Data);
        Path uploadPath = Paths.get("uploads");
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }
        String filename = UUID.randomUUID() + ".jpg";
        Files.write(uploadPath.resolve(filename), imageData);
        return "/uploads/" + filename;
    }

    // --- Ingredient parsing ---

    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
            "^(\\d+(?:[\\s]\\d+/\\d+|/\\d+|\\.\\d+)?)\\s*"
    );

    private static final Set<String> KNOWN_UNITS = Set.of(
            "cup", "cups", "tbsp", "tsp", "tablespoon", "tablespoons", "teaspoon", "teaspoons",
            "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
            "g", "gram", "grams", "kg", "kilogram", "kilograms",
            "ml", "milliliter", "milliliters", "l", "liter", "liters", "litre", "litres",
            "clove", "cloves", "can", "cans", "package", "packages", "pkg",
            "bunch", "bunches", "slice", "slices", "piece", "pieces",
            "pinch", "dash", "handful", "sprig", "sprigs",
            "medium", "large", "small", "whole"
    );

    private List<RecipeIngredient> parseIngredients(String text) {
        List<RecipeIngredient> ingredients = new ArrayList<>();
        for (String line : text.split("\n")) {
            line = line.trim();
            if (!line.isEmpty()) {
                ingredients.add(parseIngredientLine(line));
            }
        }
        return ingredients;
    }

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

        return RecipeIngredient.builder()
                .name(name)
                .amount(amount)
                .unit(unit)
                .build();
    }

    private BigDecimal parseFraction(String s) {
        try {
            s = s.trim();
            if (s.contains(" ")) {
                // Mixed fraction: "1 1/2"
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

    // --- Direction parsing ---

    private static final Pattern STEP_NUMBER_PREFIX = Pattern.compile("^(Step\\s+\\d+[:.\\s]+|\\d+[.)\\s]+)");

    private List<RecipeStep> parseDirections(String text) {
        String[] blocks = text.split("\n\n+");
        if (blocks.length == 1) {
            blocks = text.split("\n");
        }
        List<RecipeStep> steps = new ArrayList<>();
        for (String block : blocks) {
            String step = STEP_NUMBER_PREFIX.matcher(block.trim()).replaceFirst("").trim();
            if (!step.isEmpty()) {
                steps.add(RecipeStep.builder().text(step).build());
            }
        }
        return steps;
    }

    // --- Time / servings parsing ---

    private Integer parseServings(String servings) {
        if (servings == null || servings.isBlank()) return null;
        Matcher m = Pattern.compile("\\d+").matcher(servings);
        return m.find() ? Integer.parseInt(m.group()) : null;
    }

    private Integer parseTimeToMinutes(String time) {
        if (time == null || time.isBlank()) return null;
        int total = 0;
        Matcher hours = Pattern.compile("(\\d+)\\s*h").matcher(time);
        if (hours.find()) total += Integer.parseInt(hours.group(1)) * 60;
        Matcher mins = Pattern.compile("(\\d+)\\s*m").matcher(time);
        if (mins.find()) total += Integer.parseInt(mins.group(1));
        if (total == 0) {
            Matcher plain = Pattern.compile("^(\\d+)$").matcher(time.trim());
            if (plain.matches()) total = Integer.parseInt(plain.group(1));
        }
        return total > 0 ? total : null;
    }

    // --- Paprika JSON DTO ---

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaprikaRecipeJson {
        private String uid;
        private String name;
        private String ingredients;
        private String directions;
        private String description;
        private String servings;
        @JsonProperty("prep_time")
        private String prepTime;
        @JsonProperty("cook_time")
        private String cookTime;
        @JsonProperty("total_time")
        private String totalTime;
        private String source;
        @JsonProperty("source_url")
        private String sourceUrl;
        private String photo;
        @JsonProperty("photo_hash")
        private String photoHash;
        private List<String> categories;
        private Integer rating;
        private String difficulty;
        private String notes;
        @JsonProperty("nutritional_info")
        private String nutritionalInfo;
    }
}
