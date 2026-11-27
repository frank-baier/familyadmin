package de.baier.familyadmin.sport;

import de.baier.familyadmin.config.SecurityConfig;

import de.baier.familyadmin.user.User;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Apple Health data — always scoped to one user, never shared, never indexed for RAG. */
@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final HealthService healthService;

    /** Public in SecurityConfig; authenticated by the per-user sync token instead of a JWT. */
    @PostMapping("/ingest")
    public ResponseEntity<HealthIngestResult> ingest(@RequestHeader(value = "X-Health-Token", required = false) String token,
                                                     @RequestBody JsonNode payload) {
        return ResponseEntity.ok(healthService.ingest(token, payload));
    }

    @GetMapping("/daily")
    public ResponseEntity<HealthDailyResponse> daily(@RequestParam(defaultValue = "90") int days,
                                                     @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(healthService.getDaily(currentUser, days));
    }

    @DeleteMapping("/daily")
    public ResponseEntity<Map<String, Long>> deleteAll(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(Map.of("deleted", healthService.deleteAll(currentUser)));
    }

    @GetMapping("/token")
    public ResponseEntity<HealthTokenResponse> tokenStatus(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(healthService.getTokenStatus(currentUser));
    }

    @PostMapping("/token")
    public ResponseEntity<HealthTokenResponse> rotateToken(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(healthService.rotateToken(currentUser));
    }

    @DeleteMapping("/token")
    public ResponseEntity<Void> revokeToken(@AuthenticationPrincipal User currentUser) {
        healthService.revokeToken(currentUser);
        return ResponseEntity.noContent().build();
    }
}
