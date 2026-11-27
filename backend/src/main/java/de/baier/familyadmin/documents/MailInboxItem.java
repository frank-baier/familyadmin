package de.baier.familyadmin.documents;

import de.baier.familyadmin.user.User;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/** An e-mail attachment waiting for the user to approve or reject its filing suggestion. */
@Entity
@Table(name = "mail_inbox_items")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MailInboxItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "message_id", nullable = false, length = 998)
    private String messageId;

    @Column(name = "attachment_index", nullable = false)
    private int attachmentIndex;

    @Column(name = "mail_from", length = 512)
    private String mailFrom;

    @Column(name = "mail_subject", length = 998)
    private String mailSubject;

    @Column(name = "mail_date")
    private Instant mailDate;

    @Column(nullable = false)
    private String filename;

    @Column(name = "content_type", nullable = false, length = 127)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    /** Null once decided. */
    @Column(columnDefinition = "BYTEA")
    private byte[] data;

    @Column(name = "suggested_category")
    private String suggestedCategory;

    @Column(name = "suggested_subcategory")
    private String suggestedSubcategory;

    @Column(name = "suggested_year")
    private Integer suggestedYear;

    @Column(name = "suggestion_reason", columnDefinition = "TEXT")
    private String suggestionReason;

    @Column(name = "suggestion_model", length = 100)
    private String suggestionModel;

    @Column(name = "suggested_important")
    private Boolean suggestedImportant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MailInboxStatus status = MailInboxStatus.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id")
    private Document document;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
