package de.baier.familyadmin.travel;

import jakarta.validation.constraints.NotBlank;

public record TripKeyInfoRequest(
        @NotBlank String label,
        @NotBlank String value,
        int position
) {}
