package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.Portfolio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PortfolioRepository extends JpaRepository<Portfolio, UUID> {
    List<Portfolio> findAllByOrderByNameAsc();

    @Query("""
            SELECT p FROM Portfolio p
            WHERE (p.createdBy.id = :userId
               OR p.id IN (SELECT s.portfolio.id FROM PortfolioShare s WHERE s.user.id = :userId))
            ORDER BY p.name ASC
            """)
    List<Portfolio> findAllVisibleToUser(@Param("userId") UUID userId);
}
