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
        @NotNull LocalDate purchaseDate,
        /** Currency purchasePrice is denominated in, e.g. "CHF". Null/omitted means it's already EUR. */
        String purchaseCurrency
) {}
