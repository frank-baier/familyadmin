package de.baier.familyadmin.tax;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.tax.TaxAiService.Candidate;
import de.baier.familyadmin.tax.TaxAiService.GeneratedItem;
import de.baier.familyadmin.tax.TaxDtos.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Tax assistant of the documents app: what is in the tax folder of a year, what is still
 * missing compared with last year (checklist), and which archive documents might belong
 * there (hints). The AI work itself runs in {@link TaxJobs}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class TaxService {

    static final int MAX_CANDIDATES_PER_RUN = 400;
    private static final List<TaxHint.Status> VISIBLE_HINTS = List.of(TaxHint.Status.PENDING,
            TaxHint.Status.COPY_REQUESTED, TaxHint.Status.COPIED, TaxHint.Status.DISMISSED);

    private final TaxFolderListingRepository listingRepository;
    private final TaxYearStateRepository stateRepository;
    private final TaxChecklistItemRepository itemRepository;
    private final TaxHintRepository hintRepository;
    private final TaxAiService ai;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    // ── Listing from the Mac ────────────────────────────────────────────────

    public void saveListing(UUID ownerId, ListingRequest req) {
        if (req == null || req.years() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        Instant now = Instant.now();
        for (ListingYear y : req.years()) {
            if (y.year() == null || y.year() < 2000 || y.year() > 2100) continue;
            List<ListedFile> files = Optional.ofNullable(y.files()).orElse(List.of()).stream()
                    .filter(f -> f != null && validPath(f.path()))
                    .toList();
            List<String> folders = Optional.ofNullable(y.folders()).orElse(List.of()).stream()
                    .filter(this::validPath).toList();
            String json = write(new StoredListing(files, folders));
            TaxFolderListing listing = listingRepository.findById(new TaxYearKey(ownerId, y.year()))
                    .orElseGet(() -> TaxFolderListing.builder().ownerId(ownerId).taxYear(y.year()).build());
            if (json.equals(listing.getFiles())) continue;   // unchanged → keep updatedAt
            listing.setFiles(json);
            listing.setUpdatedAt(now);
            listingRepository.save(listing);
        }
    }

    private boolean validPath(String p) {
        return p != null && p.startsWith(TaxRubrics.ROOT + "/") && !p.contains("..") && p.length() <= 1500;
    }

    @Transactional(readOnly = true)
    public StoredListing listing(UUID ownerId, int year) {
        return listingRepository.findById(new TaxYearKey(ownerId, year))
                .map(l -> read(l.getFiles(), StoredListing.class))
                .orElse(new StoredListing(List.of(), List.of()));
    }

    // ── Overview ────────────────────────────────────────────────────────────

    public static int defaultYear() {
        return LocalDate.now(ZoneId.of("Europe/Berlin")).getYear() - 1;
    }

    @Transactional(readOnly = true)
    public Overview overview(UUID ownerId, Integer requestedYear) {
        int year = requestedYear != null ? requestedYear : defaultYear();
        List<TaxFolderListing> listings = listingRepository.findByOwnerIdOrderByTaxYearDesc(ownerId);
        TreeSet<Integer> years = new TreeSet<>(Comparator.reverseOrder());
        listings.forEach(l -> years.add(l.getTaxYear()));
        years.add(defaultYear());
        years.add(year);

        Optional<TaxFolderListing> listing = listings.stream().filter(l -> l.getTaxYear() == year).findFirst();
        StoredListing stored = listing.map(l -> read(l.getFiles(), StoredListing.class))
                .orElse(new StoredListing(List.of(), List.of()));
        List<FolderFile> files = stored.files().stream()
                .map(f -> new FolderFile(f.path(), TaxRubrics.fileName(f.path()), TaxRubrics.rubricOf(f.path(), year),
                        f.size(), f.modified()))
                .sorted(Comparator.comparing(FolderFile::rubric).thenComparing(FolderFile::name, String.CASE_INSENSITIVE_ORDER))
                .toList();

        TaxYearState state = stateRepository.findById(new TaxYearKey(ownerId, year))
                .orElse(TaxYearState.builder().ownerId(ownerId).taxYear(year).build());
        Instant listingAt = listing.map(TaxFolderListing::getUpdatedAt).orElse(null);
        boolean stale = state.getChecklistGeneratedAt() != null && listingAt != null
                && (state.getChecklistListingAt() == null || listingAt.isAfter(state.getChecklistListingAt()));

        List<String> rubrics = new ArrayList<>(TaxRubrics.TEMPLATE);
        rubrics.add(TaxRubrics.officeRubric(year));
        rubrics.add(TaxRubrics.GENERAL);

        List<ItemResponse> items = itemRepository.findByOwnerIdAndTaxYearOrderByPositionAscCreatedAtAsc(ownerId, year)
                .stream().map(this::toResponse).toList();

        return new Overview(year, new ArrayList<>(years), ai.isConfigured(), TaxRubrics.yearFolder(year),
                listingAt, files, rubrics, items, state.getChecklistSummary(),
                new JobInfo(state.getChecklistStatus(), state.getChecklistError(), state.getChecklistGeneratedAt(),
                        state.getChecklistCostUsd()),
                stale,
                new JobInfo(state.getHintsStatus(), state.getHintsError(), state.getHintsScannedAt(),
                        state.getHintsCostUsd()),
                countCandidates(ownerId, year),
                hints(ownerId, year),
                new JobInfo(state.getReturnStatus(), state.getReturnError(), state.getReturnImportedAt(),
                        state.getReturnCostUsd()),
                state.getReturnFilename(), state.getReturnSummary());
    }

    private ItemResponse toResponse(TaxChecklistItem i) {
        return new ItemResponse(i.getId(), i.getRubric(), i.getTitle(), i.getPerson(), i.getNote(), i.getSource(),
                i.getAiStatus(), readList(i.getMatchedFiles()), readList(i.getPriorFiles()), i.getUserStatus());
    }

    private List<HintResponse> hints(UUID ownerId, int year) {
        List<TaxHint> hints = hintRepository.findByOwnerIdAndTaxYearAndStatusInOrderByCreatedAtDesc(ownerId, year,
                VISIBLE_HINTS);
        if (hints.isEmpty()) return List.of();
        Map<UUID, DocInfo> docs = docInfo(hints.stream().map(TaxHint::getDocumentId).toList());
        return hints.stream().map(h -> {
            DocInfo d = docs.get(h.getDocumentId());
            return new HintResponse(h.getId(), h.getDocumentId(), d != null ? d.filename() : "(gelöscht)",
                    d != null ? d.path() : null, h.getStatus(), h.getRubric(), h.getReason(), h.getTargetFolder(),
                    h.getFinalPath(), h.getCopyError());
        }).toList();
    }

    // ── Checklist: manual edits ─────────────────────────────────────────────

    public ItemResponse addItem(UUID ownerId, int year, ItemRequest req) {
        if (req == null || !StringUtils.hasText(req.title())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Titel fehlt");
        }
        int position = itemRepository.findByOwnerIdAndTaxYearOrderByPositionAscCreatedAtAsc(ownerId, year).stream()
                .mapToInt(TaxChecklistItem::getPosition).max().orElse(0) + 1;
        TaxChecklistItem item = TaxChecklistItem.builder()
                .ownerId(ownerId).taxYear(year)
                .rubric(TaxRubrics.normalise(blankToNull(req.rubric())))
                .title(cut(req.title().strip(), 300))
                .person(cut(blankToNull(req.person()), 60))
                .note(blankToNull(req.note()))
                .source(TaxChecklistItem.Source.MANUAL)
                .position(position)
                .build();
        return toResponse(itemRepository.save(item));
    }

    public ItemResponse setItemStatus(UUID ownerId, UUID id, ItemStatusRequest req) {
        TaxChecklistItem item = ownedItem(ownerId, id);
        String s = req != null ? req.userStatus() : null;
        item.setUserStatus(StringUtils.hasText(s) ? parseEnum(TaxChecklistItem.UserStatus.class, s) : null);
        item.setUpdatedAt(Instant.now());
        return toResponse(item);
    }

    public void deleteItem(UUID ownerId, UUID id) {
        TaxChecklistItem item = ownedItem(ownerId, id);
        if (item.getSource() != TaxChecklistItem.Source.MANUAL) {
            // Generated items would come back with the next comparison → mark instead.
            item.setUserStatus(TaxChecklistItem.UserStatus.NOT_NEEDED);
            item.setUpdatedAt(Instant.now());
            return;
        }
        itemRepository.delete(item);
    }

    private TaxChecklistItem ownedItem(UUID ownerId, UUID id) {
        TaxChecklistItem item = itemRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!item.getOwnerId().equals(ownerId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return item;
    }

    // ── Job state ───────────────────────────────────────────────────────────

    public enum Job { CHECKLIST, HINTS, RETURN }

    /** Marks a job as running; 409 if it already runs. */
    public void startJob(UUID ownerId, int year, Job job) {
        if (!ai.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "ANTHROPIC_API_KEY ist nicht konfiguriert");
        }
        TaxYearState s = state(ownerId, year);
        switch (job) {
            case CHECKLIST -> {
                requireIdle(s.getChecklistStatus());
                s.setChecklistStatus(TaxJobStatus.RUNNING);
                s.setChecklistError(null);
            }
            case HINTS -> {
                requireIdle(s.getHintsStatus());
                s.setHintsStatus(TaxJobStatus.RUNNING);
                s.setHintsError(null);
            }
            case RETURN -> {
                requireIdle(s.getReturnStatus());
                s.setReturnStatus(TaxJobStatus.RUNNING);
                s.setReturnError(null);
            }
        }
    }

    private static void requireIdle(TaxJobStatus status) {
        if (status == TaxJobStatus.RUNNING) throw new ResponseStatusException(HttpStatus.CONFLICT, "Läuft schon");
    }

    public void failJob(UUID ownerId, int year, Job job, String error) {
        TaxYearState s = state(ownerId, year);
        String msg = cut(error, 2000);
        switch (job) {
            case CHECKLIST -> { s.setChecklistStatus(TaxJobStatus.ERROR); s.setChecklistError(msg); }
            case HINTS -> { s.setHintsStatus(TaxJobStatus.ERROR); s.setHintsError(msg); }
            case RETURN -> { s.setReturnStatus(TaxJobStatus.ERROR); s.setReturnError(msg); }
        }
    }

    private TaxYearState state(UUID ownerId, int year) {
        return stateRepository.findById(new TaxYearKey(ownerId, year))
                .orElseGet(() -> stateRepository.save(TaxYearState.builder().ownerId(ownerId).taxYear(year).build()));
    }

    /** Jobs are in-memory: after a restart nothing runs any more. */
    @EventListener(ApplicationReadyEvent.class)
    public void resetInterruptedJobs() {
        String msg = "Abgebrochen (Server-Neustart) – bitte neu starten";
        stateRepository.findByChecklistStatus(TaxJobStatus.RUNNING).forEach(s -> {
            s.setChecklistStatus(TaxJobStatus.ERROR); s.setChecklistError(msg); });
        stateRepository.findByHintsStatus(TaxJobStatus.RUNNING).forEach(s -> {
            s.setHintsStatus(TaxJobStatus.ERROR); s.setHintsError(msg); });
        stateRepository.findByReturnStatus(TaxJobStatus.RUNNING).forEach(s -> {
            s.setReturnStatus(TaxJobStatus.ERROR); s.setReturnError(msg); });
    }

    // ── Checklist: AI comparison ────────────────────────────────────────────

    /** Everything the comparison needs, plus the listing timestamp it is based on. */
    public record ChecklistContext(TaxAiService.ChecklistInput input, Instant listingAt,
                                   Map<String, UUID> manualKeys) {}

    @Transactional(readOnly = true)
    public ChecklistContext checklistContext(UUID ownerId, int year) {
        List<String> current = paths(listing(ownerId, year));
        List<String> prior = paths(listing(ownerId, year - 1)).stream()
                .map(p -> p.startsWith(TaxRubrics.ROOT + "/") ? p.substring(TaxRubrics.ROOT.length() + 1) : p)
                .toList();
        TaxYearState state = stateRepository.findById(new TaxYearKey(ownerId, year)).orElse(null);
        List<String> returnItems = new ArrayList<>();
        if (state != null && state.getReturnItems() != null) {
            for (GeneratedItem i : read(state.getReturnItems(), new TypeReference<List<GeneratedItem>>() {})) {
                returnItems.add(String.join(" | ", Objects.toString(i.rubric(), "?"), i.title(),
                        Objects.toString(i.person(), "–"), Objects.toString(i.note(), "")));
            }
        }
        Map<String, String> manual = new LinkedHashMap<>();
        Map<String, UUID> manualKeys = new HashMap<>();
        int n = 1;
        for (TaxChecklistItem i : itemRepository.findByOwnerIdAndTaxYearAndSource(ownerId, year,
                TaxChecklistItem.Source.MANUAL)) {
            String key = "m" + n++;
            manualKeys.put(key, i.getId());
            manual.put(key, String.join(" | ", Objects.toString(i.getRubric(), "?"), i.getTitle(),
                    Objects.toString(i.getPerson(), "–"), Objects.toString(i.getNote(), "")));
        }
        Instant listingAt = listingRepository.findById(new TaxYearKey(ownerId, year))
                .map(TaxFolderListing::getUpdatedAt).orElse(null);
        return new ChecklistContext(new TaxAiService.ChecklistInput(year, current, prior, returnItems, manual,
                state != null ? state.getReturnSummary() : null), listingAt, manualKeys);
    }

    /** Replaces the generated items; the user's DONE/NOT_NEEDED marks are carried over. */
    public void saveChecklist(UUID ownerId, int year, ChecklistContext ctx, TaxAiService.ChecklistResult result) {
        List<TaxChecklistItem> old = itemRepository.findByOwnerIdAndTaxYearOrderByPositionAscCreatedAtAsc(ownerId, year);
        Map<String, TaxChecklistItem.UserStatus> marks = new HashMap<>();
        for (TaxChecklistItem i : old) {
            if (i.getSource() == TaxChecklistItem.Source.MANUAL || i.getUserStatus() == null) continue;
            marks.put(key(i.getRubric(), i.getTitle(), i.getPerson()), i.getUserStatus());
            List<String> prior = readList(i.getPriorFiles());
            if (!prior.isEmpty()) marks.putIfAbsent(priorKey(i.getRubric(), prior), i.getUserStatus());
        }
        itemRepository.deleteAll(old.stream().filter(i -> i.getSource() != TaxChecklistItem.Source.MANUAL).toList());

        Set<String> known = new HashSet<>(ctx.input().currentFiles());
        int position = 1;
        Instant now = Instant.now();
        for (GeneratedItem g : result.items()) {
            List<String> matched = knownPaths(g.matchedFiles(), known);
            TaxChecklistItem.UserStatus mark = marks.getOrDefault(key(g.rubric(), g.title(), g.person()),
                    g.priorFiles().isEmpty() ? null : marks.get(priorKey(g.rubric(), g.priorFiles())));
            itemRepository.save(TaxChecklistItem.builder()
                    .ownerId(ownerId).taxYear(year)
                    .rubric(g.rubric()).title(g.title()).person(g.person()).note(g.note())
                    .source(g.source())
                    .aiStatus(g.status() == TaxChecklistItem.AiStatus.FOUND && matched.isEmpty()
                            ? TaxChecklistItem.AiStatus.UNKNOWN : g.status())
                    .matchedFiles(write(matched)).priorFiles(write(g.priorFiles()))
                    .userStatus(mark)
                    .position(position++)
                    .createdAt(now).updatedAt(now)
                    .build());
        }
        for (TaxAiService.ManualVerdict v : result.manual()) {
            UUID id = ctx.manualKeys().get(v.key());
            if (id == null) continue;
            itemRepository.findById(id).ifPresent(i -> {
                i.setAiStatus(v.status());
                i.setMatchedFiles(write(knownPaths(v.matchedFiles(), known)));
                i.setPosition(1000 + i.getPosition() % 1000);
                i.setUpdatedAt(now);
            });
        }
        TaxYearState s = state(ownerId, year);
        s.setChecklistStatus(TaxJobStatus.IDLE);
        s.setChecklistError(null);
        s.setChecklistSummary(result.summary());
        s.setChecklistGeneratedAt(now);
        s.setChecklistListingAt(ctx.listingAt());
        s.setChecklistModel(result.model());
        s.setChecklistCostUsd(result.costUsd());
    }

    /** Paths the model returned that really are in the listing (it sometimes drops the root). */
    static List<String> knownPaths(List<String> paths, Set<String> known) {
        List<String> out = new ArrayList<>();
        for (String p : paths) {
            String full = known.contains(p) ? p : TaxRubrics.ROOT + "/" + p;
            if (known.contains(full) && !out.contains(full)) out.add(full);
        }
        return out;
    }

    static String key(String rubric, String title, String person) {
        return norm(TaxRubrics.normalise(rubric)) + "|" + norm(title) + "|" + norm(person);
    }

    static String priorKey(String rubric, List<String> priorFiles) {
        return norm(TaxRubrics.normalise(rubric)) + "|prior|" + priorFiles.stream().map(TaxService::norm).sorted()
                .collect(Collectors.joining(";"));
    }

    private static String norm(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").strip();
    }

    // ── Prior-year return ───────────────────────────────────────────────────

    public void saveReturn(UUID ownerId, int year, String filename, TaxAiService.ReturnResult result) {
        TaxYearState s = state(ownerId, year);
        s.setReturnStatus(TaxJobStatus.IDLE);
        s.setReturnError(null);
        s.setReturnFilename(cut(filename, 512));
        s.setReturnSummary(result.summary());
        s.setReturnItems(write(result.items()));
        s.setReturnImportedAt(Instant.now());
        s.setReturnCostUsd(result.costUsd());
    }

    // ── Hints ───────────────────────────────────────────────────────────────

    private static final String CANDIDATE_WHERE = """
            FROM documents d
            WHERE (d.uploaded_by = ? OR d.uploaded_by IN
                     (SELECT s.owner_id FROM user_document_shares s WHERE s.shared_with_id = ?))
              AND (d.year = ? OR (d.year IS NULL AND d.filename LIKE ?))
              AND COALESCE(d.subcategory, '') NOT LIKE 'Finanzamt/Steuerunterlagen%'
              AND NOT EXISTS (SELECT 1 FROM tax_hints h
                              WHERE h.owner_id = ? AND h.tax_year = ? AND h.document_id = d.id)
            """;

    private Object[] candidateArgs(UUID ownerId, int year) {
        return new Object[]{ownerId, ownerId, year, "%" + year + "%", ownerId, year};
    }

    @Transactional(readOnly = true)
    public long countCandidates(UUID ownerId, int year) {
        Long n = jdbc.queryForObject("SELECT COUNT(*) " + CANDIDATE_WHERE, Long.class, candidateArgs(ownerId, year));
        return n == null ? 0 : n;
    }

    @Transactional(readOnly = true)
    public List<Candidate> candidates(UUID ownerId, int year) {
        return jdbc.query("""
                SELECT d.id, d.filename, d.category, d.subcategory, d.year,
                       (SELECT LEFT(c.chunk_text, 600) FROM document_chunks c
                         WHERE c.document_id = d.id ORDER BY c.chunk_index LIMIT 1) AS excerpt
                """ + CANDIDATE_WHERE + " ORDER BY d.category, d.subcategory, d.filename LIMIT " + MAX_CANDIDATES_PER_RUN,
                (rs, i) -> new Candidate(UUID.fromString(rs.getString("id")), rs.getString("filename"),
                        docPath(rs.getString("category"), (Integer) rs.getObject("year"), rs.getString("subcategory")),
                        rs.getString("excerpt")),
                candidateArgs(ownerId, year));
    }

    public void saveVerdicts(UUID ownerId, int year, TaxAiService.HintBatchResult result) {
        Set<UUID> already = hintRepository.checkedDocumentIds(ownerId, year);
        for (TaxAiService.Verdict v : result.verdicts()) {
            if (!already.add(v.documentId())) continue;
            hintRepository.save(TaxHint.builder()
                    .ownerId(ownerId).taxYear(year).documentId(v.documentId())
                    .status(v.status()).rubric(v.rubric()).reason(v.reason()).model(result.model())
                    .build());
        }
        TaxYearState s = state(ownerId, year);
        s.setHintsCostUsd(Optional.ofNullable(s.getHintsCostUsd()).orElse(BigDecimal.ZERO).add(result.costUsd()));
    }

    public void finishHints(UUID ownerId, int year) {
        TaxYearState s = state(ownerId, year);
        s.setHintsStatus(TaxJobStatus.IDLE);
        s.setHintsError(null);
        s.setHintsScannedAt(Instant.now());
    }

    public HintResponse requestCopy(UUID ownerId, UUID id, HintCopyRequest req) {
        TaxHint h = ownedHint(ownerId, id);
        if (h.getStatus() != TaxHint.Status.PENDING && h.getStatus() != TaxHint.Status.DISMISSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Status hat sich geändert");
        }
        String yf = TaxRubrics.yearFolder(h.getTaxYear());
        String folder = req != null && StringUtils.hasText(req.folder()) ? cleanFolder(req.folder()) : null;
        if (folder != null && !(folder.equals(yf) || folder.startsWith(yf + "/"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ziel muss in " + yf + " liegen");
        }
        if (folder == null) {
            folder = TaxRubrics.targetFolder(h.getRubric(), h.getTaxYear(), listing(ownerId, h.getTaxYear()).folders());
        }
        h.setTargetFolder(folder);
        h.setCopyError(null);
        h.setStatus(TaxHint.Status.COPY_REQUESTED);
        h.setDecidedAt(Instant.now());
        return single(h);
    }

    public HintResponse dismiss(UUID ownerId, UUID id) {
        TaxHint h = ownedHint(ownerId, id);
        if (h.getStatus() != TaxHint.Status.PENDING) throw new ResponseStatusException(HttpStatus.CONFLICT);
        h.setStatus(TaxHint.Status.DISMISSED);
        h.setDecidedAt(Instant.now());
        return single(h);
    }

    public HintResponse undo(UUID ownerId, UUID id) {
        TaxHint h = ownedHint(ownerId, id);
        if (h.getStatus() != TaxHint.Status.COPY_REQUESTED && h.getStatus() != TaxHint.Status.DISMISSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Schon kopiert");
        }
        h.setStatus(TaxHint.Status.PENDING);
        h.setTargetFolder(null);
        h.setCopyError(null);
        h.setDecidedAt(null);
        return single(h);
    }

    // ── Copy jobs for the Mac ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CopyJob> copyJobs(UUID ownerId) {
        List<TaxHint> hints = hintRepository.findByOwnerIdAndStatusOrderByCreatedAtAsc(ownerId,
                TaxHint.Status.COPY_REQUESTED);
        Map<UUID, DocInfo> docs = docInfo(hints.stream().map(TaxHint::getDocumentId).toList());
        return hints.stream().filter(h -> docs.containsKey(h.getDocumentId()))
                .map(h -> new CopyJob(h.getId(), h.getDocumentId(), docs.get(h.getDocumentId()).filename(),
                        h.getTargetFolder()))
                .toList();
    }

    /** File bytes of a requested copy (only while it is requested). */
    @Transactional(readOnly = true)
    public Map.Entry<String, byte[]> copyFile(UUID ownerId, UUID id) {
        TaxHint h = ownedHint(ownerId, id);
        if (h.getStatus() != TaxHint.Status.COPY_REQUESTED) throw new ResponseStatusException(HttpStatus.CONFLICT);
        return jdbc.query("SELECT content_type, data FROM documents WHERE id = ?",
                rs -> rs.next() ? Map.entry(rs.getString(1), rs.getBytes(2)) : null, h.getDocumentId());
    }

    public void copied(UUID ownerId, UUID id, String finalPath) {
        TaxHint h = ownedHint(ownerId, id);
        if (h.getStatus() != TaxHint.Status.COPY_REQUESTED) return;
        h.setStatus(TaxHint.Status.COPIED);
        h.setFinalPath(cut(finalPath, 1536));
        h.setCopyError(null);
    }

    public void copyFailed(UUID ownerId, UUID id, String error) {
        TaxHint h = ownedHint(ownerId, id);
        if (h.getStatus() != TaxHint.Status.COPY_REQUESTED) return;
        h.setStatus(TaxHint.Status.PENDING);
        h.setCopyError(cut(Objects.toString(error, "unbekannter Fehler"), 2000));
    }

    private TaxHint ownedHint(UUID ownerId, UUID id) {
        TaxHint h = hintRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!h.getOwnerId().equals(ownerId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return h;
    }

    private HintResponse single(TaxHint h) {
        DocInfo d = docInfo(List.of(h.getDocumentId())).get(h.getDocumentId());
        return new HintResponse(h.getId(), h.getDocumentId(), d != null ? d.filename() : "(gelöscht)",
                d != null ? d.path() : null, h.getStatus(), h.getRubric(), h.getReason(), h.getTargetFolder(),
                h.getFinalPath(), h.getCopyError());
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private record DocInfo(UUID id, String filename, String path) {}

    private Map<UUID, DocInfo> docInfo(Collection<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        String in = ids.stream().map(x -> "?").collect(Collectors.joining(","));
        return jdbc.query("SELECT id, filename, category, subcategory, year FROM documents WHERE id IN (" + in + ")",
                        (rs, i) -> new DocInfo(UUID.fromString(rs.getString("id")), rs.getString("filename"),
                                docPath(rs.getString("category"), (Integer) rs.getObject("year"),
                                        rs.getString("subcategory"))),
                        ids.toArray())
                .stream().collect(Collectors.toMap(DocInfo::id, Function.identity()));
    }

    /** Readable archive location, e.g. "Gesundheit / 2025 / Anna". */
    static String docPath(String category, Integer year, String subcategory) {
        List<String> parts = new ArrayList<>();
        if (StringUtils.hasText(category)) parts.add(category);
        if (StringUtils.hasText(subcategory)) parts.add(subcategory);
        if (year != null) parts.add(String.valueOf(year));
        return parts.isEmpty() ? null : String.join(" / ", parts);
    }

    static String cleanFolder(String folder) {
        String f = folder.strip().replace('\\', '/');
        if (f.startsWith("Dokumente/")) f = f.substring("Dokumente/".length());
        List<String> parts = new ArrayList<>();
        for (String p : f.split("/")) {
            String s = p.strip();
            if (s.isEmpty() || s.equals(".")) continue;
            if (s.equals("..")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ungültiger Ordner");
            parts.add(s);
        }
        return String.join("/", parts);
    }

    private static List<String> paths(StoredListing l) {
        return l.files().stream().map(ListedFile::path).sorted().toList();
    }

    private <T extends Enum<T>> T parseEnum(Class<T> type, String value) {
        try {
            return Enum.valueOf(type, value.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unbekannter Status: " + value);
        }
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private <T> T read(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private <T> T read(String json, TypeReference<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private List<String> readList(String json) {
        if (json == null || json.isBlank()) return List.of();
        return read(json, new TypeReference<List<String>>() {});
    }

    private static String blankToNull(String s) {
        return StringUtils.hasText(s) ? s.strip() : null;
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
