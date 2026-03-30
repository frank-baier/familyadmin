package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.TripKeyInfoRequest;
import de.baier.familyadmin.dto.TripKeyInfoResponse;
import de.baier.familyadmin.dto.TripRequest;
import de.baier.familyadmin.dto.TripResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.PhotoService;
import de.baier.familyadmin.service.TripService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trips")
@RequiredArgsConstructor
public class TripController {

    private final TripService tripService;
    private final PhotoService photoService;

    @GetMapping
    public ResponseEntity<List<TripResponse>> getAll() {
        return ResponseEntity.ok(tripService.getAll().stream().map(TripResponse::from).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TripResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(TripResponse.from(tripService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<TripResponse> create(@Valid @RequestBody TripRequest request,
                                                @AuthenticationPrincipal User currentUser) {
        var trip = tripService.createTrip(request, currentUser);
        return ResponseEntity
                .created(URI.create("/api/trips/" + trip.getId()))
                .body(TripResponse.from(trip));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TripResponse> update(@PathVariable UUID id,
                                                @Valid @RequestBody TripRequest request,
                                                @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(TripResponse.from(tripService.updateTrip(id, request, currentUser)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                       @AuthenticationPrincipal User currentUser) {
        tripService.deleteTrip(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/photo")
    public ResponseEntity<TripResponse> uploadPhoto(@PathVariable UUID id,
                                                     @RequestParam("file") MultipartFile file,
                                                     @AuthenticationPrincipal User currentUser) throws IOException {
        String photoUrl = photoService.savePhoto(file);
        var trip = tripService.updateCoverPhoto(id, photoUrl, currentUser);
        return ResponseEntity.ok(TripResponse.from(trip));
    }

    @PostMapping("/{tripId}/key-info")
    public ResponseEntity<TripResponse> addKeyInfo(@PathVariable UUID tripId,
                                                    @Valid @RequestBody TripKeyInfoRequest request,
                                                    @AuthenticationPrincipal User currentUser) {
        var trip = tripService.addKeyInfo(tripId, request, currentUser);
        return ResponseEntity.ok(TripResponse.from(trip));
    }

    @DeleteMapping("/{tripId}/key-info/{infoId}")
    public ResponseEntity<Void> deleteKeyInfo(@PathVariable UUID tripId,
                                               @PathVariable UUID infoId,
                                               @AuthenticationPrincipal User currentUser) {
        tripService.deleteKeyInfo(tripId, infoId, currentUser);
        return ResponseEntity.noContent().build();
    }
}
