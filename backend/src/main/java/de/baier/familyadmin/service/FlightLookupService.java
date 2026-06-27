package de.baier.familyadmin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class FlightLookupService {

    private static final String BASE = "https://airlabs.co/api/v9";
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final ObjectMapper objectMapper;

    @Value("${app.airlabs.api-key:}")
    private String apiKey;

    public FlightLookupResponse lookup(String flightIata, LocalDate date) {
        if (!StringUtils.hasText(apiKey)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Flight lookup not configured (app.airlabs.api-key missing)");
        }

        // 1. Route schedule
        AirLabsRoutesResponse routesResp = get("/routes?flight_iata=" + flightIata, AirLabsRoutesResponse.class);
        List<AirLabsRoutesResponse.RouteData> routes = routesResp != null ? routesResp.response() : null;
        if (routes == null || routes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Flight not found: " + flightIata);
        }
        AirLabsRoutesResponse.RouteData route = routes.get(0);

        // 2. Airport display names (independent calls)
        AirLabsAirportResponse depResp = get("/airports?iata_code=" + route.depIata(), AirLabsAirportResponse.class);
        AirLabsAirportResponse arrResp = get("/airports?iata_code=" + route.arrIata(), AirLabsAirportResponse.class);
        String depCity = cityLabel(depResp, route.depIata());
        String arrCity = cityLabel(arrResp, route.arrIata());

        // 3. Airline name
        AirLabsAirlineResponse airlineResp = get("/airlines?iata_code=" + route.airlineIata(), AirLabsAirlineResponse.class);
        String airlineName = airlineName(airlineResp, route.airlineIata());

        // 4. Compute UTC departure/arrival from the route's UTC times + travel date
        Instant departureAt = null;
        Instant arrivalAt = null;
        if (date != null && StringUtils.hasText(route.depTimeUtc()) && route.duration() != null) {
            LocalTime depUtcTime = LocalTime.parse(route.depTimeUtc(), TIME_FMT);
            departureAt = LocalDateTime.of(date, depUtcTime).toInstant(ZoneOffset.UTC);
            arrivalAt = departureAt.plusSeconds((long) route.duration() * 60);
        }

        return new FlightLookupResponse(
                flightIata,
                route.depIata(),
                depCity,
                route.arrIata(),
                arrCity,
                airlineName,
                route.duration(),
                departureAt,
                arrivalAt
        );
    }

    private <T> T get(String path, Class<T> type) {
        try {
            String url = BASE + path + "&api_key=" + apiKey;
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder().uri(URI.create(url)).GET().build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("AirLabs {} returned HTTP {}", path, response.statusCode());
                return null;
            }
            return objectMapper.readValue(response.body(), type);
        } catch (Exception e) {
            log.warn("AirLabs request failed for {}: {}", path, e.getMessage());
            return null;
        }
    }

    private String cityLabel(AirLabsAirportResponse resp, String fallback) {
        if (resp == null || resp.response() == null || resp.response().isEmpty()) return fallback;
        AirLabsAirportResponse.AirportData a = resp.response().get(0);
        String label = StringUtils.hasText(a.city()) ? a.city() : a.name();
        return StringUtils.hasText(label) ? label : fallback;
    }

    private String airlineName(AirLabsAirlineResponse resp, String fallback) {
        if (resp == null || resp.response() == null || resp.response().isEmpty()) return fallback;
        AirLabsAirlineResponse.AirlineData a = resp.response().get(0);
        return StringUtils.hasText(a.name()) ? a.name() : fallback;
    }
}
