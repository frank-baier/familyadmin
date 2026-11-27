package de.baier.familyadmin.documents;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A document-chat session with its questions, oldest first. {@code closedAt} is null for the open session. */
public record ChatSessionResponse(
        UUID id,
        Instant createdAt,
        Instant closedAt,
        List<ChatHistoryResponse> entries
) {}
