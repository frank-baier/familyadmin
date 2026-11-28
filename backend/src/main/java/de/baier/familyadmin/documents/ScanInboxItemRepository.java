package de.baier.familyadmin.documents;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScanInboxItemRepository extends JpaRepository<ScanInboxItem, UUID> {

    List<ScanInboxItem> findByOwnerIdAndStatusInOrderByCreatedAtDesc(UUID ownerId, Collection<ScanInboxStatus> statuses);

    List<ScanInboxItem> findTop10ByOwnerIdAndStatusOrderByMovedAtDesc(UUID ownerId, ScanInboxStatus status);

    Optional<ScanInboxItem> findFirstByOwnerIdAndSourceAndSha256AndStatusIn(UUID ownerId, ScanInboxSource source, String sha256,
                                                                   Collection<ScanInboxStatus> statuses);

    List<ScanInboxItem> findByOwnerIdAndStatusOrderByDecidedAtAsc(UUID ownerId, ScanInboxStatus status);

    List<ScanInboxItem> findByStatusAndCreatedAtBefore(ScanInboxStatus status, Instant before);

    boolean existsByOwnerIdAndMailMessageId(UUID ownerId, String mailMessageId);

    /** Any earlier e-mail attachment with the same content (also rejected ones: they must not come back). */
    boolean existsByOwnerIdAndSourceAndSha256(UUID ownerId, ScanInboxSource source, String sha256);

    long countByOwnerIdAndStatusIn(UUID ownerId, Collection<ScanInboxStatus> statuses);

    List<ScanInboxItem> findByOwnerIdAndStatusAndDocumentIdIsNullAndFinalPathIsNotNull(UUID ownerId, ScanInboxStatus status);
}
