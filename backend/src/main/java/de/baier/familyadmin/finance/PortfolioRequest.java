package de.baier.familyadmin.finance;

import jakarta.validation.constraints.NotBlank;

public record PortfolioRequest(
        @NotBlank String name
) {}
