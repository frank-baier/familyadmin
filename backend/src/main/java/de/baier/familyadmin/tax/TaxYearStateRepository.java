package de.baier.familyadmin.tax;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaxYearStateRepository extends JpaRepository<TaxYearState, TaxYearKey> {
    List<TaxYearState> findByChecklistStatus(TaxJobStatus status);
    List<TaxYearState> findByHintsStatus(TaxJobStatus status);
    List<TaxYearState> findByReturnStatus(TaxJobStatus status);
}
