package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PortfolioPositionRequest(
        @NotBlank String ticker,
        String name,
        @NotNull @Positive BigDecimal shares,
        @NotNull @Positive BigDecimal purchasePrice,
        @NotNull LocalDate purchaseDate
) {}
