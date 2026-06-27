package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.TransportLegRequest;
import de.baier.familyadmin.dto.TransportLegResponse;
import de.baier.familyadmin.service.TransportLegService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trips/{tripId}/transport")
@RequiredArgsConstructor
public class TransportLegController {

    private final TransportLegService transportLegService;

    @GetMapping
    public List<TransportLegResponse> getLegs(@PathVariable UUID tripId) {
        return transportLegService.getLegs(tripId).stream()
                .map(TransportLegResponse::from)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TransportLegResponse addLeg(@PathVariable UUID tripId,
                                       @RequestBody TransportLegRequest req) {
        return TransportLegResponse.from(transportLegService.addLeg(tripId, req));
    }

    @PutMapping("/{legId}")
    public TransportLegResponse updateLeg(@PathVariable UUID tripId,
                                          @PathVariable UUID legId,
                                          @RequestBody TransportLegRequest req) {
        return TransportLegResponse.from(transportLegService.updateLeg(legId, req));
    }

    @DeleteMapping("/{legId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLeg(@PathVariable UUID tripId, @PathVariable UUID legId) {
        transportLegService.deleteLeg(legId);
    }

    @PostMapping("/{legId}/check-flight")
    public TransportLegResponse refreshFlightStatus(@PathVariable UUID tripId,
                                                     @PathVariable UUID legId) {
        return TransportLegResponse.from(transportLegService.refreshFlightStatus(legId));
    }
}
