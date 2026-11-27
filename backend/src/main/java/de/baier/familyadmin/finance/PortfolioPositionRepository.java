package de.baier.familyadmin.finance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PortfolioPositionRepository extends JpaRepository<PortfolioPosition, UUID> {
    List<PortfolioPosition> findAllByPortfolioId(UUID portfolioId);
}
