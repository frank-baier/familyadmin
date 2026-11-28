package de.baier.familyadmin.documents;

import de.baier.familyadmin.documents.ScanInboxDtos.*;
import de.baier.familyadmin.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * "Scan-Eingang" of the documents app. The user endpoints serve the review page; the
 * Mac script ({@code ~/familyadmin-sync/inbox.py}, X-API-Key) uploads files and the folder
 * catalogue, fetches approved moves and reports their result.
 */
@RestController
@RequestMapping("/api/documents/scan")
@RequiredArgsConstructor
public class ScanInboxController {

    private final ScanInboxService service;
    private final ScanInboxAnalyzer analyzer;
    private final ScanFilingSuggestionService suggestionService;
    private final MailInboxPoller mailInboxPoller;

    // ── Review page ─────────────────────────────────────────────────────────

    @GetMapping
    public List<ItemResponse> list(@AuthenticationPrincipal User user) {
        return service.list(user);
    }

    @GetMapping("/status")
    public Map<String, Object> status(@AuthenticationPrincipal User user) {
        Map<String, Object> m = new HashMap<>();
        m.put("pending", service.countOpen(user));
        m.put("aiConfigured", suggestionService.isConfigured());
        m.put("catalogUpdatedAt", service.catalogUpdatedAt(user).orElse(null));
        m.put("mailConfigured", mailInboxPoller.isConfigured());
        return m;
    }

    /** Check the mailbox now instead of waiting for the next scheduled poll. */
    @PostMapping("/mail/poll")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Integer> pollMail() {
        if (!mailInboxPoller.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Kein Postfach konfiguriert");
        }
        try {
            return Map.of("created", mailInboxPoller.poll());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Postfach nicht erreichbar: " + e.getMessage());
        }
    }

    @GetMapping("/folders")
    public List<String> folders(@AuthenticationPrincipal User user) {
        return service.folders(user);
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<byte[]> file(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        ScanInboxItem item = service.withData(id, user);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(item.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(item.getSourceName(), StandardCharsets.UTF_8).build().toString())
                .body(item.getData());
    }

    @PostMapping("/{id}/approve")
    public ItemResponse approve(@PathVariable UUID id, @RequestBody(required = false) ApproveRequest req,
                                @AuthenticationPrincipal User user) {
        return service.approve(id, req, user);
    }

    @PostMapping("/{id}/reject")
    public ItemResponse reject(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        return service.reject(id, user);
    }

    @PostMapping("/{id}/undo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void undo(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        if (service.undo(id, user)) analyzer.analyzeAsync(id);
    }

    @PostMapping("/{id}/reanalyze")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void reanalyze(@PathVariable UUID id, @RequestBody(required = false) ReanalyzeRequest req,
                          @AuthenticationPrincipal User user) {
        service.prepareReanalysis(id, req != null ? req.hint() : null, user);
        analyzer.analyzeAsync(id);
    }

    // ── Mac script ──────────────────────────────────────────────────────────

    @PutMapping("/catalog")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void catalog(@RequestBody CatalogRequest req, @AuthenticationPrincipal User user) {
        service.saveCatalog(user, req);
    }

    /**
     * {@code file} is what gets analysed and previewed (for HEIC the Mac sends a JPEG copy);
     * {@code filename}, {@code sha256} and {@code size} describe the original in _Wohin?.
     */
    @PostMapping(value = "/items", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UploadResponse upload(@RequestParam("file") MultipartFile file,
                                 @RequestParam("sha256") String sha256,
                                 @RequestParam("filename") String filename,
                                 @RequestParam(value = "size", required = false) Long size,
                                 @AuthenticationPrincipal User user) throws IOException {
        if (!sha256.matches("(?i)[0-9a-f]{64}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sha256 ungültig");
        }
        var result = service.register(user, sha256, filename, file.getContentType(),
                size != null ? size : file.getSize(), file.getBytes());
        if (result.analyze()) analyzer.analyzeAsync(result.response().id());
        return result.response();
    }

    @PostMapping("/present")
    public Map<String, Integer> present(@RequestBody PresentRequest req, @AuthenticationPrincipal User user) {
        if (req == null || req.sha256() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return Map.of("gone", service.markMissing(user, req.sha256()));
    }

    @GetMapping("/moves")
    public List<MoveJob> moves(@AuthenticationPrincipal User user) {
        return service.moveJobs(user);
    }

    @PostMapping("/{id}/moved")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void moved(@PathVariable UUID id, @RequestBody(required = false) MovedRequest req,
                      @AuthenticationPrincipal User user) {
        service.moved(id, req != null ? req.finalPath() : null, user);
    }

    /** Mac: filed items that are not in the archive yet (filed before this existed). */
    @GetMapping("/archive-jobs")
    public List<ArchiveJob> archiveJobs(@AuthenticationPrincipal User user) {
        return service.archiveJobs(user);
    }

    /** Mac: the filed file once more, so it lands in the archive with Claude's description. */
    @PostMapping(value = "/{id}/archive", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archive(@PathVariable UUID id, @RequestParam("file") MultipartFile file,
                        @AuthenticationPrincipal User user) throws java.io.IOException {
        service.archiveUploaded(id, file.getBytes(), user);
    }

    /** Admin: suggestion for a file without saving anything (to compare models and prompts). */
    @PostMapping(value = "/dry-run", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ScanFilingSuggestionService.Suggestion dryRun(@RequestParam("file") MultipartFile file,
                                                         @RequestParam(value = "filename", required = false) String filename,
                                                         @AuthenticationPrincipal User user) throws java.io.IOException {
        String name = filename != null && !filename.isBlank() ? filename : file.getOriginalFilename();
        return analyzer.suggest(name, file.getContentType(), file.getBytes(), null, null,
                service.catalogFor(user), user.getId());
    }

    @PostMapping("/{id}/move-failed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void moveFailed(@PathVariable UUID id, @RequestBody(required = false) MoveFailedRequest req,
                           @AuthenticationPrincipal User user) {
        service.moveFailed(id, req != null ? req.error() : null, user);
    }
}
