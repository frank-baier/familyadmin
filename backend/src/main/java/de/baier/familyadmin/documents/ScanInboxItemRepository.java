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

    Optional<ScanInboxItem> findFirstByOwnerIdAndSha256AndStatusIn(UUID ownerId, String sha256,
                                                                   Collection<ScanInboxStatus> statuses);

    List<ScanInboxItem> findByOwnerIdAndStatusOrderByDecidedAtAsc(UUID ownerId, ScanInboxStatus status);

    List<ScanInboxItem> findByStatusAndCreatedAtBefore(ScanInboxStatus status, Instant before);

    long countByOwnerIdAndStatusIn(UUID ownerId, Collection<ScanInboxStatus> statuses);
}
