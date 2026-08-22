package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.PortfolioPositionPriceHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PortfolioPositionPriceHistoryRepository extends JpaRepository<PortfolioPositionPriceHistory, UUID> {

    Optional<PortfolioPositionPriceHistory> findByPositionIdAndSnapshotDate(UUID positionId, LocalDate snapshotDate);

    List<PortfolioPositionPriceHistory> findByPositionIdAndSnapshotDateLessThanEqualOrderBySnapshotDateDesc(
            UUID positionId, LocalDate onOrBefore, Pageable pageable);
}
