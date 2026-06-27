package de.baier.familyadmin.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AirLabsRoutesResponse(List<RouteData> response) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RouteData(
            @JsonProperty("flight_iata") String flightIata,
            @JsonProperty("dep_iata") String depIata,
            @JsonProperty("arr_iata") String arrIata,
            @JsonProperty("dep_time_utc") String depTimeUtc,
            @JsonProperty("arr_time_utc") String arrTimeUtc,
            @JsonProperty("airline_iata") String airlineIata,
            @JsonProperty("duration") Integer duration,
            @JsonProperty("days") List<String> days
    ) {}
}
