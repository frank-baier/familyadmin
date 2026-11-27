package de.baier.familyadmin.sport;

import java.time.Instant;

/** {@code token} is only filled right after generation — it is never retrievable again. */
public record HealthTokenResponse(boolean exists, Instant createdAt, Instant lastUsedAt, String token) {}
