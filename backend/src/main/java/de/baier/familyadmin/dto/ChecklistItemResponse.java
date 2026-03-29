package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.ChecklistItem;

import java.util.UUID;

public record ChecklistItemResponse(
        UUID id,
        String text,
        boolean done,
        int position
) {
    public static ChecklistItemResponse from(ChecklistItem item) {
        return new ChecklistItemResponse(item.getId(), item.getText(), item.isDone(), item.getPosition());
    }
}
