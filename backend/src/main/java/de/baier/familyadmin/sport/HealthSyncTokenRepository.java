package de.baier.familyadmin.sport;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HealthSyncTokenRepository extends JpaRepository<HealthSyncToken, UUID> {
    Optional<HealthSyncToken> findByTokenHash(String tokenHash);
}
