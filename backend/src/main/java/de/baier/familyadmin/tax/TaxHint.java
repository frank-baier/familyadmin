package de.baier.familyadmin.tax;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Verdict of the AI on one archive document: is it relevant for the tax return of a year? */
@Entity
@Table(name = "tax_hints")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaxHint {

    public enum Status { PENDING, NOT_RELEVANT, ALREADY_FILED, COPY_REQUESTED, COPIED, DISMISSED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "tax_year", nullable = false)
    private Integer taxYear;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(length = 120)
    private String rubric;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "target_folder", length = 1024)
    private String targetFolder;

    @Column(name = "final_path", length = 1536)
    private String finalPath;

    @Column(name = "copy_error", columnDefinition = "TEXT")
    private String copyError;

    @Column(length = 100)
    private String model;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
