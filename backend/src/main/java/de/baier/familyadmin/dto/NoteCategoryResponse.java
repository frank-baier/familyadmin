package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.NoteCategory;

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
