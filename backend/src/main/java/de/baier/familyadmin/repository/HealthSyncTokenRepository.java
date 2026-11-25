package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.HealthSyncToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HealthSyncTokenRepository extends JpaRepository<HealthSyncToken, UUID> {
    Optional<HealthSyncToken> findByTokenHash(String tokenHash);
}
