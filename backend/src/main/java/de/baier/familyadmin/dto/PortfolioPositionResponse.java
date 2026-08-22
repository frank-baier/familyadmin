package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.PortfolioPosition;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record PortfolioPositionResponse(
        UUID id,
        String ticker,
        String name,
        BigDecimal shares,
        BigDecimal purchasePrice,
        LocalDate purchaseDate,
        BigDecimal currentPrice,
        BigDecimal currentValue,
        BigDecimal costBasis,
        BigDecimal gainLoss,
        BigDecimal gainLossPercent,
        Instant priceUpdatedAt,
        String currency
) {
    public static PortfolioPositionResponse from(PortfolioPosition p) {
        BigDecimal costBasis = p.getPurchasePrice().multiply(p.getShares());
        BigDecimal gainLoss = p.getCurrentValue() != null ? p.getCurrentValue().subtract(costBasis) : null;
        BigDecimal gainLossPercent = (gainLoss != null && costBasis.signum() != 0)
                ? gainLoss.divide(costBasis, 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : null;
        return new PortfolioPositionResponse(
                p.getId(),
                p.getTicker(),
                p.getName(),
                p.getShares(),
                p.getPurchasePrice(),
                p.getPurchaseDate(),
                p.getCurrentPrice(),
                p.getCurrentValue(),
                costBasis,
                gainLoss,
                gainLossPercent,
                p.getPriceUpdatedAt(),
                p.getCurrency()
        );
    }
}
