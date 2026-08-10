package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.TripHighlightResponse;
import de.baier.familyadmin.service.HighlightService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trips/{tripId}/highlights")
@RequiredArgsConstructor
public class HighlightController {

    private final HighlightService highlightService;

    @GetMapping
    public List<TripHighlightResponse> getHighlights(@PathVariable UUID tripId) {
        return highlightService.getHighlights(tripId);
    }

    @DeleteMapping("/{highlightId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHighlight(
            @PathVariable UUID tripId,
            @PathVariable UUID highlightId) {
        highlightService.deleteHighlight(tripId, highlightId);
    }
}
