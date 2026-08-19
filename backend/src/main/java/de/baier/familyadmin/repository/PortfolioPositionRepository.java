package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.PortfolioPosition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PortfolioPositionRepository extends JpaRepository<PortfolioPosition, UUID> {
    List<PortfolioPosition> findAllByPortfolioId(UUID portfolioId);
}
