package de.baier.familyadmin.tax;

import de.baier.familyadmin.tax.TaxDtos.*;
import de.baier.familyadmin.user.User;
import lombok.RequiredArgsConstructor;
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

/**
 * Steuer-Assistent of the documents app ({@code /documents/steuer}). Lives below
 * /api/documents so the documents module permission applies. The Mac script
 * ({@code ~/familyadmin-sync/inbox.py}, X-API-Key) sends the folder listing and copies
 * approved hints into the tax folder.
 */
@RestController
@RequestMapping("/api/documents/tax")
@RequiredArgsConstructor
public class TaxController {

    private static final long MAX_RETURN_BYTES = 30L * 1024 * 1024;

    private final TaxService service;
    private final TaxJobs jobs;

    // ── Page ────────────────────────────────────────────────────────────────

    @GetMapping
    public Overview overview(@RequestParam(required = false) Integer year, @AuthenticationPrincipal User user) {
        return service.overview(user.getId(), checkYear(year));
    }

    @PostMapping("/{year}/checklist/refresh")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void refreshChecklist(@PathVariable int year, @AuthenticationPrincipal User user) {
        service.startJob(user.getId(), checkYear(year), TaxService.Job.CHECKLIST);
        jobs.checklistAsync(user.getId(), year);
    }

    @PostMapping("/{year}/items")
    public ItemResponse addItem(@PathVariable int year, @RequestBody ItemRequest req, @AuthenticationPrincipal User user) {
        return service.addItem(user.getId(), checkYear(year), req);
    }

    @PatchMapping("/items/{id}")
    public ItemResponse setItemStatus(@PathVariable UUID id, @RequestBody(required = false) ItemStatusRequest req,
                                      @AuthenticationPrincipal User user) {
        return service.setItemStatus(user.getId(), id, req);
    }

    @DeleteMapping("/items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        service.deleteItem(user.getId(), id);
    }

    /** Return (or assessment) of {@code year - 1} as PDF → checklist of {@code year}. */
    @PostMapping(value = "/{year}/prior-return", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void importReturn(@PathVariable int year, @RequestParam("file") MultipartFile file,
                             @AuthenticationPrincipal User user) throws IOException {
        checkYear(year);
        if (file.isEmpty() || file.getSize() > MAX_RETURN_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF fehlt oder ist größer als 30 MB");
        }
        String name = file.getOriginalFilename() != null ? file.getOriginalFilename() : "Steuererklärung.pdf";
        if (!name.toLowerCase().endsWith(".pdf")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bitte eine PDF-Datei hochladen");
        }
        byte[] data = file.getBytes();
        service.startJob(user.getId(), year, TaxService.Job.RETURN);
        jobs.returnAsync(user.getId(), year, name, "application/pdf", data);
    }

    @PostMapping("/{year}/hints/scan")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void scanHints(@PathVariable int year, @AuthenticationPrincipal User user) {
        service.startJob(user.getId(), checkYear(year), TaxService.Job.HINTS);
        jobs.hintsAsync(user.getId(), year);
    }

    @PostMapping("/hints/{id}/copy")
    public HintResponse copy(@PathVariable UUID id, @RequestBody(required = false) HintCopyRequest req,
                             @AuthenticationPrincipal User user) {
        return service.requestCopy(user.getId(), id, req);
    }

    @PostMapping("/hints/{id}/dismiss")
    public HintResponse dismiss(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        return service.dismiss(user.getId(), id);
    }

    @PostMapping("/hints/{id}/undo")
    public HintResponse undo(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        return service.undo(user.getId(), id);
    }

    // ── Mac script ──────────────────────────────────────────────────────────

    @PutMapping("/listing")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void listing(@RequestBody ListingRequest req, @AuthenticationPrincipal User user) {
        service.saveListing(user.getId(), req);
    }

    @GetMapping("/copy-jobs")
    public List<CopyJob> copyJobs(@AuthenticationPrincipal User user) {
        return service.copyJobs(user.getId());
    }

    @GetMapping("/copy-jobs/{id}/file")
    public ResponseEntity<byte[]> copyFile(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        var file = service.copyFile(user.getId(), id);
        if (file == null) throw new ResponseStatusException(HttpStatus.GONE, "Dokument gelöscht");
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(file.getKey())).body(file.getValue());
    }

    @PostMapping("/copy-jobs/{id}/copied")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void copied(@PathVariable UUID id, @RequestBody(required = false) CopiedRequest req,
                       @AuthenticationPrincipal User user) {
        service.copied(user.getId(), id, req != null ? req.finalPath() : null);
    }

    @PostMapping("/copy-jobs/{id}/failed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void copyFailed(@PathVariable UUID id, @RequestBody(required = false) CopyFailedRequest req,
                           @AuthenticationPrincipal User user) {
        service.copyFailed(user.getId(), id, req != null ? req.error() : null);
    }

    private static Integer checkYear(Integer year) {
        if (year != null && (year < 2000 || year > 2100)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ungültiges Jahr");
        }
        return year;
    }
}
