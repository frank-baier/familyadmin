package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.SportProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SportProfileRepository extends JpaRepository<SportProfile, UUID> {
}
