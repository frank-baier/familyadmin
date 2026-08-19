package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.Portfolio;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PortfolioResponse(
        UUID id,
        String name,
        UserResponse createdBy,
        BigDecimal totalCostBasis,
        BigDecimal totalCurrentValue,
        BigDecimal totalGainLoss,
        BigDecimal totalGainLossPercent,
        List<PortfolioPositionResponse> positions,
        List<PortfolioAnalysisResponse> analyses,
        List<UserResponse> sharedWith,
        Instant createdAt,
        Instant updatedAt
) {
    public static PortfolioResponse from(Portfolio portfolio) {
        List<PortfolioPositionResponse> positions = portfolio.getPositions().stream()
                .map(PortfolioPositionResponse::from).toList();

        BigDecimal totalCostBasis = positions.stream()
                .map(PortfolioPositionResponse::costBasis)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCurrentValue = positions.stream()
                .map(p -> p.currentValue() != null ? p.currentValue() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalGainLoss = totalCurrentValue.subtract(totalCostBasis);
        BigDecimal totalGainLossPercent = totalCostBasis.signum() != 0
                ? totalGainLoss.divide(totalCostBasis, 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        return new PortfolioResponse(
                portfolio.getId(),
                portfolio.getName(),
                UserResponse.from(portfolio.getCreatedBy()),
                totalCostBasis,
                totalCurrentValue,
                totalGainLoss,
                totalGainLossPercent,
                positions,
                portfolio.getAnalyses().stream().map(PortfolioAnalysisResponse::from).toList(),
                portfolio.getShares().stream().map(s -> UserResponse.from(s.getUser())).toList(),
                portfolio.getCreatedAt(),
                portfolio.getUpdatedAt()
        );
    }
}
