package de.baier.familyadmin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.dto.AirLabsFlightResponse;
import de.baier.familyadmin.model.TransportLeg;
import de.baier.familyadmin.repository.TransportLegRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class FlightStatusService {

    private static final DateTimeFormatter AIRLABS_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final String API_URL = "https://airlabs.co/api/v9/flight";

    private final TransportLegRepository transportLegRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.airlabs.api-key:}")
    private String apiKey;

    public boolean isEnabled() {
        return StringUtils.hasText(apiKey);
    }

    public TransportLeg refreshFlightStatus(TransportLeg leg) {
        if (!isEnabled()) {
            log.warn("Flight status check skipped — app.airlabs.api-key not configured");
            return leg;
        }
        if (!StringUtils.hasText(leg.getFlightNumber())) {
            log.warn("Transport leg {} has no flight number", leg.getId());
            return leg;
        }

        try {
            String url = API_URL + "?flight_iata=" + leg.getFlightNumber().toUpperCase().trim()
                    + "&api_key=" + apiKey;

            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("AirLabs returned HTTP {} for flight {}", response.statusCode(), leg.getFlightNumber());
                return leg;
            }

            AirLabsFlightResponse payload = objectMapper.readValue(response.body(), AirLabsFlightResponse.class);
            AirLabsFlightResponse.FlightData data = payload.response();

            if (data == null) {
                log.warn("No flight data returned for {}", leg.getFlightNumber());
                return leg;
            }

            leg.setFlightStatus(data.status());
            leg.setDelayMinutes(data.delayed());
            leg.setDepartureGate(data.depGate());
            leg.setDepartureTerminal(data.depTerminal());
            leg.setArrivalGate(data.arrGate());
            leg.setArrivalTerminal(data.arrTerminal());
            leg.setActualDepartureAt(parseUtc(data.depActualUtc()));
            leg.setActualArrivalAt(parseUtc(data.arrActualUtc()));
            leg.setStatusCheckedAt(Instant.now());

            leg = transportLegRepository.save(leg);
            log.info("Updated flight status for {} → {}", leg.getFlightNumber(), data.status());

        } catch (Exception e) {
            log.error("Failed to fetch flight status for {}: {}", leg.getFlightNumber(), e.getMessage());
        }

        return leg;
    }

    private Instant parseUtc(String utcStr) {
        if (!StringUtils.hasText(utcStr)) return null;
        try {
            return LocalDateTime.parse(utcStr, AIRLABS_FMT).toInstant(ZoneOffset.UTC);
        } catch (Exception e) {
            return null;
        }
    }
}
