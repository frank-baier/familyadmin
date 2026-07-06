package de.baier.familyadmin.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "transport_legs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransportLeg {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TransportType type = TransportType.OTHER;

    @Column(name = "from_location", nullable = false)
    private String fromLocation;

    @Column(name = "to_location", nullable = false)
    private String toLocation;

    @Column(name = "departure_at", nullable = false)
    private Instant departureAt;

    @Column(name = "arrival_at", nullable = false)
    private Instant arrivalAt;

    private String carrier;

    @Column(name = "booking_reference", length = 100)
    private String bookingReference;

    @Column(length = 50)
    private String seat;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "baggage_allowance", columnDefinition = "TEXT")
    private String baggageAllowance;

    @Builder.Default
    private int position = 0;

    // Flight tracking fields (FLIGHT type only)
    @Column(name = "flight_number", length = 20)
    private String flightNumber;

    @Column(name = "flight_status", length = 50)
    private String flightStatus;

    @Column(name = "actual_departure_at")
    private Instant actualDepartureAt;

    @Column(name = "actual_arrival_at")
    private Instant actualArrivalAt;

    @Column(name = "departure_gate", length = 20)
    private String departureGate;

    @Column(name = "departure_terminal", length = 20)
    private String departureTerminal;

    @Column(name = "arrival_gate", length = 20)
    private String arrivalGate;

    @Column(name = "arrival_terminal", length = 20)
    private String arrivalTerminal;

    @Column(name = "delay_minutes")
    private Integer delayMinutes;

    @Column(name = "status_checked_at")
    private Instant statusCheckedAt;
}
