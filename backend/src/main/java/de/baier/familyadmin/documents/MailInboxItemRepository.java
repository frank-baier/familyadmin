package de.baier.familyadmin.documents;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MailInboxItemRepository extends JpaRepository<MailInboxItem, UUID> {

    List<MailInboxItem> findByOwnerIdAndStatusOrderByMailDateDesc(UUID ownerId, MailInboxStatus status);

    long countByOwnerIdAndStatus(UUID ownerId, MailInboxStatus status);

    boolean existsByOwnerIdAndMessageId(UUID ownerId, String messageId);
}
