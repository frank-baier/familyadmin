package de.baier.familyadmin.sport;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sport_profiles")
@EntityListeners(AuditingEntityListener.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SportProfile {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "max_heart_rate")
    private Integer maxHeartRate;

    @Column(name = "resting_heart_rate")
    private Integer restingHeartRate;

    @Column(name = "birth_year")
    private Integer birthYear;

    /** "MALE" / "FEMALE" or null — only used for TRIMP weighting and VO2max norms. */
    private String sex;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
