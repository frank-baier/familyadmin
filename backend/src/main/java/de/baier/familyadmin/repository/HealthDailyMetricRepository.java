package de.baier.familyadmin.repository;

import de.baier.familyadmin.model.HealthDailyMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface HealthDailyMetricRepository extends JpaRepository<HealthDailyMetric, UUID> {

    /** Idempotent write: re-sending a day overwrites its value (the Shortcut may run several times). */
    @Modifying
    @Query(value = """
            INSERT INTO health_daily_metrics (user_id, metric_date, metric, value)
            VALUES (:userId, :date, :metric, :value)
            ON CONFLICT (user_id, metric_date, metric)
            DO UPDATE SET value = EXCLUDED.value, updated_at = now()
            """, nativeQuery = true)
    void upsert(@Param("userId") UUID userId, @Param("date") LocalDate date,
                @Param("metric") String metric, @Param("value") double value);

    List<HealthDailyMetric> findByUserIdAndMetricDateGreaterThanEqualOrderByMetricDateAsc(UUID userId, LocalDate from);

    long deleteByUserId(UUID userId);
}
