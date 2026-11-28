package de.baier.familyadmin.tax;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface TaxHintRepository extends JpaRepository<TaxHint, UUID> {

    List<TaxHint> findByOwnerIdAndTaxYearAndStatusInOrderByCreatedAtDesc(UUID ownerId, Integer taxYear,
                                                                        Collection<TaxHint.Status> statuses);

    List<TaxHint> findByOwnerIdAndStatusOrderByCreatedAtAsc(UUID ownerId, TaxHint.Status status);

    long countByOwnerIdAndTaxYearAndStatus(UUID ownerId, Integer taxYear, TaxHint.Status status);

    @Query("SELECT h.documentId FROM TaxHint h WHERE h.ownerId = :ownerId AND h.taxYear = :year")
    Set<UUID> checkedDocumentIds(@Param("ownerId") UUID ownerId, @Param("year") Integer year);
}
