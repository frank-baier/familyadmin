package de.baier.familyadmin.finance;

import java.util.List;

public record PortfolioImportResult(
        int importedCount,
        List<String> warnings,
        PortfolioResponse portfolio
) {}
