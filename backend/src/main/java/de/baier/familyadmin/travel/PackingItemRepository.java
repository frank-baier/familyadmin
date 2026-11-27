package de.baier.familyadmin.travel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PackingItemRepository extends JpaRepository<PackingItem, UUID> {
    List<PackingItem> findByTripIdAndOwnerIsNullOrderByCategoryAscPositionAsc(UUID tripId);
    List<PackingItem> findByTripIdAndOwnerIdOrderByCategoryAscPositionAsc(UUID tripId, UUID ownerId);
}
