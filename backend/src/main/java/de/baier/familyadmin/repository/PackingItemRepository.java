package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.PackingItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PackingItemRepository extends JpaRepository<PackingItem, UUID> {
    List<PackingItem> findByTripIdAndOwnerIsNullOrderByCategoryAscPositionAsc(UUID tripId);
    List<PackingItem> findByTripIdAndOwnerIdOrderByCategoryAscPositionAsc(UUID tripId, UUID ownerId);
}
