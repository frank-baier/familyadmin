package de.baier.familyadmin.tax;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TaxChecklistItemRepository extends JpaRepository<TaxChecklistItem, UUID> {
    List<TaxChecklistItem> findByOwnerIdAndTaxYearOrderByPositionAscCreatedAtAsc(UUID ownerId, Integer taxYear);
    List<TaxChecklistItem> findByOwnerIdAndTaxYearAndSource(UUID ownerId, Integer taxYear, TaxChecklistItem.Source source);
}
