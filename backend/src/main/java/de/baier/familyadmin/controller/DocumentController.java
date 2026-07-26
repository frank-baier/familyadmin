package de.baier.familyadmin.controller;

import de.baier.familyadmin.dto.DocumentResponse;
import de.baier.familyadmin.dto.DocumentTreeNode;
import de.baier.familyadmin.dto.PagedDocumentsResponse;
import de.baier.familyadmin.model.Document;
import de.baier.familyadmin.model.DocumentSource;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.DocumentRepository;
import de.baier.familyadmin.service.DocumentService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentRepository documentRepository;
    private final DocumentService documentService;

    @GetMapping
    public PagedDocumentsResponse getAll(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String subcategory,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal User currentUser) {
        var pageable = PageRequest.of(page, Math.min(size, 200));
        UUID userId = currentUser.getId();
        if (category == null && year == null && subcategory == null) {
            return PagedDocumentsResponse.from(documentRepository.findVisibleByUser(userId, pageable));
        }
        return PagedDocumentsResponse.from(documentRepository.findFiltered(category, year, subcategory, userId, pageable));
    }

    @GetMapping("/tree")
    public List<DocumentTreeNode> getTree(@AuthenticationPrincipal User currentUser) {
        return documentRepository.findGroupedTreeForUser(currentUser.getId());
    }

    @GetMapping("/unindexed")
    public PagedDocumentsResponse getUnindexed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {
        var pageable = PageRequest.of(page, Math.min(size, 200));
        return PagedDocumentsResponse.from(documentRepository.findUnindexed(pageable));
    }

    @PostMapping("/accept-unindexed")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void acceptUnindexed() {
        documentRepository.markAllUnindexedAsSkipped();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "subcategory", required = false) String subcategory,
            @RequestParam(value = "year", required = false) Integer year,
            @AuthenticationPrincipal User currentUser) throws IOException {
        var existing = documentRepository.findFirstByFilenameAndCategoryAndSubcategoryAndYear(
                file.getOriginalFilename(), category, subcategory, year);
        if (existing.isPresent()) {
            return ResponseEntity.ok(DocumentResponse.fromGlobal(existing.get()));
        }
        Document doc = documentService.store(file, currentUser, DocumentSource.UPLOAD, null, category, subcategory, year);
        return ResponseEntity.status(HttpStatus.CREATED).body(DocumentResponse.fromGlobal(doc));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        documentService.delete(doc);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(doc.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + doc.getFilename() + "\"")
                .body(doc.getData());
    }
}
