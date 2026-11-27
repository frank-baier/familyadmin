package de.baier.familyadmin.sport;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SportProfileRepository extends JpaRepository<SportProfile, UUID> {
}
