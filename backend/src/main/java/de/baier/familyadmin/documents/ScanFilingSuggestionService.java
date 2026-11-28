package de.baier.familyadmin.documents;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.documents.ScanInboxDtos.CatalogFolder;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

/**
 * Suggests target folder (below iCloud "Dokumente") and file name for a scanned document.
 * An existing text layer (OCR done by the scanner or a digital PDF) is preferred; only
 * when there is none Claude reads the PDF/image itself.
 */
@Slf4j
@Service
public class ScanFilingSuggestionService {

    /** Below this many non-blank characters a PDF counts as "no OCR text". */
    static final int MIN_TEXT_CHARS = 80;
    private static final int MAX_TEXT_CHARS = 8_000;
    private static final long MAX_VISION_BYTES = 20L * 1024 * 1024;
    private static final int MAX_EXAMPLES_PER_FOLDER = 4;
    private static final BigDecimal MILLION = BigDecimal.valueOf(1_000_000);

    private final AnthropicClient client;
    private final String model;
    private final BigDecimal inputPrice;
    private final BigDecimal outputPrice;
    private final BigDecimal cacheReadPrice;
    private final ObjectMapper objectMapper;

    public record Suggestion(String folder, String filename, Boolean taxRelevant, Boolean worthKeeping,
                             String reason, String summary, String model, String input, BigDecimal costUsd,
                             int catalogFolders) {}

    public ScanFilingSuggestionService(@Value("${anthropic.api-key:}") String apiKey,
                                       @Value("${scan-inbox.anthropic-model:claude-opus-5-5}") String model,
                                       @Value("${scan-inbox.price-input-usd-per-mtok:4.00}") BigDecimal inputPrice,
                                       @Value("${scan-inbox.price-output-usd-per-mtok:20.00}") BigDecimal outputPrice,
                                       @Value("${scan-inbox.price-cache-read-usd-per-mtok:0.20}") BigDecimal cacheReadPrice,
                                       ObjectMapper objectMapper) {
        this.client = StringUtils.hasText(apiKey) ? AnthropicOkHttpClient.builder().apiKey(apiKey).build() : null;
        this.model = model;
        this.inputPrice = inputPrice;
        this.outputPrice = outputPrice;
        this.cacheReadPrice = cacheReadPrice;
        this.objectMapper = objectMapper;
    }

    public boolean isConfigured() {
        return client != null;
    }

    public Suggestion suggest(String sourceName, String contentType, byte[] data,
                              List<CatalogFolder> catalog, String userHint) {
        return suggest(sourceName, contentType, data, catalog, userHint, null);
    }

    /** {@code mailContext}: sender/date/subject when the file is an e-mail attachment, else null. */
    public Suggestion suggest(String sourceName, String contentType, byte[] data,
                              List<CatalogFolder> catalog, String userHint, String mailContext) {
        return suggest(sourceName, contentType, data, catalog, userHint, mailContext, null);
    }

