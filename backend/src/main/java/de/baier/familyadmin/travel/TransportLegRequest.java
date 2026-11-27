package de.baier.familyadmin.travel;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record TransportLegRequest(
        TransportType type,
        @NotBlank String fromLocation,
        @NotBlank String toLocation,
        @NotNull Instant departureAt,
        @NotNull Instant arrivalAt,
        String carrier,
        String bookingReference,
        String seat,
        String notes,
        String baggageAllowance,
        int position,
        String flightNumber
) {}
