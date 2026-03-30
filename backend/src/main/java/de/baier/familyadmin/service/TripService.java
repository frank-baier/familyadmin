package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.TripKeyInfoRequest;
import de.baier.familyadmin.dto.TripRequest;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.*;
import de.baier.familyadmin.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TripService {

    private final TripRepository tripRepository;

    @Transactional(readOnly = true)
    public List<Trip> getAll() {
        return tripRepository.findAllByOrderByStartDateDesc();
    }

    @Transactional(readOnly = true)
    public Trip getById(UUID id) {
        return tripRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found: " + id));
    }

    public Trip createTrip(TripRequest req, User currentUser) {
        var trip = Trip.builder()
                .title(req.title())
                .destination(req.destination())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .description(req.description())
                .createdBy(currentUser)
                .build();
        return tripRepository.save(trip);
    }

    public Trip updateTrip(UUID id, TripRequest req, User currentUser) {
        var trip = getById(id);
        trip.setTitle(req.title());
        trip.setDestination(req.destination());
        trip.setStartDate(req.startDate());
        trip.setEndDate(req.endDate());
        trip.setDescription(req.description());
        return tripRepository.save(trip);
    }

    public void deleteTrip(UUID id, User currentUser) {
        var trip = getById(id);
        requireOwnerOrAdmin(trip, currentUser);
        tripRepository.delete(trip);
    }

    public Trip updateCoverPhoto(UUID id, String photoUrl, User currentUser) {
        var trip = getById(id);
        trip.setCoverPhotoUrl(photoUrl);
        return tripRepository.save(trip);
    }

    public Trip addKeyInfo(UUID tripId, TripKeyInfoRequest req, User currentUser) {
        var trip = getById(tripId);
        var info = TripKeyInfo.builder()
                .trip(trip)
                .label(req.label())
                .value(req.value())
                .position(req.position())
                .build();
        trip.getKeyInfos().add(info);
        return tripRepository.save(trip);
    }

    public void deleteKeyInfo(UUID tripId, UUID infoId, User currentUser) {
        var trip = getById(tripId);
        boolean removed = trip.getKeyInfos().removeIf(i -> i.getId().equals(infoId));
        if (!removed) {
            throw new ResourceNotFoundException("Key info not found: " + infoId);
        }
        tripRepository.save(trip);
    }

    private void requireOwnerOrAdmin(Trip trip, User user) {
        boolean isOwner = trip.getCreatedBy().getId().equals(user.getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("You don't have permission to delete this trip");
        }
    }
}
