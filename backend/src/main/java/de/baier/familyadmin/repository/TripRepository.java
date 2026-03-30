package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.Trip;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TripRepository extends JpaRepository<Trip, UUID> {
    List<Trip> findAllByOrderByStartDateDesc();
}
