package de.baier.familyadmin.tax;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** File names in the tax folders of one year, as last reported by the Mac. */
@Entity
@Table(name = "tax_folder_listings")
@IdClass(TaxYearKey.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaxFolderListing {

    @Id
    @Column(name = "owner_id")
    private UUID ownerId;

    @Id
    @Column(name = "tax_year")
    private Integer taxYear;

    /** JSON {@link TaxDtos.StoredListing}: files and folders. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String files;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
