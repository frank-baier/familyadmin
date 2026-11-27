package de.baier.familyadmin.travel;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AirLabsAirlineResponse(List<AirlineData> response) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AirlineData(
            @JsonProperty("iata_code") String iataCode,
            @JsonProperty("name") String name
    ) {}
}
