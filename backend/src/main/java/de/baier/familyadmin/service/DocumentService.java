package de.baier.familyadmin.service;

import de.baier.familyadmin.model.Document;
import de.baier.familyadmin.model.DocumentSource;
import de.baier.familyadmin.model.User;
import de.baier.familyadmin.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Service
@RequiredArgsConstructor
@Transactional
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final DocumentIndexingService documentIndexingService;

    public Document store(MultipartFile file, User uploadedBy, DocumentSource source, String emailSubject) throws IOException {
        String filename = StringUtils.hasText(file.getOriginalFilename())
                ? file.getOriginalFilename() : "document";
        String contentType = StringUtils.hasText(file.getContentType())
                ? file.getContentType() : "application/octet-stream";

        Document doc = Document.builder()
                .filename(filename)
                .contentType(contentType)
                .fileSize(file.getSize())
                .data(file.getBytes())
                .uploadedBy(uploadedBy)
                .source(source)
                .emailSubject(emailSubject)
                .build();
        Document saved = documentRepository.save(doc);
        scheduleIndexing(saved);
        return saved;
    }

    public Document storeBytes(byte[] bytes, String filename, String contentType,
                               User uploadedBy, String emailSubject) {
        String ct = StringUtils.hasText(contentType) ? contentType : "application/octet-stream";
        String fn = StringUtils.hasText(filename) ? filename : "attachment";

        Document doc = Document.builder()
                .filename(fn)
                .contentType(ct)
                .fileSize(bytes.length)
                .data(bytes)
                .uploadedBy(uploadedBy)
                .source(DocumentSource.EMAIL)
                .emailSubject(emailSubject)
                .build();
        Document saved = documentRepository.save(doc);
        scheduleIndexing(saved);
        return saved;
    }

    private void scheduleIndexing(Document saved) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                documentIndexingService.indexAsync(
                        saved.getId(), saved.getData(), saved.getContentType(), saved.getFilename());
            }
        });
    }

    @Transactional(readOnly = true)
    public byte[] getDocumentData(Document doc) {
        return doc.getData();
    }

    public void delete(Document doc) {
        documentRepository.delete(doc);
    }
}
