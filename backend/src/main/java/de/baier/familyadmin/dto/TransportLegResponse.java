package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.TransportLeg;

import java.time.Instant;
import java.util.UUID;

public record TransportLegResponse(
        UUID id,
        String type,
        String fromLocation,
        String toLocation,
        Instant departureAt,
        Instant arrivalAt,
        String carrier,
        String bookingReference,
        String seat,
        String notes,
        String baggageAllowance,
        int position,
        String flightNumber,
        String flightStatus,
        Instant actualDepartureAt,
        Instant actualArrivalAt,
        String departureGate,
        String departureTerminal,
        String arrivalGate,
        String arrivalTerminal,
        Integer delayMinutes,
        Instant statusCheckedAt
) {
    public static TransportLegResponse from(TransportLeg leg) {
        return new TransportLegResponse(
                leg.getId(),
                leg.getType().name(),
                leg.getFromLocation(),
                leg.getToLocation(),
                leg.getDepartureAt(),
                leg.getArrivalAt(),
                leg.getCarrier(),
                leg.getBookingReference(),
                leg.getSeat(),
                leg.getNotes(),
                leg.getBaggageAllowance(),
                leg.getPosition(),
                leg.getFlightNumber(),
                leg.getFlightStatus(),
                leg.getActualDepartureAt(),
                leg.getActualArrivalAt(),
                leg.getDepartureGate(),
                leg.getDepartureTerminal(),
                leg.getArrivalGate(),
                leg.getArrivalTerminal(),
                leg.getDelayMinutes(),
                leg.getStatusCheckedAt()
        );
    }
}
