package de.baier.familyadmin.documents;

import de.baier.familyadmin.user.User;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** A file from iCloud "Dokumente/_Wohin?" or an e-mail attachment, with its filing suggestion. */
@Entity
@Table(name = "scan_inbox_items")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScanInboxItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 64)
    private String sha256;

    @Column(name = "source_name", nullable = false, length = 512)
    private String sourceName;

    @Column(name = "content_type", nullable = false, length = 127)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    /** Null once moved. */
    @Basic(fetch = FetchType.LAZY)
    @Column(columnDefinition = "BYTEA")
    private byte[] data;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ScanInboxStatus status = ScanInboxStatus.ANALYZING;

    @Column(name = "analysis_input", length = 20)
    private String analysisInput;

    @Column(name = "user_hint", columnDefinition = "TEXT")
    private String userHint;

    @Column(name = "suggested_folder", length = 1024)
    private String suggestedFolder;

    @Column(name = "suggested_filename", length = 512)
    private String suggestedFilename;

    @Column(name = "tax_relevant")
    private Boolean taxRelevant;

    @Column(name = "suggestion_reason", columnDefinition = "TEXT")
    private String suggestionReason;

    @Column(name = "suggestion_model", length = 100)
    private String suggestionModel;

    @Column(name = "suggestion_cost_usd", precision = 10, scale = 6)
    private BigDecimal suggestionCostUsd;

    @Column(name = "analysis_error", columnDefinition = "TEXT")
    private String analysisError;

    @Column(name = "target_folder", length = 1024)
    private String targetFolder;

    @Column(name = "target_filename", length = 512)
    private String targetFilename;

    @Column(name = "final_path", length = 1536)
    private String finalPath;

    @Column(name = "move_error", columnDefinition = "TEXT")
    private String moveError;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "moved_at")
    private Instant movedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private ScanInboxSource source = ScanInboxSource.SCAN;

    @Column(name = "mail_message_id", length = 998)
    private String mailMessageId;

    @Column(name = "mail_from", length = 512)
    private String mailFrom;

    @Column(name = "mail_subject", length = 998)
    private String mailSubject;

    @Column(name = "mail_date")
    private Instant mailDate;

    /** false = AI thinks it is not worth keeping. */
    @Column(name = "worth_keeping")
    private Boolean worthKeeping;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public boolean isMail() {
        return source == ScanInboxSource.MAIL;
    }
}
