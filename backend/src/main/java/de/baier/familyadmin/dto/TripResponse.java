package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.Trip;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record TripResponse(
        UUID id,
        String title,
        String destination,
        LocalDate startDate,
        LocalDate endDate,
        String description,
        String coverPhotoUrl,
        UserResponse createdBy,
        List<TripKeyInfoResponse> keyInfos,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static TripResponse from(Trip trip) {
        return new TripResponse(
                trip.getId(),
                trip.getTitle(),
                trip.getDestination(),
                trip.getStartDate(),
                trip.getEndDate(),
                trip.getDescription(),
                trip.getCoverPhotoUrl(),
                UserResponse.from(trip.getCreatedBy()),
                trip.getKeyInfos().stream().map(TripKeyInfoResponse::from).toList(),
                trip.getCreatedAt(),
                trip.getUpdatedAt()
        );
    }
}
