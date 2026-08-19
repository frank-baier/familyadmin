package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.PortfolioShare;
import de.baier.familyadmin.model.PortfolioShareId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PortfolioShareRepository extends JpaRepository<PortfolioShare, PortfolioShareId> {
    boolean existsByPortfolioIdAndUserId(UUID portfolioId, UUID userId);
    void deleteByPortfolioIdAndUserId(UUID portfolioId, UUID userId);
}
