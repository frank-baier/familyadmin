package de.baier.familyadmin.travel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TransportLegRepository extends JpaRepository<TransportLeg, UUID> {
    List<TransportLeg> findByTripIdOrderByDepartureAtAscPositionAsc(UUID tripId);
}
