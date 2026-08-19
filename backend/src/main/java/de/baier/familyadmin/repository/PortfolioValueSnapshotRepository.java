package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.PortfolioValueSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PortfolioValueSnapshotRepository extends JpaRepository<PortfolioValueSnapshot, UUID> {
    List<PortfolioValueSnapshot> findByPortfolioIdOrderBySnapshotDateAsc(UUID portfolioId);
    Optional<PortfolioValueSnapshot> findByPortfolioIdAndSnapshotDate(UUID portfolioId, LocalDate snapshotDate);
}
