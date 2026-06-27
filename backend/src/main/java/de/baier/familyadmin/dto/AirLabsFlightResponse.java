package de.baier.familyadmin.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AirLabsFlightResponse(
        FlightData response
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FlightData(
            String status,
            @JsonProperty("dep_iata") String depIata,
            @JsonProperty("dep_terminal") String depTerminal,
            @JsonProperty("dep_gate") String depGate,
            @JsonProperty("dep_time_utc") String depTimeUtc,
            @JsonProperty("dep_actual_utc") String depActualUtc,
            @JsonProperty("arr_iata") String arrIata,
            @JsonProperty("arr_terminal") String arrTerminal,
            @JsonProperty("arr_gate") String arrGate,
            @JsonProperty("arr_time_utc") String arrTimeUtc,
            @JsonProperty("arr_actual_utc") String arrActualUtc,
            @JsonProperty("delayed") Integer delayed,
            @JsonProperty("flight_iata") String flightIata
    ) {}
}
