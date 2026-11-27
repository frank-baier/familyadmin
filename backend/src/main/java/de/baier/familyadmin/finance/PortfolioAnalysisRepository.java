package de.baier.familyadmin.finance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PortfolioAnalysisRepository extends JpaRepository<PortfolioAnalysis, UUID> {
    List<PortfolioAnalysis> findAllByPortfolioIdOrderByCreatedAtDesc(UUID portfolioId);
}
