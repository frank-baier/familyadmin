package de.baier.familyadmin.documents;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.documents.DocumentSearchService.Meta;
import de.baier.familyadmin.documents.DocumentSearchService.Plan;
import de.baier.familyadmin.documents.DocumentSearchService.Scored;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentSearchTest {

    private static Meta doc(String filename, String category, String sub) {
        return new Meta(UUID.randomUUID(), filename, "application/pdf", filename.length() * 1000L,
                category, sub, null, Instant.now());
    }

    private static Plan plan(List<String> terms, List<String> types, List<Integer> years) {
        return new Plan(terms, types, years, null, BigDecimal.ZERO);
    }

    private static final Plan FERNWAERME_VERTRAG = plan(
            List.of("Fernwärme", "Wärmelieferung", "Wärmenetz", "Nahwärme", "Hausanschluss"),
            List.of("Vertrag", "Vereinbarung"), List.of());

    private static final Plan FERNWAERME_RECHNUNG = plan(
            List.of("Fernwärme", "Fermwärme", "Wärmenetz", "Nahwärme", "Hausanschluss"),
            List.of("Rechnung", "Abrechnung", "Re"), List.of());

    @Test
    void foldIgnoresCaseUmlautsAndSeparators() {
        assertThat(DocumentSearchService.fold("Haus-Anschlussvertrag Nahwärme")).isEqualTo("hausanschlussvertragnahwaerme");
        assertThat(DocumentSearchService.fold("Fernwaerme")).isEqualTo(DocumentSearchService.fold("Fernwärme"));
    }

    @Test
    void contractsAreFoundBySynonymsInTheName() {
        var contract = DocumentSearchService.score(doc("Wärmelieferungsvertrag V25.01 Baier 19.10.2025.pdf",
                "Lieferanten", "Heizung"), FERNWAERME_VERTRAG, null, null);
        var hausanschluss = DocumentSearchService.score(doc("Haus-Anschlussvertrag Nahwärme 19.10.2025.pdf",
                "Lieferanten", "Heizung"), FERNWAERME_VERTRAG, null, null);
        var invoice = DocumentSearchService.score(doc("Graf_Rechnung_09.2026.pdf",
                "Lieferanten", "Heizung/Fernwärme/Graf"), FERNWAERME_VERTRAG, null, null);

        assertThat(contract).isNotNull();
        assertThat(contract.matchedBy()).contains("Name");
        assertThat(hausanschluss).isNotNull();
        // An invoice in the Fernwärme folder is still shown, but below the contracts.
        assertThat(invoice).isNotNull();
        assertThat(invoice.score()).isLessThan(contract.score());
        assertThat(invoice.score()).isLessThan(hausanschluss.score());
    }

    @Test
    void invoicesInTheTopicFolderRankAboveContracts() {
        var graf = DocumentSearchService.score(doc("Re Fa. Graf_09.2026.pdf",
                "Lieferanten", "Heizung/Fernwärme/Graf"), FERNWAERME_RECHNUNG, null, null);
        var stadtwerke = DocumentSearchService.score(doc("Rechnung Fermwärmeanschluss Stadtwerke 11.05.2026.pdf",
                "Lieferanten", "Heizung/Fernwärme/Stadtwerke"), FERNWAERME_RECHNUNG, null, null);
        var contract = DocumentSearchService.score(doc("Wärmelieferungsvertrag V25.01 Baier 19.10.2025.pdf",
                "Lieferanten", "Heizung"), FERNWAERME_RECHNUNG, 0.6, 0.8);
        var water = DocumentSearchService.score(doc("Energiedienst Wasser Rechnung für 2015.pdf",
                "Lieferanten", "Wasser"), FERNWAERME_RECHNUNG, null, 0.3);

        assertThat(graf).isNotNull();
        assertThat(graf.matchedBy()).containsExactly("Ordner");
        assertThat(stadtwerke.score()).isGreaterThan(graf.score());
        assertThat(graf.score()).isGreaterThan(contract.score());
        // A contract with the topic in its name and text is still below the invoices.
        var namedContract = DocumentSearchService.score(doc("Haus-Anschlussvertrag Nahwärme 19.10.2025.pdf",
                "Lieferanten", "Heizung"), FERNWAERME_RECHNUNG, 0.8, 0.9);
        assertThat(graf.score()).isGreaterThan(namedContract.score());
        // "Preisblatt" contains "re", but is not an invoice.
        assertThat(DocumentSearchService.otherTypeInName(doc("Preisblatt Nahwärme.pdf", "L", null),
                List.of("Rechnung", "Re"))).isTrue();
        assertThat(DocumentSearchService.otherTypeInName(doc("Graf_Abschluss-Re_10.2026.pdf", "L", null),
                List.of("Rechnung", "Abrechnung", "Re"))).isFalse();
        // Only vaguely similar and nothing in name or text: not shown.
        assertThat(water).isNull();
    }

    @Test
    void shortTermsMustBeWholeWords() {
        var re = DocumentSearchService.score(doc("Re_ATU_Audi_06.2025.pdf", "Auto", null),
                plan(List.of(), List.of("Re"), List.of()), null, null);
        var preis = DocumentSearchService.score(doc("Preisliste.pdf", "Diverses", null),
                plan(List.of(), List.of("Re"), List.of()), null, null);
        assertThat(re).isNotNull();
        assertThat(preis).isNull();
    }

    @Test
    void yearsComeFromFieldNameOrPath() {
        assertThat(DocumentSearchService.hasYear(doc("Re_Stadtwerke_05.2026.pdf", "Lieferanten", null), 2026)).isTrue();
        assertThat(DocumentSearchService.hasYear(doc("Abrechnung 05.25.pdf", "Lieferanten", null), 2025)).isTrue();
        assertThat(DocumentSearchService.hasYear(doc("Beleg.pdf", "Finanzen", "Steuerunterlagen 2024"), 2024)).isTrue();
        assertThat(DocumentSearchService.hasYear(doc("Re_Stadtwerke_05.2026.pdf", "Lieferanten", null), 2025)).isFalse();
        assertThat(DocumentSearchService.hasYear(doc("Wärmelieferungsvertrag V25.01.pdf", "Lieferanten", null), 2025)).isFalse();
    }

    @Test
    void wrongYearPushesDocumentDown() {
        Plan p = plan(List.of("Stadtwerke"), List.of(), List.of(2025));
        var match = DocumentSearchService.score(doc("Re_Stadtwerke_05.2025.pdf", "Lieferanten", null), p, null, null);
        var other = DocumentSearchService.score(doc("Re_Stadtwerke_05.2026.pdf", "Lieferanten", null), p, null, null);
        assertThat(match.score()).isGreaterThan(2 * other.score());
    }

    @Test
    void copiesInSeveralFoldersAreMerged() {
        Meta a = doc("Rechnung Fermwärmeanschluss Stadtwerke 11.05.2026.pdf", "Lieferanten", "Heizung/Fernwärme/Stadtwerke");
        Meta b = new Meta(UUID.randomUUID(), a.filename(), a.contentType(), a.fileSize(), "Lieferanten",
                "Heizung/Fernwärme/KfW/Belege Förderung", null, Instant.now());
        var merged = DocumentSearchService.mergeCopies(List.of(
                new Scored(a, 1.0, List.of("Name"), List.of()),
                new Scored(b, 0.9, List.of("Name"), List.of())));
        assertThat(merged).hasSize(1);
        assertThat(merged.get(0).alsoIn()).containsExactly("Lieferanten/Heizung/Fernwärme/KfW/Belege Förderung");
    }

    @Test
    void weakHitsFarBelowTheBestAreDropped() {
        var list = List.of(
                new Scored(doc("a.pdf", "A", null), 1.2, List.of(), List.of()),
                new Scored(doc("b.pdf", "A", null), 0.4, List.of(), List.of()),
                new Scored(doc("c.pdf", "A", null), 0.2, List.of(), List.of()));
        assertThat(DocumentSearchService.cutTail(list)).hasSize(2);
    }

    @Test
    void tsqueryUsesPrefixesAndOnlyLettersAndDigits() {
        assertThat(DocumentSearchService.tsquery(List.of("Fernwärme", "Wärme-Lieferung", "x'); DROP")))
                .isEqualTo("(fernwärme:*) | (wärme:* & lieferung:*) | (drop:*)");
    }

    @Test
    void planIsParsedFromJsonOrFallsBackToWords() {
        var service = new DocumentSearchService(null, null, null, null, new ObjectMapper());
        Plan p = service.parsePlan("""
                {"terms": ["Fernwärme", "Wärmenetz"], "types": ["Rechnung"], "years": [2026, 99]}""",
                "q", "claude-haiku-5-5", BigDecimal.ONE);
        assertThat(p.terms()).containsExactly("Fernwärme", "Wärmenetz");
        assertThat(p.types()).containsExactly("Rechnung");
        assertThat(p.years()).containsExactly(2026);

        Plan f = DocumentSearchService.fallbackPlan("alle Rechnungen zum Thema Fernwärme 2025");
        assertThat(f.terms()).containsExactly("Rechnungen", "Fernwärme");
        assertThat(f.years()).containsExactly(2025);
    }
}
