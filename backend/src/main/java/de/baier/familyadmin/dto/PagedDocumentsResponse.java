package de.baier.familyadmin.dto;

import de.baier.familyadmin.model.Document;
import org.springframework.data.domain.Page;

import java.util.List;

public record PagedDocumentsResponse(
        List<DocumentResponse> content,
        long totalElements,
        int totalPages,
        int page,
        int size
) {
    public static PagedDocumentsResponse from(Page<Document> p) {
        return new PagedDocumentsResponse(
                p.getContent().stream().map(DocumentResponse::fromGlobal).toList(),
                p.getTotalElements(),
                p.getTotalPages(),
                p.getNumber(),
                p.getSize()
        );
    }
}
