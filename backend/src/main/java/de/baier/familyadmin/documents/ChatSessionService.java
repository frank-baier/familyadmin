package de.baier.familyadmin.documents;

import de.baier.familyadmin.user.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
* Document-chat sessions: each user has one open session that collects questions and
* follow-ups until a new session is started; closed sessions form the history.
*/
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatSessionService {

    static final int RETENTION_MONTHS = 3;

    private final ChatSessionRepository sessionRepository;
    private final ChatHistoryRepository historyRepository;
    private final AsyncChatService asyncChatService;

    @Transactional(readOnly = true)
    public Optional<ChatSessionResponse> getOpenSession(User user) {
        return sessionRepository.findFirstByUserIdAndClosedAtIsNull(user.getId())
                .map(session -> toResponse(session, historyRepository.findBySessionIdOrderByCreatedAtAsc(session.getId())));
    }

    /** Adds a question to the open session (starting one if needed) and answers it asynchronously. */
    @Transactional
    public ChatHistoryResponse ask(User user, String question) {
        ChatSession session = sessionRepository.findFirstByUserIdAndClosedAtIsNull(user.getId())
                .orElseGet(() -> sessionRepository.save(ChatSession.builder().user(user).build()));
        session.setUpdatedAt(Instant.now());

        ChatHistory pending = historyRepository.save(ChatHistory.builder()
                .user(user)
                .session(session)
                .question(question)
                .answer("")
                .sources("")
                .status("PENDING")
                .build());

        UUID historyId = pending.getId();
        UUID sessionId = session.getId();
        // Start only after commit, so the async worker sees the new row.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                asyncChatService.processQuery(historyId, sessionId, question);
            }
        });
        return ChatHistoryResponse.from(pending);
    }

    /** Moves the open session into the history; the next question starts a new one. */
    @Transactional
    public void closeOpenSession(User user) {
        sessionRepository.findFirstByUserIdAndClosedAtIsNull(user.getId()).ifPresent(session -> {
            if (historyRepository.findBySessionIdOrderByCreatedAtAsc(session.getId()).isEmpty()) {
                sessionRepository.delete(session);
            } else {
                session.setClosedAt(Instant.now());
            }
        });
    }

    @Transactional(readOnly = true)
    public List<ChatSessionResponse> getHistory(User user) {
        List<ChatSession> sessions = sessionRepository.findByUserIdAndClosedAtIsNotNullOrderByCreatedAtDesc(user.getId());
        if (sessions.isEmpty()) return List.of();
        Map<UUID, List<ChatHistory>> entries = historyRepository
                .findBySessionIdInOrderByCreatedAtAsc(sessions.stream().map(ChatSession::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(h -> h.getSession().getId()));
        return sessions.stream()
                .map(s -> toResponse(s, entries.getOrDefault(s.getId(), List.of())))
                .toList();
    }

    @Transactional
    public void deleteSession(User user, UUID sessionId) {
        ChatSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!session.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        sessionRepository.delete(session);
    }

    /** Deletes questions older than three months and closed sessions left without questions. */
    @Transactional
    public void deleteExpired() {
        Instant cutoff = ZonedDateTime.now(ZoneOffset.UTC).minusMonths(RETENTION_MONTHS).toInstant();
        int questions = historyRepository.deleteByCreatedAtBefore(cutoff);
        int sessions = sessionRepository.deleteClosedEmptySessions();
        log.info("Chat cleanup: deleted {} questions older than {} and {} empty sessions", questions, cutoff, sessions);
    }

    private ChatSessionResponse toResponse(ChatSession session, List<ChatHistory> entries) {
        return new ChatSessionResponse(session.getId(), session.getCreatedAt(), session.getClosedAt(),
                entries.stream().map(ChatHistoryResponse::from).toList());
    }
}
