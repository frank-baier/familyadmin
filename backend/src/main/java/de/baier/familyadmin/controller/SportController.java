package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.SportImportResult;
import de.baier.familyadmin.dto.SportProfileDto;
import de.baier.familyadmin.dto.SportStatsResponse;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.SportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/** Sport statistics — always scoped to the logged-in user, no cross-user access. */
@RestController
@RequestMapping("/api/sport")
@RequiredArgsConstructor
public class SportController {

    private final SportService sportService;

    @GetMapping("/stats")
    public ResponseEntity<SportStatsResponse> stats(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(sportService.getStats(currentUser));
    }

    @PostMapping("/import/strava")
    public ResponseEntity<SportImportResult> importStrava(@RequestParam("file") MultipartFile file,
                                                          @AuthenticationPrincipal User currentUser) throws IOException {
        return ResponseEntity.ok(sportService.importStravaExport(file, currentUser));
    }

    @GetMapping("/profile")
    public ResponseEntity<SportProfileDto> getProfile(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(sportService.getProfile(currentUser));
    }

    @PutMapping("/profile")
    public ResponseEntity<SportProfileDto> updateProfile(@Valid @RequestBody SportProfileDto dto,
                                                         @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(sportService.updateProfile(dto, currentUser));
    }

    @DeleteMapping("/activities")
    public ResponseEntity<Map<String, Integer>> deleteAll(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(Map.of("deleted", sportService.deleteAllActivities(currentUser)));
    }
}