    /** {@code modelOverride}: another model for a comparison run (admin dry-run), else null. */
    public Suggestion suggest(String sourceName, String contentType, byte[] data, List<CatalogFolder> catalog,
                              String userHint, String mailContext, String modelOverride) {
        if (client == null) throw new IllegalStateException("ANTHROPIC_API_KEY ist nicht konfiguriert");
        String model = StringUtils.hasText(modelOverride) ? modelOverride : this.model;
        Prices prices = prices(model);

        List<ContentBlockParam> content = new ArrayList<>();
        String input;
        String text = isPdf(contentType, sourceName) ? pdfText(data) : "";
        if (nonBlankLength(text) >= MIN_TEXT_CHARS) {
            input = "PDF_TEXT";
            if (text.length() > MAX_TEXT_CHARS) text = text.substring(0, MAX_TEXT_CHARS);
            content.add(textBlock("Vorhandener Text (OCR/Textebene) des Dokuments:\n<<<\n" + text.strip() + "\n>>>"));
        } else if (isPdf(contentType, sourceName) && data.length <= MAX_VISION_BYTES) {
            input = "DOCUMENT";
            content.add(ContentBlockParam.ofDocument(DocumentBlockParam.builder()
                    .source(Base64PdfSource.builder().data(Base64.getEncoder().encodeToString(data)).build())
                    .build()));
        } else if (imageType(contentType) != null && data.length <= MAX_VISION_BYTES) {
            input = "IMAGE";
            content.add(ContentBlockParam.ofImage(ImageBlockParam.builder()
                    .source(Base64ImageSource.builder()
                            .mediaType(imageType(contentType))
                            .data(Base64.getEncoder().encodeToString(data)).build())
                    .build()));
        } else {
            input = "NONE";
        }
        content.add(textBlock(task(sourceName, userHint, mailContext, input)));

        Message message = client.messages().create(MessageCreateParams.builder()
                .model(model)
                .maxTokens(8000L)
                .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.MEDIUM).build())
                .systemOfTextBlockParams(List.of(
                        TextBlockParam.builder().text(SYSTEM).build(),
                        // Only the part of the tree that fits this document (ScanCatalogSelector),
                        // different for every file, so not cached.
                        TextBlockParam.builder().text(renderCatalog(catalog)).build()))
                .addUserMessageOfContentBlockParams(content)
                .build());

        if (message.stopReason().map(r -> r.equals(StopReason.REFUSAL)).orElse(false)) {
            throw new IllegalStateException("Claude hat die Analyse abgelehnt");
        }
        String answer = message.content().stream()
                .flatMap(b -> b.text().stream()).map(TextBlock::text)
                .reduce("", String::concat).strip();

        Usage usage = message.usage();
        long cacheWrite = usage.cacheCreationInputTokens().orElse(0L);
        long cacheRead = usage.cacheReadInputTokens().orElse(0L);
        BigDecimal cost = perMTok(prices.input(), usage.inputTokens())
                .add(perMTok(prices.input().multiply(BigDecimal.valueOf(1.25)), cacheWrite))
                .add(perMTok(prices.cacheRead(), cacheRead))
                .add(perMTok(prices.output(), usage.outputTokens()))
                .setScale(6, RoundingMode.HALF_UP);
        log.info("Scan suggestion for '{}' ({}, {}, {} folders): {} in / {} cache-write / {} cache-read / {} out, ${}",
                sourceName, model, input, catalog == null ? 0 : catalog.size(),
                usage.inputTokens(), cacheWrite, cacheRead, usage.outputTokens(), cost);

        return parse(answer, sourceName, input, cost, catalog == null ? 0 : catalog.size(), model);
    }

    // ── Prompt ──────────────────────────────────────────────────────────────

    private static final String SYSTEM = """
            Du legst gescannte Dokumente und E-Mail-Anhänge einer Familie in ihre iCloud-Ablage "Dokumente" ab.
            Du bekommst einen Auszug aus dem Ordnerbaum (Pfade relativ zu "Dokumente"): alle Ordner
            der oberen zwei Ebenen, die Steuerordner und die zum Dokument passendsten Ordner mit
            Beispiel-Dateinamen und Unterordnern. Schlage für ein Dokument den Zielordner und einen
            Dateinamen vor.

            Zielordner:
            - Nimm einen BESTEHENDEN Ordner und schreibe seinen Pfad exakt so wie in der Liste,
              inklusive Zusätzen wie "_fertig". Einen neuen Unterordner nur, wenn es keinen
              passenden gibt und er dem Muster der Nachbarordner folgt (z. B. ein neuer
              Jahresordner "2027" neben "2025" und "2026").
            - Steuerrelevante Dokumente (deutsche Einkommensteuer) gehören IMMER nach
              "Behörden/Finanzamt/Steuerunterlagen <Jahr>/<Rubrik>", nicht in den Fachordner.
              <Jahr> ist das Steuerjahr, auf das sich das Dokument bezieht (Leistungs- bzw.
              Zahlungsjahr, bei Jahresbescheinigungen das bescheinigte Jahr), nicht das
              heutige Datum. <Rubrik> ist der passende nummerierte Unterordner dieses Jahres,
              z. B. "01 Arbeitnehmer", "02 Aussergewöhnliche Belastungen" (Arzt, Zahnarzt,
              Brille, Therapie, Apotheke), "04 Handwerker und Haushaltsnahe Diensteistungen"
              (Handwerker, Schornsteinfeger, Wartung, Haushaltshilfe), "05 Kapitalanlagen",
              "06 Kinder" (auch Schulgeld, Kita,
              Kinderbetreuung), "07 Renten", "08 Sonderausgaben_Spenden", "09 Vermietungen",
              "10 Versicherungen". Gibt es den Jahresordner noch nicht, nimm die Rubriknamen
              aus "Behörden/Finanzamt/Steuerunterlagen Template 2".
            - Nicht steuerrelevant sind z. B. Kassenzettel für Einkäufe, Abo-Rechnungen,
              Werbung, Garantiebelege für Geräte.
            - Nie den Ordner "_Wohin?" vorschlagen.

            Dateiname:
            - Folge dem Muster der Beispiel-Dateinamen im Zielordner. Typisch für Rechnungen
              ist "Re_<Aussteller>[_<Person>]_<MM.YYYY>", sonst "<Aussteller>_<Thema>_<MM.YYYY>".
              Personennamen nur, wenn das Dokument klar eine Person betrifft und diese in den
              Beispielen so vorkommt (z. B. Frank, Petra, Anna, Jule).
            - Behalte die Dateiendung der Originaldatei unverändert bei.
            - Ist der bisherige Dateiname schon korrekt und im Stil der Ablage, behalte ihn.
            - Keine Zeichen / \\ : * ? " < > |.

            Aufbewahren:
            - "worthKeeping": false für Dinge, die man nicht ablegen muss: Werbung, Newsletter,
              AGB, Datenschutz- und Widerrufsbelehrungen, Logos, reine Versand- oder
              Terminbestätigungen ohne Rechnung. Sonst true. Den Ordner trotzdem vorschlagen.

            Antworte NUR mit JSON, ohne Text davor oder danach:
            {"folder": "Pfad/relativ/zu/Dokumente", "filename": "Name.ext",
             "taxRelevant": true|false, "worthKeeping": true|false,
             "reason": "kurzer deutscher Satz, was das Dokument ist und warum dieser Ordner",
             "summary": "2–4 deutsche Sätze für die spätere Suche: Art des Dokuments, Aussteller,
                         Datum, Betrag, Rechnungs-/Vertrags-/Kundennummern, betroffene Person, Gegenstand"}
            """;

    static String renderCatalog(List<CatalogFolder> catalog) {
        StringBuilder sb = new StringBuilder("Ordnerbaum von \"Dokumente\" (Auszug):\n");
        if (catalog == null || catalog.isEmpty()) return sb.append("(noch nicht übertragen)\n").toString();
        for (CatalogFolder f : catalog) {
            if (f.path() == null || f.path().startsWith("_Wohin")) continue;
            sb.append("- ").append(f.path());
            if (f.files() != null && !f.files().isEmpty()) {
                sb.append("  | z. B.: ").append(String.join(" ; ",
                        f.files().subList(0, Math.min(MAX_EXAMPLES_PER_FOLDER, f.files().size()))));
            }
            sb.append('\n');
        }
        return sb.toString();
    }

    private static String task(String sourceName, String userHint, String mailContext, String input) {
        String today = LocalDate.now(ZoneId.of("Europe/Zurich")).toString();
        return """
                Heute ist %s.
                Bisheriger Dateiname: %s
                %s%s%s
                Wohin gehört das Dokument und wie soll es heißen?
                """.formatted(today, sourceName,
                StringUtils.hasText(mailContext) ? mailContext.strip() + "\n" : "",
                "NONE".equals(input) ? "Der Inhalt ist nicht lesbar – entscheide nach dem Dateinamen.\n" : "",
                StringUtils.hasText(userHint) ? "Hinweis des Benutzers (hat Vorrang): " + userHint.strip() + "\n" : "");
    }

    // ── Parsing & sanitising ────────────────────────────────────────────────

    Suggestion parse(String answer, String sourceName, String input, BigDecimal cost, int catalogFolders) {
        return parse(answer, sourceName, input, cost, catalogFolders, model);
    }

    Suggestion parse(String answer, String sourceName, String input, BigDecimal cost, int catalogFolders,
                     String model) {
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) throw new IllegalStateException("Keine JSON-Antwort: " + answer);
        JsonNode json;
        try {
            json = objectMapper.readTree(answer.substring(start, end + 1));
        } catch (Exception e) {
            throw new IllegalStateException("Ungültige JSON-Antwort: " + answer, e);
        }
        String folder = cleanFolder(text(json, "folder"));
        String filename = cleanFilename(text(json, "filename"), sourceName);
        Boolean tax = json.hasNonNull("taxRelevant") ? json.get("taxRelevant").asBoolean() : null;
        Boolean keep = json.hasNonNull("worthKeeping") ? json.get("worthKeeping").asBoolean() : null;
        return new Suggestion(folder, filename, tax, keep, text(json, "reason"), text(json, "summary"),
                model, input, cost, catalogFolders);
    }

    /** Relative path below "Dokumente", or null if unusable. */
    static String cleanFolder(String folder) {
        if (!StringUtils.hasText(folder)) return null;
        String f = folder.strip().replace('\\', '/');
        if (f.startsWith("Dokumente/")) f = f.substring("Dokumente/".length());
        List<String> parts = new ArrayList<>();
        for (String p : f.split("/")) {
            String s = p.strip();
            if (s.isEmpty() || s.equals(".")) continue;
            if (s.equals("..")) return null;
            parts.add(s);
        }
        if (parts.isEmpty() || parts.get(0).startsWith("_Wohin")) return null;
        return String.join("/", parts);
    }

    /** File name without path characters, keeping the original extension. */
    static String cleanFilename(String filename, String sourceName) {
        String ext = extension(sourceName);
        String name = StringUtils.hasText(filename) ? filename.strip() : sourceName;
        name = name.replaceAll("[/\\\\:*?\"<>|]", "-").replaceAll("\\s+", " ").strip();
        if (name.startsWith(".")) name = name.substring(1);
        if (!ext.isEmpty()) {
            if (name.toLowerCase(Locale.ROOT).endsWith(ext.toLowerCase(Locale.ROOT))) {
                name = name.substring(0, name.length() - ext.length());
            } else {
                // Drop a different real extension (".jpg"), but not a date part like ".2026".
                String own = extension(name);
                if (own.matches("\\.[A-Za-z][A-Za-z0-9]{1,4}")) name = name.substring(0, name.length() - own.length());
            }
            name = name + ext;
        }
        return name.isBlank() || name.equals(ext) ? sourceName : name;
    }

    static String extension(String name) {
        if (name == null) return "";
        int dot = name.lastIndexOf('.');
        return dot > 0 && dot < name.length() - 1 ? name.substring(dot) : "";
    }

    private static String text(JsonNode json, String field) {
        if (!json.hasNonNull(field)) return null;
        String v = json.get(field).asText().strip();
        return v.isEmpty() || "null".equalsIgnoreCase(v) ? null : v;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    record Prices(BigDecimal input, BigDecimal output, BigDecimal cacheRead) {}

    /** Configured prices for the configured model; list prices for comparison models. */
    Prices prices(String model) {
        if (model.equals(this.model)) return new Prices(inputPrice, outputPrice, cacheReadPrice);
        if (model.startsWith("claude-sonnet")) return new Prices(new BigDecimal("2.00"), new BigDecimal("10.00"), new BigDecimal("0.10"));
        if (model.startsWith("claude-haiku")) return new Prices(new BigDecimal("0.10"), new BigDecimal("0.50"), new BigDecimal("0.01"));
        return new Prices(inputPrice, outputPrice, cacheReadPrice);
    }

    static String pdfText(byte[] data) {
        try (PDDocument doc = PDDocument.load(data)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setEndPage(Math.min(doc.getNumberOfPages(), 10));
            return stripper.getText(doc);
        } catch (Exception e) {
            log.debug("No PDF text: {}", e.getMessage());
            return "";
        }
    }

    static int nonBlankLength(String s) {
        return s == null ? 0 : s.replaceAll("\\s+", "").length();
    }

    private static boolean isPdf(String contentType, String name) {
        return "application/pdf".equalsIgnoreCase(contentType)
                || (name != null && name.toLowerCase(Locale.ROOT).endsWith(".pdf"));
    }

    private static Base64ImageSource.MediaType imageType(String contentType) {
        if (contentType == null) return null;
        return switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/jpeg", "image/jpg" -> Base64ImageSource.MediaType.IMAGE_JPEG;
            case "image/png" -> Base64ImageSource.MediaType.IMAGE_PNG;
            case "image/gif" -> Base64ImageSource.MediaType.IMAGE_GIF;
            case "image/webp" -> Base64ImageSource.MediaType.IMAGE_WEBP;
            default -> null;
        };
    }

    private static ContentBlockParam textBlock(String text) {
        return ContentBlockParam.ofText(TextBlockParam.builder().text(text).build());
    }

    private static BigDecimal perMTok(BigDecimal price, long tokens) {
        return price.multiply(BigDecimal.valueOf(tokens)).divide(MILLION, 8, RoundingMode.HALF_UP);
    }
}
