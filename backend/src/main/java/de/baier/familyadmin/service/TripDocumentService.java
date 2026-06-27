package de.baier.familyadmin.service;

import de.baier.familyadmin.exception.ResourceNotFoundException;
import de.baier.familyadmin.model.*;
import de.baier.familyadmin.repository.TripDocumentRepository;
import de.baier.familyadmin.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TripDocumentService {

    private final TripDocumentRepository tripDocumentRepository;
    private final TripRepository tripRepository;
    private final DocumentService documentService;

    @Transactional(readOnly = true)
    public List<TripDocument> getDocuments(UUID tripId) {
        return tripDocumentRepository.findByTripIdOrderByDocumentCreatedAtDesc(tripId);
    }

    @Transactional(readOnly = true)
    public TripDocument getDocument(UUID tripId, UUID documentId) {
        return tripDocumentRepository.findByTripIdAndDocumentId(tripId, documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));
    }

    public TripDocument upload(UUID tripId, MultipartFile file, User uploadedBy) throws IOException {
        Trip trip = getTrip(tripId);
        Document doc = documentService.store(file, uploadedBy, DocumentSource.UPLOAD, null, null, null, null);
        return tripDocumentRepository.save(TripDocument.builder().trip(trip).document(doc).build());
    }

    public TripDocument ingestFromEmail(UUID tripId, byte[] bytes, String filename,
                                        String contentType, String emailSubject, User uploadedBy) {
        Trip trip = getTrip(tripId);
        Document doc = documentService.storeBytes(bytes, filename, contentType, uploadedBy, emailSubject);
        return tripDocumentRepository.save(TripDocument.builder().trip(trip).document(doc).build());
    }

    public void delete(UUID tripId, UUID documentId) {
        TripDocument td = getDocument(tripId, documentId);
        Document doc = td.getDocument();
        tripDocumentRepository.delete(td);
        // delete the document itself if no other trip references it
        if (!tripDocumentRepository.existsByDocumentId(documentId)) {
            documentService.delete(doc);
        }
    }

    private Trip getTrip(UUID tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found: " + tripId));
    }
}
