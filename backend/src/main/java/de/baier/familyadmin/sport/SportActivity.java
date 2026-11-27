package de.baier.familyadmin.sport;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sport_activities")
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SportActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    @Builder.Default
    private String source = "STRAVA";

    @Column(name = "external_id", nullable = false)
    private String externalId;

    private String name;

    /** Raw sport type as delivered by the source, e.g. "Run", "Trail Run", "Ride". */
    @Column(name = "sport_type", nullable = false)
    private String sportType;

    @Column(name = "start_time", nullable = false)
    private Instant startTime;

    @Column(name = "elapsed_seconds")
    private Integer elapsedSeconds;

    @Column(name = "moving_seconds")
    private Integer movingSeconds;

    @Column(name = "distance_m")
    private Double distanceM;

    @Column(name = "elevation_gain_m")
    private Double elevationGainM;

    @Column(name = "avg_heart_rate")
    private Double avgHeartRate;

    @Column(name = "max_heart_rate")
    private Double maxHeartRate;

    @Column(name = "avg_speed_mps")
    private Double avgSpeedMps;

    @Column(name = "max_speed_mps")
    private Double maxSpeedMps;

    @Column(name = "avg_watts")
    private Double avgWatts;

    private Double calories;

    @Column(name = "relative_effort")
    private Double relativeEffort;

    @Column(nullable = false)
    @Builder.Default
    private boolean commute = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** Moving time if known, otherwise elapsed time, otherwise 0. */
    public int durationSeconds() {
        if (movingSeconds != null && movingSeconds > 0) return movingSeconds;
        return elapsedSeconds != null ? elapsedSeconds : 0;
    }

    public SportCategory category() {
        return SportCategory.of(sportType);
    }
}
