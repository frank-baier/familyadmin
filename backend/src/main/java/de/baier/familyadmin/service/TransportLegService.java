package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.TransportLegRequest;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.TransportLeg;
import de.baier.familyadmin.model.TransportType;
import de.baier.familyadmin.repository.TransportLegRepository;
import de.baier.familyadmin.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TransportLegService {

    private final TransportLegRepository transportLegRepository;
    private final TripRepository tripRepository;
    private final FlightStatusService flightStatusService;

    @Transactional(readOnly = true)
    public List<TransportLeg> getLegs(UUID tripId) {
        return transportLegRepository.findByTripIdOrderByDepartureAtAscPositionAsc(tripId);
    }

    @Transactional(readOnly = true)
    public TransportLeg getLeg(UUID legId) {
        return transportLegRepository.findById(legId)
                .orElseThrow(() -> new ResourceNotFoundException("Transport leg not found: " + legId));
    }

    public TransportLeg addLeg(UUID tripId, TransportLegRequest req) {
        var trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found: " + tripId));
        var leg = TransportLeg.builder()
                .trip(trip)
                .type(req.type() != null ? req.type() : TransportType.OTHER)
                .fromLocation(req.fromLocation())
                .toLocation(req.toLocation())
                .departureAt(req.departureAt())
                .arrivalAt(req.arrivalAt())
                .carrier(req.carrier())
                .bookingReference(req.bookingReference())
                .seat(req.seat())
                .notes(req.notes())
                .position(req.position())
                .flightNumber(req.flightNumber())
                .build();
        return transportLegRepository.save(leg);
    }

    public TransportLeg updateLeg(UUID legId, TransportLegRequest req) {
        var leg = getLeg(legId);
        leg.setType(req.type() != null ? req.type() : TransportType.OTHER);
        leg.setFromLocation(req.fromLocation());
        leg.setToLocation(req.toLocation());
        leg.setDepartureAt(req.departureAt());
        leg.setArrivalAt(req.arrivalAt());
        leg.setCarrier(req.carrier());
        leg.setBookingReference(req.bookingReference());
        leg.setSeat(req.seat());
        leg.setNotes(req.notes());
        leg.setPosition(req.position());
        leg.setFlightNumber(req.flightNumber());
        return transportLegRepository.save(leg);
    }

    public void deleteLeg(UUID legId) {
        var leg = getLeg(legId);
        transportLegRepository.delete(leg);
    }

    public TransportLeg refreshFlightStatus(UUID legId) {
        var leg = getLeg(legId);
        return flightStatusService.refreshFlightStatus(leg);
    }
}
