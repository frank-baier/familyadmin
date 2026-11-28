package de.baier.familyadmin.tax;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.*;

/**
 * Claude calls of the tax assistant: builds the checklist of a year from last year's folder
 * (and the imported return), checks archive documents for tax relevance and reads a return.
 * Only file names, folder paths and short text excerpts are sent – except for the return
 * itself, which the user uploads explicitly for that purpose.
 */
@Slf4j
@Service
public class TaxAiService {

    private static final BigDecimal MILLION = BigDecimal.valueOf(1_000_000);
    private static final int MAX_RETURN_TEXT_CHARS = 120_000;
    private static final long MAX_RETURN_PDF_BYTES = 30L * 1024 * 1024;

    private final AnthropicClient client;
    private final String model;
    private final BigDecimal inputPrice;
    private final BigDecimal outputPrice;
    private final BigDecimal cacheReadPrice;
    private final ObjectMapper objectMapper;

    /** An item of the checklist as the model returns it. */
    public record GeneratedItem(String rubric, String title, String person, String note,
                                TaxChecklistItem.Source source, TaxChecklistItem.AiStatus status,
                                List<String> matchedFiles, List<String> priorFiles) {}

    /** Status the model gives to an item the user added by hand. */
    public record ManualVerdict(String key, TaxChecklistItem.AiStatus status, List<String> matchedFiles) {}

    public record ChecklistResult(String summary, List<GeneratedItem> items, List<ManualVerdict> manual,
                                  String model, BigDecimal costUsd) {}

    /** An archive document to check; {@code excerpt} is the start of its extracted text. */
    public record Candidate(UUID documentId, String filename, String path, String excerpt) {}

    public record Verdict(UUID documentId, TaxHint.Status status, String rubric, String reason) {}

    public record HintBatchResult(List<Verdict> verdicts, String model, BigDecimal costUsd) {}

    public record ReturnResult(String summary, List<GeneratedItem> items, String model, BigDecimal costUsd) {}

    /** What the checklist prompt is built from; paths are relative to "Dokumente". */
    public record ChecklistInput(int year, List<String> currentFiles, List<String> priorFiles,
                                 List<String> returnItems, Map<String, String> manualItems,
                                 String returnSummary) {}

