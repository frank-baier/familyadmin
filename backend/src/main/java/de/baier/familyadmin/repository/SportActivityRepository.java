package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.SportActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface SportActivityRepository extends JpaRepository<SportActivity, UUID> {
    List<SportActivity> findByUserIdOrderByStartTimeAsc(UUID userId);

    List<SportActivity> findByUserIdAndSource(UUID userId, String source);

    long countByUserId(UUID userId);

    @Modifying
    @Query("DELETE FROM SportActivity a WHERE a.userId = :userId")
    int deleteAllByUserId(UUID userId);
}
