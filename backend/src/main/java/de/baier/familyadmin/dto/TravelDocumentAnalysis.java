package de.baier.familyadmin.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TravelDocumentAnalysis(
        String documentType,   // "flight" | "accommodation" | "car_rental" | "general" | "not_travel"
        String tripTitle,
        String destination,
        String startDate,      // "YYYY-MM-DD" or null
        String endDate,
        FlightInfo flight,
        AccommodationInfo accommodation
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FlightInfo(
            String flightNumber,
            String airline,
            String departureAirport,
            String arrivalAirport,
            String departureDateTime,   // "YYYY-MM-DDTHH:MM" or null
            String arrivalDateTime
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AccommodationInfo(
            String hotelName,
            String address,
            String checkinDate,
            String checkoutDate,
            String confirmationNumber
    ) {}
}
