package de.baier.familyadmin.tax;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TaxFolderListingRepository extends JpaRepository<TaxFolderListing, TaxYearKey> {
    List<TaxFolderListing> findByOwnerIdOrderByTaxYearDesc(UUID ownerId);
}
