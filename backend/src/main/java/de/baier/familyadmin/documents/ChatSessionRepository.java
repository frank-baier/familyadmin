package de.baier.familyadmin.documents;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatSessionRepository extends JpaRepository<ChatSession, UUID> {

    Optional<ChatSession> findFirstByUserIdAndClosedAtIsNull(UUID userId);

    List<ChatSession> findByUserIdAndClosedAtIsNotNullOrderByCreatedAtDesc(UUID userId);

    @Modifying
    @Query(value = """
            DELETE FROM document_chat_session s
            WHERE s.closed_at IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM document_chat_history h WHERE h.session_id = s.id)
            """, nativeQuery = true)
    int deleteClosedEmptySessions();
}
