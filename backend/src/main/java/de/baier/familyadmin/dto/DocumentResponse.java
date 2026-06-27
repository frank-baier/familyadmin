package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.Document;

import java.time.Instant;
import java.util.UUID;

public record DocumentResponse(
        UUID id,
        String filename,
        String contentType,
        long fileSize,
        String source,
        String emailSubject,
        String category,
        String subcategory,
        Integer year,
        UserResponse uploadedBy,
        String downloadUrl,
        Instant createdAt
) {
    public static DocumentResponse from(Document doc, UUID tripId) {
        return new DocumentResponse(
                doc.getId(),
                doc.getFilename(),
                doc.getContentType(),
                doc.getFileSize(),
                doc.getSource().name(),
                doc.getEmailSubject(),
                doc.getCategory(),
                doc.getSubcategory(),
                doc.getYear(),
                UserResponse.from(doc.getUploadedBy()),
                "/api/trips/" + tripId + "/documents/" + doc.getId() + "/download",
                doc.getCreatedAt()
        );
    }

    public static DocumentResponse fromGlobal(Document doc) {
        return new DocumentResponse(
                doc.getId(),
                doc.getFilename(),
                doc.getContentType(),
                doc.getFileSize(),
                doc.getSource().name(),
                doc.getEmailSubject(),
                doc.getCategory(),
                doc.getSubcategory(),
                doc.getYear(),
                UserResponse.from(doc.getUploadedBy()),
                "/api/documents/" + doc.getId() + "/download",
                doc.getCreatedAt()
        );
    }
}
