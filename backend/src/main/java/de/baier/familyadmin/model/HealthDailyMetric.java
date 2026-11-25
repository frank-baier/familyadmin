package de.baier.familyadmin.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "health_daily_metrics")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HealthDailyMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "metric_date", nullable = false)
    private LocalDate metricDate;

    @Column(nullable = false)
    private String metric;

    @Column(nullable = false)
    private double value;
}
