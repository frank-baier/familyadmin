package de.baier.familyadmin.finance;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PortfolioSnapshotResponse(
        LocalDate date,
        BigDecimal totalValue
) {
    public static PortfolioSnapshotResponse from(PortfolioValueSnapshot snapshot) {
        return new PortfolioSnapshotResponse(snapshot.getSnapshotDate(), snapshot.getTotalValue());
    }
}
