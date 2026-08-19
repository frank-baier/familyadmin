package de.baier.familyadmin.dto;

import java.util.List;

public record PortfolioImportResult(
        int importedCount,
        List<String> warnings,
        PortfolioResponse portfolio
) {}
