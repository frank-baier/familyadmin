package de.baier.familyadmin.tax;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class TaxTest {

    private static final String Y = "Behörden/Finanzamt/Steuerunterlagen 2025";

    @Test
    void rubricOfNormalisesDoneSuffixes() {
        assertThat(TaxRubrics.rubricOf(Y + "/01 Arbeitnehmer_fertig/Lohnausweis.pdf", 2025)).isEqualTo("01 Arbeitnehmer");
        assertThat(TaxRubrics.rubricOf(Y + "/07 Renten_Petzi_fehlt/x.pdf", 2025)).isEqualTo("07 Renten");
        assertThat(TaxRubrics.rubricOf(Y + "/ED_Netze Abrechnung 2025.pdf", 2025)).isEqualTo(TaxRubrics.GENERAL);
        assertThat(TaxRubrics.rubricOf("Behörden/Finanzamt/2025/Ansässigkeitsbescheinigung.pdf", 2025))
                .isEqualTo("Finanzamt 2025");
        assertThat(TaxRubrics.rubricOf(Y + "/Nachlieferung/x.pdf", 2025)).isEqualTo("Nachlieferung");
    }

    @Test
    void targetFolderPrefersExistingPlainFolder() {
        List<String> folders = List.of(
                Y + "/04 Handwerker und Haushaltsnahe Diensteistungen_fertig",
                Y + "/04 Handwerker und Haushaltsnahe Diensteistungen",
                Y + "/02 Aussergewöhnliche Belastungen_fertig",
                Y + "/02 Aussergewöhnliche Belastungen_fertig/Unterordner");
        assertThat(TaxRubrics.targetFolder("04 Handwerker", 2025, folders))
                .isEqualTo(Y + "/04 Handwerker und Haushaltsnahe Diensteistungen");
        assertThat(TaxRubrics.targetFolder("02 Aussergewöhnliche Belastungen", 2025, folders))
                .isEqualTo(Y + "/02 Aussergewöhnliche Belastungen_fertig");
        assertThat(TaxRubrics.targetFolder("06 Kinder", 2025, folders)).isEqualTo(Y + "/06 Kinder");
        assertThat(TaxRubrics.targetFolder(null, 2025, folders)).isEqualTo(Y);
    }

    @Test
    void parsesGeneratedItems() throws Exception {
        var ai = new TaxAiService("", "m", BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE, new ObjectMapper());
        var json = ai.parseJson("""
                Ergebnis: {"items": [
                  {"rubric": "01 Arbeitnehmer_fertig", "title": "Lohnausweis 2025", "person": "Petra",
                   "source": "manual", "status": "missing", "matchedFiles": [], "priorFiles": ["2024_Lohnausweis Petra.pdf"]},
                  {"rubric": "05 Kapitalanlagen", "title": null}
                ]}""");
        var item = TaxAiService.item(json.path("items").get(0), TaxChecklistItem.Source.PRIOR_YEAR);
        assertThat(item.rubric()).isEqualTo("01 Arbeitnehmer");
        assertThat(item.source()).isEqualTo(TaxChecklistItem.Source.PRIOR_YEAR);
        assertThat(item.status()).isEqualTo(TaxChecklistItem.AiStatus.MISSING);
        assertThat(item.priorFiles()).containsExactly("2024_Lohnausweis Petra.pdf");
        assertThat(TaxAiService.item(json.path("items").get(1), TaxChecklistItem.Source.RETURN)).isNull();
    }

    @Test
    void knownPathsAcceptsPathsWithoutRoot() {
        Set<String> known = Set.of(Y + "/01 Arbeitnehmer/Lohnausweis.pdf");
        assertThat(TaxService.knownPaths(List.of("Steuerunterlagen 2025/01 Arbeitnehmer/Lohnausweis.pdf",
                Y + "/01 Arbeitnehmer/Lohnausweis.pdf", "erfunden.pdf"), known))
                .containsExactly(Y + "/01 Arbeitnehmer/Lohnausweis.pdf");
    }

    @Test
    void userMarksSurviveRewordedTitles() {
        assertThat(TaxService.key("01 Arbeitnehmer_fertig", "Lohnausweis  2025!", "Petra"))
                .isEqualTo(TaxService.key("01 Arbeitnehmer", "lohnausweis 2025", "petra"));
        assertThat(TaxService.priorKey("08", List.of("b.pdf", "A.pdf")))
                .isEqualTo(TaxService.priorKey("08", List.of("a.pdf", "b.pdf")));
    }

    @Test
    void docPathReadsLikeTheArchive() {
        assertThat(TaxService.docPath("Gesundheit", 2025, "Anna")).isEqualTo("Gesundheit / Anna / 2025");
        assertThat(TaxService.docPath(null, null, null)).isNull();
    }
}
