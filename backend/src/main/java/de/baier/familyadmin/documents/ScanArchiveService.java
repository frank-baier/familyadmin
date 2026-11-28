package de.baier.familyadmin.documents;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Puts a filed Scan-Eingang document into the document archive right away, with the
 * folder metadata sync.py would derive from its iCloud path and Claude's description.
 * When sync.py later uploads the same file, DocumentController sees it as existing
 * (same name, category, subcategory, year), so nothing is stored twice.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScanArchiveService {

    private final DocumentRepository documentRepository;
    private final DocumentIndexingService indexingService;
    private final DocumentService documentService;

    public record VaultPath(String category, String subcategory, Integer year, String filename) {}

    private static final Pattern YEAR = Pattern.compile("^\\d{4}$");

    /**
     * Same rules as {@code _parse_metadata} in sync.py, for a path relative to "Dokumente":
     * "Reisen/2025/Thailand/x.pdf" → (Reisen, Thailand, 2025);
     * "Finanzen/Versicherung/Barmer/2026/x.pdf" → (Finanzen, Versicherung/Barmer, 2026);
     * "Lieferanten/Heizung/x.pdf" → (Lieferanten, Heizung, null).
     */
    static VaultPath parse(String relPath) {
        List<String> parts = new ArrayList<>();
        for (String p : relPath.replace('\\', '/').split("/")) if (!p.isBlank() && !p.equals(".")) parts.add(p);
        if (parts.isEmpty()) return new VaultPath(null, null, null, relPath);
        String filename = parts.remove(parts.size() - 1);
        if (parts.isEmpty()) return new VaultPath(null, null, null, filename);
        String category = parts.get(0);
        List<String> rest = parts.subList(1, parts.size());
        if (rest.isEmpty()) return new VaultPath(category, null, null, filename);
        if (YEAR.matcher(rest.get(0)).matches()) {
            return new VaultPath(category, rest.size() >= 2 ? rest.get(1) : null, Integer.parseInt(rest.get(0)), filename);
        }
        for (int i = 0; i < rest.size(); i++) {
            if (YEAR.matcher(rest.get(i)).matches()) {
                return new VaultPath(category, i > 0 ? String.join("/", rest.subList(0, i)) : null,
                        Integer.parseInt(rest.get(i)), filename);
            }
        }
        return new VaultPath(category, String.join("/", rest), null, filename);
    }

    /**
     * Creates (or finds) the archive document for a filed item and stores Claude's
     * description on it. Runs in the caller's transaction (the one that marks the item DONE).
     */
    public UUID archive(ScanInboxItem item, byte[] data, String finalPath) {
        VaultPath vp = parse(finalPath);
        String summary = summaryText(item);
        var existing = documentRepository.findFirstByFilenameAndCategoryAndSubcategoryAndYear(
                vp.filename(), vp.category(), vp.subcategory(), vp.year());
        if (existing.isPresent()) {
            Document doc = existing.get();
            if (summary != null && !summary.equals(doc.getAiSummary())) {
                doc.setAiSummary(summary);
                UUID id = doc.getId();
                afterCommit(() -> indexingService.ensureSummaryChunkAsync(id));
            }
            log.info("Scan '{}' already in the archive as {}", vp.filename(), doc.getId());
            return doc.getId();
        }
        Document doc = documentService.storeArchived(data, vp.filename(), item.getContentType(), item.getOwner(),
                item.isMail() ? DocumentSource.EMAIL : DocumentSource.SCAN,
                item.isMail() ? item.getMailSubject() : null,
                vp.category(), vp.subcategory(), vp.year(), summary);
        log.info("Scan '{}' archived as {} ({} / {} / {})", vp.filename(), doc.getId(),
                vp.category(), vp.subcategory(), vp.year());
        return doc.getId();
    }

    /** Claude's summary, else its one-line reason; plus the tax flag. */
    static String summaryText(ScanInboxItem item) {
        String s = StringUtils.hasText(item.getSuggestionSummary()) ? item.getSuggestionSummary().strip()
                : StringUtils.hasText(item.getSuggestionReason()) ? item.getSuggestionReason().strip() : null;
        if (s == null) return null;
        if (Boolean.TRUE.equals(item.getTaxRelevant())) s += " Steuerrelevant.";
        return s;
    }

    private static void afterCommit(Runnable r) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    r.run();
                }
            });
        } else {
            r.run();
        }
    }
}
