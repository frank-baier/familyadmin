package de.baier.familyadmin.dto;

import jakarta.validation.constraints.NotBlank;

public record TripKeyInfoRequest(
        @NotBlank String label,
        @NotBlank String value,
        int position
) {}
