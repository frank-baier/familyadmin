package de.baier.familyadmin.tax;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Background job state and results of one tax year. */
@Entity
@Table(name = "tax_years")
@IdClass(TaxYearKey.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaxYearState {

    @Id
    @Column(name = "owner_id")
    private UUID ownerId;

    @Id
    @Column(name = "tax_year")
    private Integer taxYear;

    @Enumerated(EnumType.STRING)
    @Column(name = "checklist_status", nullable = false, length = 20)
    @Builder.Default
    private TaxJobStatus checklistStatus = TaxJobStatus.IDLE;

    @Column(name = "checklist_error", columnDefinition = "TEXT")
    private String checklistError;

    @Column(name = "checklist_summary", columnDefinition = "TEXT")
    private String checklistSummary;

    @Column(name = "checklist_generated_at")
    private Instant checklistGeneratedAt;

    @Column(name = "checklist_listing_at")
    private Instant checklistListingAt;

    @Column(name = "checklist_model", length = 100)
    private String checklistModel;

    @Column(name = "checklist_cost_usd", precision = 10, scale = 6)
    private BigDecimal checklistCostUsd;

    @Enumerated(EnumType.STRING)
    @Column(name = "hints_status", nullable = false, length = 20)
    @Builder.Default
    private TaxJobStatus hintsStatus = TaxJobStatus.IDLE;

    @Column(name = "hints_error", columnDefinition = "TEXT")
    private String hintsError;

    @Column(name = "hints_scanned_at")
    private Instant hintsScannedAt;

    @Column(name = "hints_cost_usd", precision = 10, scale = 6)
    private BigDecimal hintsCostUsd;

    @Enumerated(EnumType.STRING)
    @Column(name = "return_status", nullable = false, length = 20)
    @Builder.Default
    private TaxJobStatus returnStatus = TaxJobStatus.IDLE;

    @Column(name = "return_error", columnDefinition = "TEXT")
    private String returnError;

    @Column(name = "return_filename", length = 512)
    private String returnFilename;

    @Column(name = "return_summary", columnDefinition = "TEXT")
    private String returnSummary;

    /** JSON array of {@link TaxAiService.GeneratedItem} read from the return. */
    @Column(name = "return_items", columnDefinition = "TEXT")
    private String returnItems;

    @Column(name = "return_imported_at")
    private Instant returnImportedAt;

    @Column(name = "return_cost_usd", precision = 10, scale = 6)
    private BigDecimal returnCostUsd;
}
