package de.baier.familyadmin.documents;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.documents.ScanInboxDtos.*;
import de.baier.familyadmin.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

/**
 * Scan inbox ("Scan-Eingang"): files from iCloud "Dokumente/_Wohin?" with a suggested
 * folder and name. Nothing is moved automatically: the user approves (or corrects) each
 * suggestion, the Mac script then moves the file and reports back.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ScanInboxService {

    /** Statuses in which a file still lies in _Wohin? and is known to the inbox. */
    static final Set<ScanInboxStatus> IN_FOLDER = EnumSet.of(ScanInboxStatus.ANALYZING, ScanInboxStatus.PENDING,
            ScanInboxStatus.APPROVED, ScanInboxStatus.REJECTED);
    private static final Set<ScanInboxStatus> KNOWN = EnumSet.of(ScanInboxStatus.ANALYZING, ScanInboxStatus.PENDING,
            ScanInboxStatus.APPROVED, ScanInboxStatus.REJECTED, ScanInboxStatus.GONE);
    private static final Set<ScanInboxStatus> OPEN = EnumSet.of(ScanInboxStatus.ANALYZING, ScanInboxStatus.PENDING,
            ScanInboxStatus.APPROVED);

    private final ScanInboxItemRepository itemRepository;
    private final ScanFolderCatalogRepository catalogRepository;
    private final ObjectMapper objectMapper;

    /** Data the analyzer needs, read in one short transaction. */
    public record AnalysisInput(String sourceName, String contentType, byte[] data, String hint,
                                List<CatalogFolder> catalog) {}

    // ── User side ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ItemResponse> list(User user) {
        List<ItemResponse> result = new ArrayList<>();
        itemRepository.findByOwnerIdAndStatusInOrderByCreatedAtDesc(user.getId(),
                        EnumSet.of(ScanInboxStatus.ANALYZING, ScanInboxStatus.PENDING, ScanInboxStatus.APPROVED,
                                ScanInboxStatus.REJECTED))
                .forEach(i -> result.add(ItemResponse.from(i)));
        itemRepository.findTop10ByOwnerIdAndStatusOrderByMovedAtDesc(user.getId(), ScanInboxStatus.DONE)
                .forEach(i -> result.add(ItemResponse.from(i)));
        return result;
    }

    @Transactional(readOnly = true)
    public long countOpen(User user) {
        return itemRepository.countByOwnerIdAndStatusIn(user.getId(), EnumSet.of(ScanInboxStatus.PENDING));
    }

    @Transactional(readOnly = true)
    public ScanInboxItem withData(UUID id, User user) {
        ScanInboxItem item = owned(id, user);
        if (item.getData() == null) throw new ResponseStatusException(HttpStatus.GONE, "Datei schon verschoben");
        return item;
    }

    public ItemResponse approve(UUID id, ApproveRequest req, User user) {
        ScanInboxItem item = owned(id, user);
        requireStatus(item, ScanInboxStatus.PENDING);
        String folder = ScanFilingSuggestionService.cleanFolder(
                req != null && StringUtils.hasText(req.folder()) ? req.folder() : item.getSuggestedFolder());
        if (folder == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ordner fehlt oder ist ungültig");
        String filename = ScanFilingSuggestionService.cleanFilename(
                req != null && StringUtils.hasText(req.filename()) ? req.filename() : item.getSuggestedFilename(),
                item.getSourceName());
        item.setTargetFolder(folder);
        item.setTargetFilename(filename);
        item.setStatus(ScanInboxStatus.APPROVED);
        item.setMoveError(null);
        item.setDecidedAt(Instant.now());
        return ItemResponse.from(item);
    }

    /** Leave the file in _Wohin?; no further suggestions. */
    public ItemResponse reject(UUID id, User user) {
        ScanInboxItem item = owned(id, user);
        requireStatus(item, ScanInboxStatus.PENDING, ScanInboxStatus.ANALYZING);
        item.setStatus(ScanInboxStatus.REJECTED);
        item.setDecidedAt(Instant.now());
        return ItemResponse.from(item);
    }

    /** Takes back an approval (before the Mac moved the file) or a rejection. Returns true if analysis is needed. */
    public boolean undo(UUID id, User user) {
        ScanInboxItem item = owned(id, user);
        requireStatus(item, ScanInboxStatus.APPROVED, ScanInboxStatus.REJECTED);
        boolean analyze = item.getSuggestedFolder() == null && item.getAnalysisError() == null;
        item.setStatus(analyze ? ScanInboxStatus.ANALYZING : ScanInboxStatus.PENDING);
        item.setDecidedAt(null);
        return analyze;
    }

    public void prepareReanalysis(UUID id, String hint, User user) {
        ScanInboxItem item = owned(id, user);
        requireStatus(item, ScanInboxStatus.PENDING, ScanInboxStatus.REJECTED);
        if (item.getData() == null) throw new ResponseStatusException(HttpStatus.GONE, "Datei schon verschoben");
        item.setUserHint(StringUtils.hasText(hint) ? hint.strip() : null);
        item.setStatus(ScanInboxStatus.ANALYZING);
        item.setAnalysisError(null);
    }

    @Transactional(readOnly = true)
    public List<String> folders(User user) {
        return catalog(user.getId()).stream().map(CatalogFolder::path)
                .filter(p -> p != null && !p.startsWith("_Wohin")).sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

    @Transactional(readOnly = true)
    public Optional<Instant> catalogUpdatedAt(User user) {
        return catalogRepository.findById(user.getId()).map(ScanFolderCatalog::getUpdatedAt);
    }

    // ── Mac side ────────────────────────────────────────────────────────────

    public void saveCatalog(User user, CatalogRequest req) {
        if (req == null || req.folders() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        try {
            catalogRepository.save(new ScanFolderCatalog(user.getId(),
                    objectMapper.writeValueAsString(req.folders()), Instant.now()));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Katalog ungültig");
        }
    }

    /**
     * Registers a file from _Wohin?. Known files (same hash) are not analysed again; a file
     * that was marked GONE and reappears gets its old suggestion back.
     * Returns the item and whether an analysis must be started.
     */
    public UploadResult register(User user, String sha256, String sourceName, String contentType,
                                 long fileSize, byte[] data) {
        String sha = sha256.toLowerCase(Locale.ROOT);
        Optional<ScanInboxItem> existing = itemRepository.findFirstByOwnerIdAndSha256AndStatusIn(user.getId(), sha, KNOWN);
        if (existing.isPresent()) {
            ScanInboxItem item = existing.get();
            item.setSourceName(sourceName);
            boolean analyze = false;
            if (item.getStatus() == ScanInboxStatus.GONE) {
                analyze = item.getSuggestedFolder() == null;
                item.setStatus(analyze ? ScanInboxStatus.ANALYZING : ScanInboxStatus.PENDING);
                if (item.getData() == null) item.setData(data);
            }
            return new UploadResult(new UploadResponse(item.getId(), item.getStatus(), false), analyze);
        }
        ScanInboxItem item = itemRepository.save(ScanInboxItem.builder()
                .owner(user).sha256(sha).sourceName(sourceName)
                .contentType(StringUtils.hasText(contentType) ? contentType : "application/octet-stream")
                .fileSize(fileSize).data(data).status(ScanInboxStatus.ANALYZING)
                .build());
        return new UploadResult(new UploadResponse(item.getId(), item.getStatus(), true), true);
    }

    public record UploadResult(UploadResponse response, boolean analyze) {}

    /** Everything known to lie in _Wohin? but not in {@code present} was removed by hand → GONE. */
    public int markMissing(User user, Collection<String> present) {
        Set<String> hashes = new HashSet<>();
        present.forEach(h -> hashes.add(h.toLowerCase(Locale.ROOT)));
        int gone = 0;
        for (ScanInboxItem item : itemRepository.findByOwnerIdAndStatusInOrderByCreatedAtDesc(user.getId(), IN_FOLDER)) {
            if (!hashes.contains(item.getSha256())) {
                item.setStatus(ScanInboxStatus.GONE);
                gone++;
            }
        }
        return gone;
    }

    @Transactional(readOnly = true)
    public List<MoveJob> moveJobs(User user) {
        return itemRepository.findByOwnerIdAndStatusOrderByDecidedAtAsc(user.getId(), ScanInboxStatus.APPROVED)
                .stream().map(MoveJob::from).toList();
    }

    public void moved(UUID id, String finalPath, User user) {
        ScanInboxItem item = owned(id, user);
        requireStatus(item, ScanInboxStatus.APPROVED);
        item.setStatus(ScanInboxStatus.DONE);
        item.setFinalPath(StringUtils.hasText(finalPath) ? finalPath.strip()
                : item.getTargetFolder() + "/" + item.getTargetFilename());
        item.setMovedAt(Instant.now());
        item.setData(null);
    }

    public void moveFailed(UUID id, String error, User user) {
        ScanInboxItem item = owned(id, user);
        requireStatus(item, ScanInboxStatus.APPROVED);
        item.setStatus(ScanInboxStatus.PENDING);
        item.setMoveError(StringUtils.hasText(error) ? error.strip() : "Verschieben fehlgeschlagen");
    }

    // ── Analyzer side ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Optional<AnalysisInput> analysisInput(UUID id) {
        return itemRepository.findById(id)
                .filter(i -> i.getStatus() == ScanInboxStatus.ANALYZING && i.getData() != null)
                .map(i -> new AnalysisInput(i.getSourceName(), i.getContentType(), i.getData(), i.getUserHint(),
                        catalog(i.getOwner().getId())));
    }

    public void saveSuggestion(UUID id, ScanFilingSuggestionService.Suggestion s) {
        itemRepository.findById(id).filter(i -> i.getStatus() == ScanInboxStatus.ANALYZING).ifPresent(i -> {
            i.setSuggestedFolder(s.folder());
            i.setSuggestedFilename(s.filename());
            i.setTaxRelevant(s.taxRelevant());
            i.setSuggestionReason(s.reason());
            i.setSuggestionModel(s.model());
            i.setSuggestionCostUsd(s.costUsd());
            i.setAnalysisInput(s.input());
            i.setAnalysisError(s.folder() == null ? "Kein brauchbarer Ordner vorgeschlagen" : null);
            i.setStatus(ScanInboxStatus.PENDING);
        });
    }

    public void saveAnalysisError(UUID id, String error) {
        itemRepository.findById(id).filter(i -> i.getStatus() == ScanInboxStatus.ANALYZING).ifPresent(i -> {
            i.setAnalysisError(error);
            i.setStatus(ScanInboxStatus.PENDING);
        });
    }

    @Transactional(readOnly = true)
    public List<UUID> stuckAnalyses(Instant before) {
        return itemRepository.findByStatusAndCreatedAtBefore(ScanInboxStatus.ANALYZING, before)
                .stream().map(ScanInboxItem::getId).toList();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    List<CatalogFolder> catalog(UUID ownerId) {
        return catalogRepository.findById(ownerId).map(c -> {
            try {
                return objectMapper.readValue(c.getFolders(), new TypeReference<List<CatalogFolder>>() {});
            } catch (Exception e) {
                return List.<CatalogFolder>of();
            }
        }).orElse(List.of());
    }

    private ScanInboxItem owned(UUID id, User user) {
        return itemRepository.findById(id)
                .filter(i -> i.getOwner().getId().equals(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private static void requireStatus(ScanInboxItem item, ScanInboxStatus... allowed) {
        if (!Arrays.asList(allowed).contains(item.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Status ist " + item.getStatus());
        }
    }
}
