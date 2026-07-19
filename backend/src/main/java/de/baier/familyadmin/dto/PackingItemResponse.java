package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.PackingItem;
import de.baier.familyadmin.model.User;

import java.time.Instant;
import java.util.UUID;

public record PackingItemResponse(
        UUID id,
        String label,
        boolean packed,
        boolean personal,
        String category,
        int position,
        AddedBy addedBy,
        Instant createdAt
) {
    public record AddedBy(UUID id, String name) {}

    public static PackingItemResponse from(PackingItem item) {
        User ref = item.getOwner() != null ? item.getOwner() : item.getCreatedBy();
        AddedBy addedBy = ref != null ? new AddedBy(ref.getId(), ref.getName()) : new AddedBy(null, "Unbekannt");
        return new PackingItemResponse(
                item.getId(),
                item.getLabel(),
                item.isPacked(),
                item.getOwner() != null,
                item.getCategory(),
                item.getPosition(),
                addedBy,
                item.getCreatedAt()
        );
    }
}
