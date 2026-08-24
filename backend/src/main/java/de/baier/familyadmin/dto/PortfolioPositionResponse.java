package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.PortfolioPosition;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
        String currency,
        BigDecimal gainLossSinceYesterday,
        BigDecimal gainLossSinceYesterdayPercent
) {
    /** valueYesterday: this position's value at the most recent price point on/before yesterday, or null if none recorded yet. */
    public static PortfolioPositionResponse from(PortfolioPosition p, BigDecimal valueYesterday) {
        BigDecimal costBasis = p.getPurchasePrice().multiply(p.getShares());
        BigDecimal gainLoss = p.getCurrentValue() != null ? p.getCurrentValue().subtract(costBasis) : null;
        BigDecimal gainLossPercent = (gainLoss != null && costBasis.signum() != 0)
                ? gainLoss.divide(costBasis, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : null;

        BigDecimal gainSinceYesterday = (valueYesterday != null && p.getCurrentValue() != null)
                ? p.getCurrentValue().subtract(valueYesterday)
                : null;
        BigDecimal gainSinceYesterdayPercent = (gainSinceYesterday != null && valueYesterday.signum() != 0)
                ? gainSinceYesterday.divide(valueYesterday, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
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
                p.getCurrency(),
                gainSinceYesterday,
                gainSinceYesterdayPercent
        );
    }
}
