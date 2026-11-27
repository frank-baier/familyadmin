package de.baier.familyadmin.sport;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "health_sync_tokens")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HealthSyncToken {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;
}
