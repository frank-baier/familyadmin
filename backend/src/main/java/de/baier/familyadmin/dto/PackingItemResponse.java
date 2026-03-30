package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.PackingItem;

import java.util.UUID;

public record PackingItemResponse(
        UUID id,
        String name,
        boolean packed,
        int position,
        UUID ownerId,
        String ownerName
) {
    public static PackingItemResponse from(PackingItem item) {
        return new PackingItemResponse(
                item.getId(),
                item.getName(),
                item.isPacked(),
                item.getPosition(),
                item.getOwner() != null ? item.getOwner().getId() : null,
                item.getOwner() != null ? item.getOwner().getName() : null
        );
    }
}
