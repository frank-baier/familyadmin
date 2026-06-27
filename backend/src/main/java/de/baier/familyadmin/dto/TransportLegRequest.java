package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.TransportType;
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
        int position,
        String flightNumber
) {}
