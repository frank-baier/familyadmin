package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.DocumentResponse;
import de.baier.familyadmin.model.TripDocument;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.service.TripDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/trips/{tripId}/documents")
@RequiredArgsConstructor
public class TripDocumentController {

    private final TripDocumentService tripDocumentService;

    @GetMapping
    public List<DocumentResponse> getDocuments(@PathVariable UUID tripId) {
        return tripDocumentService.getDocuments(tripId).stream()
                .map(td -> DocumentResponse.from(td.getDocument(), tripId))
                .toList();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse upload(
            @PathVariable UUID tripId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User currentUser) throws IOException {
        TripDocument td = tripDocumentService.upload(tripId, file, currentUser);
        return DocumentResponse.from(td.getDocument(), tripId);
    }

    @DeleteMapping("/{documentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID tripId, @PathVariable UUID documentId) {
        tripDocumentService.delete(tripId, documentId);
    }

    @GetMapping("/{documentId}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID tripId, @PathVariable UUID documentId) {
        TripDocument td = tripDocumentService.getDocument(tripId, documentId);
        var doc = td.getDocument();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(doc.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + doc.getFilename() + "\"")
                .body(doc.getData());
    }
}
