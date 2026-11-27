package de.baier.familyadmin.travel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TripRepository extends JpaRepository<Trip, UUID> {
    List<Trip> findAllByOrderByStartDateDesc();
    Optional<Trip> findByEmailToken(UUID emailToken);
}
