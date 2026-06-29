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
        AccommodationInfo accommodation,
        CarRentalInfo carRental
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

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CarRentalInfo(
            String company,
            String vehicleType,
            String pickupDate,
            String returnDate,
            String pickupLocation,
            String returnLocation,
            String confirmationNumber
    ) {}
}
