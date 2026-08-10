package de.baier.familyadmin.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "trip_location_highlights")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripHighlight {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Column(nullable = false)
    private String location;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String highlights;

    @Column(name = "check_in", length = 20)
    private String checkIn;

    @Column(name = "check_out", length = 20)
    private String checkOut;

    @Column(name = "generated_at", nullable = false)
    @Builder.Default
    private Instant generatedAt = Instant.now();
}
