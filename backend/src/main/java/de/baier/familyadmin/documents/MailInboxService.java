package de.baier.familyadmin.documents;

import de.baier.familyadmin.user.User;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class MailInboxService {

    private final MailInboxItemRepository itemRepository;
    private final DocumentRepository documentRepository;
    private final DocumentService documentService;

    @Transactional(readOnly = true)
    public List<MailInboxItemResponse> pending(User user) {
        return itemRepository.findByOwnerIdAndStatusOrderByMailDateDesc(user.getId(), MailInboxStatus.PENDING)
                .stream().map(MailInboxItemResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public long countPending(User user) {
        return itemRepository.countByOwnerIdAndStatus(user.getId(), MailInboxStatus.PENDING);
    }

    @Transactional(readOnly = true)
    public MailInboxItem pendingItem(UUID id, User user) {
        MailInboxItem item = itemRepository.findById(id)
                .filter(i -> i.getOwner().getId().equals(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (item.getStatus() != MailInboxStatus.PENDING || item.getData() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bereits entschieden");
        }
        return item;
    }

    /** Files the attachment as a document (suggestion unless the user changed it). */
    public DocumentResponse approve(UUID id, MailInboxApproveRequest req, User user) {
        MailInboxItem item = pendingItem(id, user);
        String category = pick(req != null ? req.category() : null, item.getSuggestedCategory());
        if (category == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kategorie fehlt");
        }
        String subcategory = req != null && req.category() != null
                ? blankToNull(req.subcategory()) : pick(req != null ? req.subcategory() : null, item.getSuggestedSubcategory());
        Integer year = req != null && req.year() != null ? req.year() : item.getSuggestedYear();
        String filename = pick(req != null ? req.filename() : null, item.getFilename());

        Document doc = documentRepository
                .findFirstByFilenameAndCategoryAndSubcategoryAndYear(filename, category, subcategory, year)
                .orElseGet(() -> documentService.storeBytes(item.getData(), filename, item.getContentType(),
                        user, item.getMailSubject(), category, subcategory, year));

        item.setStatus(MailInboxStatus.APPROVED);
        item.setDocument(doc);
        item.setData(null);
        item.setDecidedAt(Instant.now());
        return DocumentResponse.fromGlobal(doc);
    }

    /** Discards the attachment; the row stays so the mail is not imported again. */
    public void reject(UUID id, User user) {
        MailInboxItem item = pendingItem(id, user);
        item.setStatus(MailInboxStatus.REJECTED);
        item.setData(null);
        item.setDecidedAt(Instant.now());
    }

    private static String pick(String chosen, String fallback) {
        return StringUtils.hasText(chosen) ? chosen.strip() : blankToNull(fallback);
    }

    private static String blankToNull(String s) {
        return StringUtils.hasText(s) ? s.strip() : null;
    }
}
