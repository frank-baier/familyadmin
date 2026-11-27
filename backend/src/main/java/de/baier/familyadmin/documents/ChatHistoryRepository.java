package de.baier.familyadmin.documents;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ChatHistoryRepository extends JpaRepository<ChatHistory, UUID> {

    List<ChatHistory> findBySessionIdOrderByCreatedAtAsc(UUID sessionId);

    List<ChatHistory> findBySessionIdInOrderByCreatedAtAsc(Collection<UUID> sessionIds);

    @Modifying
    @Query("DELETE FROM ChatHistory h WHERE h.createdAt < :cutoff")
    int deleteByCreatedAtBefore(Instant cutoff);
}
