package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.PackingItemRequest;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.PackingItem;
import de.baier.familyadmin.model.Trip;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.PackingItemRepository;
import de.baier.familyadmin.repository.TripRepository;
import de.baier.familyadmin.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class PackingItemService {

    private final PackingItemRepository packingItemRepository;
    private final TripRepository tripRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<PackingItem> getSharedItems(UUID tripId) {
        return packingItemRepository.findByTripIdAndOwnerIsNullOrderByPosition(tripId);
    }

    @Transactional(readOnly = true)
    public List<PackingItem> getPersonalItems(UUID tripId, UUID userId) {
        return packingItemRepository.findByTripIdAndOwnerIdOrderByPosition(tripId, userId);
    }

    public PackingItem addItem(UUID tripId, PackingItemRequest req, User currentUser) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found: " + tripId));

        User owner = null;
        if (req.ownerId() != null) {
            owner = userRepository.findById(req.ownerId())
                    .orElseThrow(() -> new ResourceNotFoundException("User not found: " + req.ownerId()));
        }

        var item = PackingItem.builder()
                .trip(trip)
                .owner(owner)
                .name(req.name())
                .position(req.position())
                .build();
        return packingItemRepository.save(item);
    }

    public PackingItem togglePacked(UUID itemId) {
        PackingItem item = packingItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Packing item not found: " + itemId));
        item.setPacked(!item.isPacked());
        return packingItemRepository.save(item);
    }

    public void deleteItem(UUID itemId) {
        if (!packingItemRepository.existsById(itemId)) {
            throw new ResourceNotFoundException("Packing item not found: " + itemId);
        }
        packingItemRepository.deleteById(itemId);
    }
}
