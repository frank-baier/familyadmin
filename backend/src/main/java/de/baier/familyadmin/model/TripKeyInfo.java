package de.baier.familyadmin.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "trip_key_info")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripKeyInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Column(length = 100, nullable = false)
    private String label;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String value;

    @Builder.Default
    private int position = 0;
}
