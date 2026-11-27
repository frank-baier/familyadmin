package de.baier.familyadmin.documents;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.ai.AnthropicChatService;
import de.baier.familyadmin.ai.OllamaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Suggests where an e-mail attachment belongs in the document tree (category /
 * subcategory / year), preferring folders that already exist. Uses Claude like the
 * document chat (only a text excerpt is sent), falling back to the local Ollama model.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MailFilingSuggestionService {

    private static final int MAX_TEXT_CHARS = 6000;
    private static final int MAX_FOLDERS = 400;

    private final DocumentRepository documentRepository;
    private final DocumentIndexingService documentIndexingService;
    private final AnthropicChatService anthropicChatService;
    private final OllamaService ollamaService;
    private final ObjectMapper objectMapper;

    @Value("${rag.llm-provider:anthropic}")
    private String llmProvider;

    public record Suggestion(String category, String subcategory, Integer year,
                             String reason, Boolean important, String model) {}

    public Suggestion suggest(UUID ownerId, String filename, byte[] data,
                              String mailFrom, String mailSubject, LocalDate mailDate) {
        String text = documentIndexingService.extractText(data, filename);
        if (text.length() > MAX_TEXT_CHARS) text = text.substring(0, MAX_TEXT_CHARS);

        String prompt = buildPrompt(existingFolders(ownerId), filename, text, mailFrom, mailSubject, mailDate);

        if ("anthropic".equalsIgnoreCase(llmProvider) && anthropicChatService.isConfigured()) {
            try {
                var result = anthropicChatService.complete(SYSTEM, prompt);
                return parse(result.text(), anthropicChatService.model());
            } catch (Exception e) {
                log.warn("Claude filing suggestion failed for '{}', falling back to Ollama: {}", filename, e.getMessage());
            }
        }
        try {
            String answer = ollamaService.generate(SYSTEM + "\n\n" + prompt, 0.1);
            return parse(answer, "ollama:" + ollamaService.chatModel());
        } catch (Exception e) {
            log.warn("Ollama filing suggestion failed for '{}': {}", filename, e.getMessage());
            return null;
        }
    }

    private static final String SYSTEM = """
            Du sortierst E-Mail-Anhänge in die private Dokumentenablage einer Familie ein.
            Die Ablage hat Kategorie (oberste Ebene, z. B. "Finanzen"), Unterkategorie
            (Pfad mit "/", z. B. "Banken/SoBa", kann leer sein) und Jahr.
            Regeln:
            - Nimm wenn möglich einen BESTEHENDEN Ordner aus der Liste. Nur wenn keiner passt,
              schlage einen neuen vor, der zum Stil der bestehenden passt.
            - Jahr = Jahr, auf das sich das Dokument bezieht (Rechnungsdatum, Steuerjahr,
              Reisejahr), sonst das Jahr der E-Mail.
            - "important": false für Werbung, Newsletter, AGB, Datenschutzhinweise, Logos und
              ähnliches, das man nicht aufbewahren muss; sonst true.
            - "reason": ein kurzer deutscher Satz, warum dieser Ordner.
            Antworte NUR mit JSON, ohne Erklärung davor oder danach:
            {"category": "...", "subcategory": "..." oder null, "year": 2026, "important": true, "reason": "..."}
            """;

    private String buildPrompt(List<String> folders, String filename, String text,
                               String mailFrom, String mailSubject, LocalDate mailDate) {
        return """
                Bestehende Ordner (Kategorie/Unterkategorie):
                %s

                E-Mail von: %s
                Betreff: %s
                Datum: %s
                Anhang: %s

                Inhalt des Anhangs (Auszug):
                <<<
                %s
                >>>
                """.formatted(
                folders.isEmpty() ? "(noch keine)" : String.join("\n", folders),
                nullToDash(mailFrom), nullToDash(mailSubject),
                mailDate != null ? mailDate : "-", filename,
                text.isBlank() ? "(kein Text lesbar)" : text);
    }

    private List<String> existingFolders(UUID ownerId) {
        Set<String> folders = new LinkedHashSet<>();
        for (DocumentTreeNode node : documentRepository.findGroupedTreeForUser(ownerId)) {
            if (!StringUtils.hasText(node.category())) continue;
            folders.add(StringUtils.hasText(node.subcategory())
                    ? node.category() + "/" + node.subcategory() : node.category());
        }
        return folders.stream().limit(MAX_FOLDERS).collect(Collectors.toList());
    }

    Suggestion parse(String answer, String model) throws Exception {
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalArgumentException("Keine JSON-Antwort: " + answer);
        }
        JsonNode json = objectMapper.readTree(answer.substring(start, end + 1));
        String category = textOrNull(json, "category");
        String subcategory = textOrNull(json, "subcategory");
        // Model sometimes repeats the category as first path element.
        if (category != null && subcategory != null && subcategory.startsWith(category + "/")) {
            subcategory = subcategory.substring(category.length() + 1);
        }
        Integer year = json.hasNonNull("year") && json.get("year").canConvertToInt()
                ? json.get("year").asInt() : null;
        if (year != null && (year < 1950 || year > LocalDate.now(ZoneId.of("Europe/Zurich")).getYear() + 1)) {
            year = null;
        }
        Boolean important = json.hasNonNull("important") ? json.get("important").asBoolean() : null;
        return new Suggestion(category, subcategory, year, textOrNull(json, "reason"), important, model);
    }

    private static String textOrNull(JsonNode json, String field) {
        if (!json.hasNonNull(field)) return null;
        String value = json.get(field).asText().strip();
        return value.isEmpty() || "null".equalsIgnoreCase(value) ? null : value;
    }

    private static String nullToDash(String s) {
        return StringUtils.hasText(s) ? s : "-";
    }
}
