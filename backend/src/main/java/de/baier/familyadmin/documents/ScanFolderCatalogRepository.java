package de.baier.familyadmin.documents;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ScanFolderCatalogRepository extends JpaRepository<ScanFolderCatalog, UUID> {
}
