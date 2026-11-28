package de.baier.familyadmin.documents;

import de.baier.familyadmin.documents.ScanInboxDtos.CatalogFolder;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ScanCatalogSelectorTest {

    private static CatalogFolder f(String path, String... files) {
        return new CatalogFolder(path, List.of(files));
    }

    private static final List<CatalogFolder> CATALOG = List.of(
            f("Auto", "Re_ATU_Audi_06.2025.pdf"),
            f("Auto/2025", "Re_ATU_Audi_06.2025.pdf", "Re_Auto Mayer_Audi 05.2025.pdf", "Tüv_Audi_2025.pdf", "x.pdf"),
            f("Auto/2026", "Re_Auto Mayer_Audi 06.2026.jpg"),
            f("Behörden"),
            f("Behörden/Finanzamt"),
            f("Behörden/Finanzamt/Steuerunterlagen 2019"),
            f("Behörden/Finanzamt/Steuerunterlagen 2019/02 Aussergewöhnliche Belastungen", "Re_Zahnarzt_2019.pdf"),
            f("Behörden/Finanzamt/Steuerunterlagen 2025"),
            f("Behörden/Finanzamt/Steuerunterlagen 2025/02 Aussergewöhnliche Belastungen", "Re_ProOptik_Petra_11.2025.pdf", "b.pdf"),
            f("Behörden/Finanzamt/Steuerunterlagen 2026"),
            f("Behörden/Finanzamt/Steuerunterlagen 2026/02 Aussergewöhnliche Belastungen"),
            f("Behörden/Finanzamt/Steuerunterlagen Template 2"),
            f("Behörden/Finanzamt/Steuerunterlagen Template 2/04 Handwerker und Haushaltsnahe Diensteistungen"),
            f("Lieferanten"),
            f("Lieferanten/Heizung", "Wärmelieferungsvertrag V25.01 Baier 19.10.2025.pdf"),
            f("Lieferanten/Heizung/Fernwärme"),
            f("Lieferanten/Heizung/Fernwärme/Stadtwerke", "Rechnung Fermwärmeanschluss Stadtwerke 11.05.2026.pdf"),
            f("Lieferanten/Strom/EDNetze - Naturenergie", "Abschlag_2024.pdf"),
            f("Reisen/2024/4_Afrika/Visa", "Visum_Frank.pdf"),
            f("_Wohin?", "Scan 1.pdf"));

    private static List<String> paths(List<CatalogFolder> folders) {
        return folders.stream().map(CatalogFolder::path).toList();
    }

    @Test
    void keepsTopLevelsCurrentTaxYearsAndFittingFolders() {
        String text = "Stadtwerke Rheinfelden Rechnung Fernwärmeanschluss Übergabestation 23.11.2026";
        var out = ScanCatalogSelector.prune(CATALOG, text, Map.of(), 2026);
        var p = paths(out);

        assertThat(p).contains("Auto", "Behörden/Finanzamt", "Lieferanten/Heizung");          // top two levels
        assertThat(p).contains("Behörden/Finanzamt/Steuerunterlagen 2026/02 Aussergewöhnliche Belastungen",
                "Behörden/Finanzamt/Steuerunterlagen 2025/02 Aussergewöhnliche Belastungen",
                "Behörden/Finanzamt/Steuerunterlagen Template 2/04 Handwerker und Haushaltsnahe Diensteistungen");
        assertThat(p).contains("Lieferanten/Heizung/Fernwärme/Stadtwerke", "Lieferanten/Heizung/Fernwärme");
        assertThat(p).doesNotContain("Behörden/Finanzamt/Steuerunterlagen 2019/02 Aussergewöhnliche Belastungen",
                "Reisen/2024/4_Afrika/Visa", "_Wohin?");

        var stadtwerke = out.stream().filter(c -> c.path().endsWith("Fernwärme/Stadtwerke")).findFirst().orElseThrow();
        assertThat(stadtwerke.files()).hasSize(1);
        // Orientation folders come without examples.
        assertThat(out.stream().filter(c -> c.path().equals("Auto")).findFirst().orElseThrow().files()).isEmpty();
    }

    @Test
    void addsSubfoldersOfAFittingFolderAndCapsExamples() {
        var out = ScanCatalogSelector.prune(CATALOG, "Rechnung ATU Audi Inspektion", Map.of(), 2026);
        var auto2025 = out.stream().filter(c -> c.path().equals("Auto/2025")).findFirst().orElseThrow();
        assertThat(auto2025.files()).hasSize(ScanCatalogSelector.RELEVANT_EXAMPLES);
        assertThat(paths(out)).contains("Auto/2026");
    }

    @Test
    void taxYearsNamedInTheDocumentAreIncluded() {
        var out = ScanCatalogSelector.prune(CATALOG, "Rechnung vom 03.04.2022, Leistung 2022", Map.of(), 2026);
        assertThat(ScanCatalogSelector.yearsIn("Rechnung 2022, 2022 und 2019", 2026)).containsExactly(2022);
        assertThat(paths(out)).doesNotContain("Behörden/Finanzamt/Steuerunterlagen 2019");
    }

    @Test
    void similarArchivedDocumentsPointToTheirFolder() {
        var out = ScanCatalogSelector.prune(CATALOG, "Visum", Map.of("Reisen/4_Afrika/2024", 1.0), 2026);
        assertThat(ScanCatalogSelector.bestFolderFor("Reisen/4_Afrika/2024",
                java.util.Set.of("Reisen/2024/4_Afrika", "Reisen/2024/4_Afrika/Visa"))).isEqualTo("Reisen/2024/4_Afrika");
        assertThat(paths(out)).contains("Reisen/2024/4_Afrika/Visa");
    }

    @Test
    void compoundWordsMatchFolderTokens() {
        var words = new java.util.TreeSet<>(ScanCatalogSelector.words("Fernwärmeanschluss Stadtwerke"));
        assertThat(ScanCatalogSelector.matchesWord("fernwaerme", words)).isTrue();
        assertThat(ScanCatalogSelector.matchesWord("strom", words)).isFalse();
    }

    @Test
    void vaultPathFollowsSyncPyRules() {
        assertThat(ScanArchiveService.parse("Reisen/2025/Thailand/x.pdf"))
                .isEqualTo(new ScanArchiveService.VaultPath("Reisen", "Thailand", 2025, "x.pdf"));
        assertThat(ScanArchiveService.parse("Finanzen/Versicherung/Barmer/2026/x.pdf"))
                .isEqualTo(new ScanArchiveService.VaultPath("Finanzen", "Versicherung/Barmer", 2026, "x.pdf"));
        assertThat(ScanArchiveService.parse("Lieferanten/Heizung/x.pdf"))
                .isEqualTo(new ScanArchiveService.VaultPath("Lieferanten", "Heizung", null, "x.pdf"));
        assertThat(ScanArchiveService.parse("Behörden/Finanzamt/Steuerunterlagen 2025/02 Aussergewöhnliche Belastungen/Re.pdf"))
                .isEqualTo(new ScanArchiveService.VaultPath("Behörden",
                        "Finanzamt/Steuerunterlagen 2025/02 Aussergewöhnliche Belastungen", null, "Re.pdf"));
        assertThat(ScanArchiveService.parse("Auto/2026/Re.jpg"))
                .isEqualTo(new ScanArchiveService.VaultPath("Auto", null, 2026, "Re.jpg"));
    }

    @Test
    void summaryFallsBackToReasonAndMentionsTax() {
        var item = ScanInboxItem.builder().suggestionReason("Brillenrechnung ProOptik").taxRelevant(true).build();
        assertThat(ScanArchiveService.summaryText(item)).isEqualTo("Brillenrechnung ProOptik Steuerrelevant.");
        item.setSuggestionSummary("Rechnung ProOptik für Petra, 11.2025, 389 EUR.");
        assertThat(ScanArchiveService.summaryText(item)).startsWith("Rechnung ProOptik für Petra");
    }
}
