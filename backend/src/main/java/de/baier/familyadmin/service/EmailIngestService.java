package de.baier.familyadmin.service;

import de.baier.familyadmin.dto.ResendInboundPayload;
import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.Trip;
import de.baier.familyadmin.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class EmailIngestService {

    private static final Pattern TOKEN_PATTERN = Pattern.compile("trip\\+([0-9a-fA-F-]{36})@");

    private final TripRepository tripRepository;
    private final TripDocumentService tripDocumentService;

    public int ingest(ResendInboundPayload payload) {
        if (payload.data() == null) return 0;

        List<String> toAddresses = payload.data().to();
        if (toAddresses == null || toAddresses.isEmpty()) return 0;

        UUID emailToken = extractToken(toAddresses);
        if (emailToken == null) {
            log.warn("No valid trip email token found in to addresses: {}", toAddresses);
            return 0;
        }

        Trip trip = tripRepository.findByEmailToken(emailToken)
                .orElseThrow(() -> new ResourceNotFoundException("No trip found for email token: " + emailToken));

        List<ResendInboundPayload.ResendAttachment> attachments = payload.data().attachments();
        if (attachments == null || attachments.isEmpty()) {
            log.info("Email ingested for trip {} but had no attachments", trip.getId());
            return 0;
        }

        int saved = 0;
        for (var attachment : attachments) {
            try {
                byte[] bytes = Base64.getDecoder().decode(attachment.content());
                tripDocumentService.ingestFromEmail(
                        trip.getId(),
                        bytes,
                        attachment.filename(),
                        attachment.contentType(),
                        payload.data().subject(),
                        trip.getCreatedBy()
                );
                saved++;
            } catch (Exception e) {
                log.error("Failed to ingest attachment '{}' for trip {}: {}",
                        attachment.filename(), trip.getId(), e.getMessage());
            }
        }

        log.info("Ingested {} attachment(s) for trip {}", saved, trip.getId());
        return saved;
    }

    private UUID extractToken(List<String> toAddresses) {
        for (String address : toAddresses) {
            Matcher m = TOKEN_PATTERN.matcher(address);
            if (m.find()) {
                try {
                    return UUID.fromString(m.group(1));
                } catch (IllegalArgumentException ignored) {
                }
            }
        }
        return null;
    }
}
