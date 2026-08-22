package de.baier.familyadmin.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Price-only performance since a given date. Positions bought after that date, or lacking
 * price history reaching back that far, are excluded from both sides of the comparison —
 * never blended in — so the delta reflects price movement only, not newly added capital.
 */
public record PortfolioPerformanceResponse(
        LocalDate since,
        BigDecimal baselineValue,
        BigDecimal currentValue,
        BigDecimal delta,
        BigDecimal deltaPercent,
        int includedPositionCount,
        int excludedPositionCount,
        List<String> excludedTickers
) {}
