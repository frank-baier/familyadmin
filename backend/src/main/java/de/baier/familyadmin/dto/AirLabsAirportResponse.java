package de.baier.familyadmin.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AirLabsAirportResponse(List<AirportData> response) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AirportData(
            @JsonProperty("iata_code") String iataCode,
            @JsonProperty("name") String name,
            @JsonProperty("city") String city
    ) {}
}
