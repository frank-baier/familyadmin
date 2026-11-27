package de.baier.familyadmin.travel;

import java.time.Instant;

public record FlightLookupResponse(
        String flightIata,
        String depCode,
        String depCity,
        String arrCode,
        String arrCity,
        String airlineName,
        Integer durationMinutes,
        Instant departureAt,
        Instant arrivalAt
) {}