    public TaxAiService(@Value("${anthropic.api-key:}") String apiKey,
                        @Value("${tax.anthropic-model:claude-opus-5-5}") String model,
                        @Value("${tax.price-input-usd-per-mtok:4.00}") BigDecimal inputPrice,
                        @Value("${tax.price-output-usd-per-mtok:20.00}") BigDecimal outputPrice,
                        @Value("${tax.price-cache-read-usd-per-mtok:0.20}") BigDecimal cacheReadPrice,
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

    // ── Background knowledge (cached system block) ──────────────────────────

    static final String FAMILY = """
            Du hilfst der Familie Baier beim Zusammentragen der Unterlagen für die DEUTSCHE
            Einkommensteuererklärung (Zusammenveranlagung, Finanzamt Lörrach).

            Familie:
            - Frank und Petra wohnen mit den Kindern in Deutschland und arbeiten in Basel (Schweiz):
              Grenzgänger nach Art. 15a DBA Deutschland–Schweiz.
            - Frank: Helvetia Versicherung, Basel (früher Baloise; Belege heißen oft noch "Baloise").
            - Petra: Universitätsspital Basel.
            - Kinder: in Dateinamen z. B. Anna und Jule.

            Ablage: iCloud "Dokumente/Behörden/Finanzamt/Steuerunterlagen <Jahr>/<Rubrik>/…".
            Rubriken (Ordnernamen, Zusätze wie "_fertig", "_uploaded" bedeuten "erledigt"):
            01 Arbeitnehmer, 02 Aussergewöhnliche Belastungen,
            04 Handwerker und Haushaltsnahe Diensteistungen, 05 Kapitalanlagen, 06 Kinder,
            07 Renten, 08 Sonderausgaben_Spenden, 09 Vermietungen, 10 Versicherungen.
            Dateien direkt im Jahresordner heißen Rubrik "Allgemein". Zusätzlich gibt es
            "Behörden/Finanzamt/<Jahr>" (Rubrik "Finanzamt <Jahr>") mit Post vom/ans Finanzamt,
            z. B. Ansässigkeitsbescheinigungen und Fragebogen Grenzgänger.

            Was bei Grenzgängern CH→DE typischerweise gebraucht wird (Checkliste, nicht alles
            trifft jedes Jahr zu):
            01 Arbeitnehmer (Anlage N, N-Gre):
            - Schweizer Lohnausweis je Person (statt deutscher Lohnsteuerbescheinigung), dazu
              Lohnkonto/Lohnabrechnung Dezember; darin die Schweizer Quellensteuer (max. 4,5 %),
              die in Deutschland angerechnet wird.
            - Ansässigkeitsbescheinigung (Gre-1) je Person für den Arbeitgeber, bei Wechsel neu.
            - Bescheinigung des Arbeitgebers über die Sozialversicherungsbeiträge
              (AHV/IV/EO, ALV, Pensionskasse obligatorisch/überobligatorisch, NBU, KTG) –
              für Vorsorgeaufwendungen ("Steuerbestätigung Soz. Vers. DE Grenzgänger").
            - Nichtrückkehrtage (> 60 Tage gefährdet den Grenzgängerstatus), Homeoffice-Tage
              (Homeoffice-Pauschale), Arbeitstage für die Entfernungspauschale, Arbeitsmittel,
              Fortbildung, Arbeitslosengeld/Elterngeld (Progressionsvorbehalt, Leistungsnachweis).
            - Mitarbeiteraktien: Übersicht des Arbeitgebers bzw. Angaben im Lohnausweis.
            02 Aussergewöhnliche Belastungen: Arzt-, Zahnarzt-, Therapie-, Brillen-, Hörgeräte-,
              Apotheken- und Krankenhausrechnungen, Einlagen; Erstattungen der Krankenkasse
              gegenrechnen (Kostenübernahme/Erstattungsbescheid).
            04 Handwerker/haushaltsnahe Dienstleistungen (§ 35a EStG, nur Arbeitskosten, unbar
              bezahlt, im eigenen Haushalt): Handwerker, Wartung Heizung, Schornsteinfeger,
              Minijob im Haushalt (Haushaltsscheck, Bescheinigung Minijob-Zentrale),
              Nebenkostenabrechnung mit § 35a-Anteil. Auto-Reparaturen zählen NICHT.
            05 Kapitalanlagen (Anlage KAP/KAP-INV): Jahressteuerbescheinigungen deutscher Banken,
              Abschlüsse ausländischer Banken/Broker (keine Abgeltungsteuer → selbst erklären),
              Dividenden Schweizer Aktien mit 35 % Verrechnungssteuer (15 % anrechenbar,
              Rest per Rückerstattungsantrag), Zinsbescheinigungen, Aktienverkäufe.
            06 Kinder (Anlage Kind): Kinderbetreuungskosten, Schulgeld Privatschule (30 %),
              Schweizer Familien-/Kinderzulagen (im Lohnausweis) vs. deutsches Kindergeld.
            07 Renten/Vorsorge: Pensionskassen-Beiträge und Einkäufe (Bescheinigung der PK),
              Säule 3a (in DE nicht absetzbar), Rentenbezüge.
            08 Sonderausgaben/Spenden: Zuwendungsbestätigungen, Kirchensteuer, Schulgeld,
              Steuerberatungskosten (anteilig).
            09 Vermietungen (Anlage V): WEG-Jahresabrechnung, Darlehens-Zinsbescheinigung,
              Mieteinnahmen, Nebenkostenabrechnung an Mieter, Grundsteuer, Handwerkerrechnungen
              der vermieteten Wohnung, Fahrten zum Objekt.
            10 Versicherungen (Vorsorgeaufwand): Bescheinigungen der Krankenkassen für das
              Finanzamt (Basisabsicherung, Pflege), ausländische KV (z. B. Swica), Haftpflicht,
              Unfall, Berufsunfähigkeit, Risikoleben.
            Allgemein: Steuerbescheid des Vorjahres, Steuerberater-Rechnung, Abrechnung der
              Photovoltaik (meist steuerfrei nach § 3 Nr. 72 EStG, trotzdem ablegen).
            """;

    // ── Checklist ───────────────────────────────────────────────────────────

    private static final String CHECKLIST_TASK = """
            Aufgabe: Erstelle die Checkliste für das Steuerjahr %1$d und gleiche sie mit dem
            Ordner "Steuerunterlagen %1$d" ab.

            Quellen der Checkliste:
            - PRIOR_YEAR: Jeder Beleg, der im Vorjahresordner lag und jedes Jahr wiederkommt
              (Lohnausweis, Jahressteuerbescheinigung, Spendenbescheinigung derselben
              Organisation, WEG-Abrechnung …), wird ein Eintrag. Gleichartige Belege fasst du
              zusammen (z. B. 12 Monatsrechnungen derselben Therapeutin = 1 Eintrag; "Lohnausweis"
              und "Lohnkonto" derselben Person getrennt). Einmalige Belege des Vorjahres
              (einzelne Arztrechnung, Handwerkerrechnung) werden KEIN eigener Eintrag.
            - RETURN: Positionen aus der Vorjahres-Steuererklärung (falls unten vorhanden).
            - BASELINE: Was bei dieser Familie laut Grenzgänger-Checkliste fehlen könnte, obwohl
              es im Vorjahr nicht lag – nur wenn es wahrscheinlich zutrifft, höchstens 8 Einträge.

            Abgleich je Eintrag mit dem aktuellen Ordner:
            - FOUND: ein passender Beleg liegt da (matchedFiles = exakte Pfade aus der Liste).
            - PARTIAL: nur teilweise (z. B. Lohnausweis Frank da, Petra fehlt → zwei Einträge
              wären besser; PARTIAL z. B. bei 8 von 12 Monatsrechnungen).
            - MISSING: nichts Passendes.
            Bezieht sich ein Beleg auf ein anderes Jahr (z. B. "…_2025" im Ordner 2024), passt er
            nicht. Jahresbescheinigungen kommen oft erst im Folgejahr – das ist normal.

            Außerdem: Auffälligkeiten im aktuellen Ordner (Beleg in falscher Rubrik, vermutlich
            nicht absetzbar, falsches Jahr, doppelt) als Zeilen im summary, jede beginnend mit "⚠ ".

            Antworte NUR mit JSON:
            {"summary": "2–3 Sätze Überblick auf Deutsch, danach ggf. ⚠-Zeilen",
             "items": [{"rubric": "01 Arbeitnehmer", "title": "Lohnausweis %1$d", "person": "Petra"|null,
                        "note": "kurzer Hinweis, was genau gebraucht wird/woher"|null,
                        "source": "PRIOR_YEAR"|"RETURN"|"BASELINE",
                        "status": "FOUND"|"PARTIAL"|"MISSING",
                        "matchedFiles": ["Behörden/Finanzamt/…"], "priorFiles": ["Dateiname im Vorjahr"]}],
             "manual": [{"key": "m1", "status": "FOUND"|"PARTIAL"|"MISSING", "matchedFiles": []}]}
            Sortiere items nach Rubrik. title kurz und konkret (Aussteller + Belegart).
            """;

    public ChecklistResult checklist(ChecklistInput in) {
        StringBuilder sb = new StringBuilder();
        sb.append(CHECKLIST_TASK.formatted(in.year())).append('\n');
        sb.append("Heute ist ").append(today()).append(".\n\n");
        sb.append("Vorjahresordner (Steuerunterlagen ").append(in.year() - 1).append(" und Finanzamt/")
                .append(in.year() - 1).append("):\n").append(lines(in.priorFiles())).append('\n');
        if (StringUtils.hasText(in.returnSummary())) {
            sb.append("Zusammenfassung der Steuererklärung ").append(in.year() - 1).append(":\n")
                    .append(in.returnSummary().strip()).append("\n\n");
        }
        if (!in.returnItems().isEmpty()) {
            sb.append("Positionen aus der Steuererklärung ").append(in.year() - 1).append(" (Quelle RETURN):\n")
                    .append(lines(in.returnItems())).append('\n');
        }
        if (!in.manualItems().isEmpty()) {
            sb.append("Vom Benutzer selbst angelegte Einträge (nicht in items wiederholen, nur in manual bewerten):\n");
            in.manualItems().forEach((k, v) -> sb.append("- ").append(k).append(": ").append(v).append('\n'));
            sb.append('\n');
        }
        sb.append("AKTUELLER Ordner (Steuerunterlagen ").append(in.year()).append(" und Finanzamt/")
                .append(in.year()).append("):\n").append(lines(in.currentFiles()));

        Answer a = call(List.of(textBlock(sb.toString())), 24_000L, OutputConfig.Effort.MEDIUM);
        JsonNode json = parseJson(a.text());
        List<GeneratedItem> items = new ArrayList<>();
        for (JsonNode n : json.path("items")) {
            GeneratedItem item = item(n, TaxChecklistItem.Source.PRIOR_YEAR);
            if (item != null) items.add(item);
        }
        List<ManualVerdict> manual = new ArrayList<>();
        for (JsonNode n : json.path("manual")) {
            String key = text(n, "key");
            if (key != null) manual.add(new ManualVerdict(key, aiStatus(text(n, "status")), strings(n.path("matchedFiles"))));
        }
        log.info("Tax checklist {}: {} items, ${}", in.year(), items.size(), a.cost());
        return new ChecklistResult(text(json, "summary"), items, manual, model, a.cost());
    }

    // ── Hints: is an archive document tax relevant? ─────────────────────────

    private static final String HINTS_TASK = """
            Aufgabe: Prüfe Dokumente aus dem Familienarchiv (außerhalb des Steuerordners), ob sie
            für die Steuererklärung %1$d gebraucht werden.
            - RELEVANT: Beleg gehört in "Steuerunterlagen %1$d" und liegt dort noch nicht.
            - ALREADY_FILED: relevant, aber ein Beleg mit gleichem Inhalt liegt schon im Ordner
              (gleicher Aussteller und Zeitraum, ähnlicher Dateiname).
            - NOT_RELEVANT: Kassenzettel für Alltagseinkäufe, Garantien, Werbung, Verträge ohne
              Jahresbezug, Belege eines anderen Steuerjahres, Auto-Reparaturen, Säule 3a …
            Steuerjahr ist das Jahr der Leistung/Zahlung bzw. das bescheinigte Jahr.
            Sei bei RELEVANT eher großzügig (der Benutzer entscheidet), aber nicht bei offensichtlichem
            Alltagskram.

            Antworte NUR mit JSON:
            {"results": [{"n": 1, "verdict": "RELEVANT"|"ALREADY_FILED"|"NOT_RELEVANT",
                          "rubric": "02 Aussergewöhnliche Belastungen"|null,
                          "reason": "ein kurzer deutscher Satz"}]}
            Für JEDES Dokument genau ein Ergebnis.
            """;

    public HintBatchResult classify(int year, List<String> currentFiles, List<Candidate> batch) {
        StringBuilder sb = new StringBuilder(HINTS_TASK.formatted(year)).append('\n');
        sb.append("Heute ist ").append(today()).append(".\n\n");
        sb.append("Schon im Ordner Steuerunterlagen ").append(year).append(":\n").append(lines(currentFiles)).append('\n');
        sb.append("Zu prüfende Dokumente:\n");
        for (int i = 0; i < batch.size(); i++) {
            Candidate c = batch.get(i);
            sb.append("\n[").append(i + 1).append("] ").append(c.filename())
                    .append("\n    Ablage: ").append(c.path() == null ? "–" : c.path());
            if (StringUtils.hasText(c.excerpt())) {
                sb.append("\n    Textanfang: ").append(c.excerpt().replaceAll("\\s+", " ").strip());
            }
            sb.append('\n');
        }

        Answer a = call(List.of(textBlock(sb.toString())), 8_000L, OutputConfig.Effort.LOW);
        JsonNode json = parseJson(a.text());
        List<Verdict> verdicts = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();
        for (JsonNode n : json.path("results")) {
            int idx = n.path("n").asInt(0);
            if (idx < 1 || idx > batch.size() || !seen.add(idx)) continue;
            TaxHint.Status status = switch (Objects.toString(text(n, "verdict"), "").toUpperCase(Locale.ROOT)) {
                case "RELEVANT" -> TaxHint.Status.PENDING;
                case "ALREADY_FILED" -> TaxHint.Status.ALREADY_FILED;
                default -> TaxHint.Status.NOT_RELEVANT;
            };
            verdicts.add(new Verdict(batch.get(idx - 1).documentId(), status,
                    TaxRubrics.normalise(text(n, "rubric")), text(n, "reason")));
        }
        return new HintBatchResult(verdicts, model, a.cost());
    }

    // ── Reading last year's return ──────────────────────────────────────────

    private static final String RETURN_TASK = """
            Aufgabe: Das ist die Steuererklärung %1$d der Familie (oder der Steuerbescheid).
            Leite daraus ab, welche Belege für die Erklärung %2$d wieder gebraucht werden:
            je Anlage/Position mit Betrag ein Eintrag (z. B. Anlage N-Gre Frank → "Lohnausweis
            %2$d Frank"; Anlage KAP Zeile ausländische Kapitalerträge → "Abschluss <Bank> %2$d";
            Spenden an <Organisation>; Krankheitskosten; § 35a-Positionen; Anlage V je Objekt;
            Vorsorgeaufwendungen je Versicherung; Kinderbetreuung je Kind …).
            Konkrete Aussteller/Organisationen aus der Erklärung übernehmen, wenn sie erkennbar sind.
            Beträge des Vorjahres als Orientierung in note (z. B. "2024: 1.240 €").

            Antworte NUR mit JSON:
            {"summary": "3–6 Sätze: welche Anlagen, Besonderheiten (Grenzgänger, Vermietung,
                         Kapitalerträge, Erstattung/Nachzahlung), worauf %2$d achten",
             "items": [{"rubric": "01 Arbeitnehmer", "title": "…", "person": "Frank"|null, "note": "…"|null}]}
            """;

    public ReturnResult readReturn(int returnYear, String filename, String contentType, byte[] data) {
        List<ContentBlockParam> content = new ArrayList<>();
        boolean pdf = "application/pdf".equalsIgnoreCase(contentType)
                || filename.toLowerCase(Locale.ROOT).endsWith(".pdf");
        if (!pdf) throw new IllegalArgumentException("Bitte die Steuererklärung als PDF hochladen");
        String text = pdfText(data);
        if (text.replaceAll("\\s+", "").length() >= 500) {
            if (text.length() > MAX_RETURN_TEXT_CHARS) text = text.substring(0, MAX_RETURN_TEXT_CHARS);
            content.add(textBlock("Text der Datei \"" + filename + "\":\n<<<\n" + text.strip() + "\n>>>"));
        } else if (data.length <= MAX_RETURN_PDF_BYTES) {
            content.add(ContentBlockParam.ofDocument(DocumentBlockParam.builder()
                    .source(Base64PdfSource.builder().data(Base64.getEncoder().encodeToString(data)).build())
                    .build()));
        } else {
            throw new IllegalArgumentException("PDF ohne Textebene und größer als 30 MB");
        }
        content.add(textBlock(RETURN_TASK.formatted(returnYear, returnYear + 1)));

        Answer a = call(content, 16_000L, OutputConfig.Effort.MEDIUM);
        JsonNode json = parseJson(a.text());
        List<GeneratedItem> items = new ArrayList<>();
        for (JsonNode n : json.path("items")) {
            GeneratedItem item = item(n, TaxChecklistItem.Source.RETURN);
            if (item != null) items.add(item);
        }
        log.info("Tax return {} read: {} items, ${}", returnYear, items.size(), a.cost());
        return new ReturnResult(text(json, "summary"), items, model, a.cost());
    }

    // ── Plumbing ────────────────────────────────────────────────────────────

    private record Answer(String text, BigDecimal cost) {}

    private Answer call(List<ContentBlockParam> content, long maxTokens, OutputConfig.Effort effort) {
        if (client == null) throw new IllegalStateException("ANTHROPIC_API_KEY ist nicht konfiguriert");
        Message message = client.messages().create(MessageCreateParams.builder()
                .model(model)
                .maxTokens(maxTokens)
                .outputConfig(OutputConfig.builder().effort(effort).build())
                .systemOfTextBlockParams(List.of(TextBlockParam.builder().text(FAMILY)
                        .cacheControl(CacheControlEphemeral.builder().build()).build()))
                .addUserMessageOfContentBlockParams(content)
                .build());
        if (message.stopReason().map(r -> r.equals(StopReason.REFUSAL)).orElse(false)) {
            throw new IllegalStateException("Claude hat die Anfrage abgelehnt");
        }
        if (message.stopReason().map(r -> r.equals(StopReason.MAX_TOKENS)).orElse(false)) {
            throw new IllegalStateException("Antwort zu lang (max_tokens erreicht)");
        }
        String answer = message.content().stream()
                .flatMap(b -> b.text().stream()).map(TextBlock::text)
                .reduce("", String::concat).strip();
        Usage usage = message.usage();
        long cacheWrite = usage.cacheCreationInputTokens().orElse(0L);
        long cacheRead = usage.cacheReadInputTokens().orElse(0L);
        BigDecimal cost = perMTok(inputPrice, usage.inputTokens())
                .add(perMTok(inputPrice.multiply(BigDecimal.valueOf(1.25)), cacheWrite))
                .add(perMTok(cacheReadPrice, cacheRead))
                .add(perMTok(outputPrice, usage.outputTokens()))
                .setScale(6, RoundingMode.HALF_UP);
        log.debug("Tax AI call ({}): {} in / {} cache-write / {} cache-read / {} out",
                model, usage.inputTokens(), cacheWrite, cacheRead, usage.outputTokens());
        return new Answer(answer, cost);
    }

    JsonNode parseJson(String answer) {
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) throw new IllegalStateException("Keine JSON-Antwort: " + abbreviate(answer));
        try {
            return objectMapper.readTree(answer.substring(start, end + 1));
        } catch (Exception e) {
            throw new IllegalStateException("Ungültige JSON-Antwort: " + abbreviate(answer), e);
        }
    }

