package de.baier.familyadmin.travel;

import java.util.UUID;

public record TripKeyInfoResponse(
        UUID id,
        String label,
        String value,
        int position
) {
    public static TripKeyInfoResponse from(TripKeyInfo info) {
        return new TripKeyInfoResponse(info.getId(), info.getLabel(), info.getValue(), info.getPosition());
    }
}
