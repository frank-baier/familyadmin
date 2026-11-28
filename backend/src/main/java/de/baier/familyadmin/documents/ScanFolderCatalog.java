package de.baier.familyadmin.documents;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Folder tree of iCloud "Dokumente" (JSON list of ScanInboxDtos.CatalogFolder) as last sent by the Mac. */
@Entity
@Table(name = "scan_folder_catalog")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ScanFolderCatalog {

    @Id
    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String folders;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
