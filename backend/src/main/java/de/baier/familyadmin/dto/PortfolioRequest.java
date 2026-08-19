package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

public record PortfolioRequest(
        @NotBlank String name
) {}
