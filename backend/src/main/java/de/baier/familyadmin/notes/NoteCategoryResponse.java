package de.baier.familyadmin.notes;

import java.time.Instant;
import java.util.UUID;

public record NoteCategoryResponse(
        UUID id,
        String name,
        int position,
        Instant createdAt
) {
    public static NoteCategoryResponse from(NoteCategory category) {
        return new NoteCategoryResponse(
                category.getId(),
                category.getName(),
                category.getPosition(),
                category.getCreatedAt());
    }
}
