package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.NoteNode;

import java.time.Instant;
import java.util.UUID;

public record NoteNodeResponse(
        UUID id,
        UUID categoryId,
        UUID parentId,
        String name,
        String content,
        int position,
        Instant createdAt,
        Instant updatedAt
) {
    public static NoteNodeResponse from(NoteNode node) {
        return new NoteNodeResponse(
                node.getId(),
                node.getCategory().getId(),
                node.getParent() != null ? node.getParent().getId() : null,
                node.getName(),
                node.getContent(),
                node.getPosition(),
                node.getCreatedAt(),
                node.getUpdatedAt());
    }
}