    static GeneratedItem item(JsonNode n, TaxChecklistItem.Source defaultSource) {
        String title = text(n, "title");
        if (title == null) return null;
        TaxChecklistItem.Source source = defaultSource;
        String s = text(n, "source");
        if (s != null) {
            try {
                source = TaxChecklistItem.Source.valueOf(s.toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ignored) {
                // keep default
            }
            if (source == TaxChecklistItem.Source.MANUAL) source = defaultSource;
        }
        return new GeneratedItem(TaxRubrics.normalise(text(n, "rubric")), cut(title, 300), cut(text(n, "person"), 60),
                text(n, "note"), source, aiStatus(text(n, "status")),
                strings(n.path("matchedFiles")), strings(n.path("priorFiles")));
    }

    static TaxChecklistItem.AiStatus aiStatus(String s) {
        if (s == null) return TaxChecklistItem.AiStatus.UNKNOWN;
        try {
            return TaxChecklistItem.AiStatus.valueOf(s.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return TaxChecklistItem.AiStatus.UNKNOWN;
        }
    }

    private static List<String> strings(JsonNode arr) {
        List<String> out = new ArrayList<>();
        if (arr != null && arr.isArray()) {
            for (JsonNode v : arr) {
                if (v.isTextual() && !v.asText().isBlank()) out.add(v.asText().strip());
            }
        }
        return out;
    }

    private static String text(JsonNode json, String field) {
        if (json == null || !json.hasNonNull(field)) return null;
        String v = json.get(field).asText().strip();
        return v.isEmpty() || "null".equalsIgnoreCase(v) ? null : v;
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    private static String lines(List<String> values) {
        if (values == null || values.isEmpty()) return "(leer)\n";
        StringBuilder sb = new StringBuilder();
        values.forEach(v -> sb.append("- ").append(v).append('\n'));
        return sb.toString();
    }

    private static String abbreviate(String s) {
        return s == null ? "" : s.length() <= 300 ? s : s.substring(0, 300) + "…";
    }

    private static String today() {
        return LocalDate.now(ZoneId.of("Europe/Berlin")).toString();
    }

    static String pdfText(byte[] data) {
        try (PDDocument doc = PDDocument.load(data)) {
            return new PDFTextStripper().getText(doc);
        } catch (Exception e) {
            log.debug("No PDF text: {}", e.getMessage());
            return "";
        }
    }

    private static ContentBlockParam textBlock(String text) {
        return ContentBlockParam.ofText(TextBlockParam.builder().text(text).build());
    }

    private static BigDecimal perMTok(BigDecimal price, long tokens) {
        return price.multiply(BigDecimal.valueOf(tokens)).divide(MILLION, 8, RoundingMode.HALF_UP);
    }
}
