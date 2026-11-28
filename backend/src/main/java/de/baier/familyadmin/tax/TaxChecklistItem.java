package de.baier.familyadmin.tax;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** One document or topic the tax return of a year needs. */
@Entity
@Table(name = "tax_checklist_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaxChecklistItem {

    public enum Source { BASELINE, PRIOR_YEAR, RETURN, MANUAL }

    public enum AiStatus { FOUND, PARTIAL, MISSING, UNKNOWN }

    public enum UserStatus { DONE, NOT_NEEDED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "tax_year", nullable = false)
    private Integer taxYear;

    @Column(length = 120)
    private String rubric;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(length = 60)
    private String person;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Source source;

    @Enumerated(EnumType.STRING)
    @Column(name = "ai_status", nullable = false, length = 20)
    @Builder.Default
    private AiStatus aiStatus = AiStatus.UNKNOWN;

    /** JSON array of paths in this year's tax folder that cover the item. */
    @Column(name = "matched_files", columnDefinition = "TEXT")
    private String matchedFiles;

    /** JSON array of last year's file names the item was derived from. */
    @Column(name = "prior_files", columnDefinition = "TEXT")
    private String priorFiles;

    @Enumerated(EnumType.STRING)
    @Column(name = "user_status", length = 20)
    private UserStatus userStatus;

    @Column(nullable = false)
    @Builder.Default
    private int position = 0;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
