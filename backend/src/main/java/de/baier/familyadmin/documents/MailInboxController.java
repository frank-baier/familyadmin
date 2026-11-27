package de.baier.familyadmin.documents;

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
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Mail attachments waiting to be filed ("Posteingang" in the documents app). */
@RestController
@RequestMapping("/api/documents/inbox")
@RequiredArgsConstructor
public class MailInboxController {

    private final MailInboxService mailInboxService;
    private final MailInboxPoller mailInboxPoller;

    @GetMapping
    public List<MailInboxItemResponse> pending(@AuthenticationPrincipal User user) {
        return mailInboxService.pending(user);
    }

    @GetMapping("/count")
    public Map<String, Object> count(@AuthenticationPrincipal User user) {
        return Map.of("pending", mailInboxService.countPending(user),
                "configured", mailInboxPoller.isConfigured());
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<byte[]> file(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        MailInboxItem item = mailInboxService.pendingItem(id, user);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(item.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(item.getFilename(), StandardCharsets.UTF_8).build().toString())
                .body(item.getData());
    }

    @PostMapping("/{id}/approve")
    public DocumentResponse approve(@PathVariable UUID id,
                                    @RequestBody(required = false) MailInboxApproveRequest request,
                                    @AuthenticationPrincipal User user) {
        return mailInboxService.approve(id, request, user);
    }

    @PostMapping("/{id}/reject")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reject(@PathVariable UUID id, @AuthenticationPrincipal User user) {
        mailInboxService.reject(id, user);
    }

    /** Check the mailbox now instead of waiting for the next scheduled poll. */
    @PostMapping("/poll")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Integer> poll() {
        if (!mailInboxPoller.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Mail-Posteingang ist nicht konfiguriert");
        }
        try {
            return Map.of("created", mailInboxPoller.poll());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Postfach nicht erreichbar: " + e.getMessage());
        }
    }
}
