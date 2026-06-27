package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.FlightLookupResponse;
import de.baier.familyadmin.service.FlightLookupService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/transport")
@RequiredArgsConstructor
public class FlightLookupController {

    private final FlightLookupService flightLookupService;

    @GetMapping("/flights/lookup")
    public FlightLookupResponse lookup(
            @RequestParam("flight_iata") String flightIata,
            @RequestParam(value = "date", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return flightLookupService.lookup(flightIata.toUpperCase().trim(), date);
    }
}
