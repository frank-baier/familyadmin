package de.baier.familyadmin.documents;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.baier.familyadmin.documents.ScanInboxDtos.ApproveRequest;
import de.baier.familyadmin.documents.ScanInboxDtos.CatalogFolder;
import de.baier.familyadmin.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ScanInboxTest {

    private final ScanFilingSuggestionService suggestion =
            new ScanFilingSuggestionService("", "claude-opus-5-5", BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE,
                    new ObjectMapper());

    @Test
    void cleanFolderRejectsEscapesAndInbox() {
        assertThat(ScanFilingSuggestionService.cleanFolder("Dokumente/Behörden/Finanzamt/Steuerunterlagen 2025/ "))
                .isEqualTo("Behörden/Finanzamt/Steuerunterlagen 2025");
        assertThat(ScanFilingSuggestionService.cleanFolder("/Auto//2025/")).isEqualTo("Auto/2025");
        assertThat(ScanFilingSuggestionService.cleanFolder("Auto/../../etc")).isNull();
        assertThat(ScanFilingSuggestionService.cleanFolder("_Wohin?")).isNull();
        assertThat(ScanFilingSuggestionService.cleanFolder("  ")).isNull();
    }

    @Test
    void cleanFilenameKeepsOriginalExtension() {
        assertThat(ScanFilingSuggestionService.cleanFilename("Re_ATU_Audi_06.2026.pdf", "scan.PDF"))
                .isEqualTo("Re_ATU_Audi_06.2026.PDF");
        assertThat(ScanFilingSuggestionService.cleanFilename("Re_ATU_Audi_06.2026", "scan.pdf"))
                .isEqualTo("Re_ATU_Audi_06.2026.pdf");
        assertThat(ScanFilingSuggestionService.cleanFilename("a/b:c.pdf", "x.pdf")).isEqualTo("a-b-c.pdf");
        assertThat(ScanFilingSuggestionService.cleanFilename(null, "x.heic")).isEqualTo("x.heic");
    }

    @Test
    void parsesModelAnswer() {
        var s = suggestion.parse("""
                Hier: {"folder": "Behörden/Finanzamt/Steuerunterlagen 2025/02 Aussergewöhnliche Belastungen",
                 "filename": "Re_Dres.Spitzer_Anna_10.2025.pdf", "taxRelevant": true, "reason": "Zahnarztrechnung"}
                """, "Scan 12.pdf", "DOCUMENT", BigDecimal.TEN);
        assertThat(s.folder()).isEqualTo("Behörden/Finanzamt/Steuerunterlagen 2025/02 Aussergewöhnliche Belastungen");
        assertThat(s.filename()).isEqualTo("Re_Dres.Spitzer_Anna_10.2025.pdf");
        assertThat(s.taxRelevant()).isTrue();
        assertThat(s.input()).isEqualTo("DOCUMENT");
    }

    @Test
    void catalogSkipsInboxAndLimitsExamples() {
        String out = ScanFilingSuggestionService.renderCatalog(List.of(
                new CatalogFolder("_Wohin?", List.of("a.pdf")),
                new CatalogFolder("Auto/2025", List.of("1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf"))));
        assertThat(out).doesNotContain("_Wohin").contains("- Auto/2025  | z. B.: 1.pdf ; 2.pdf ; 3.pdf ; 4.pdf\n");
    }

    @Test
    void emptyPdfHasNoText() {
        assertThat(ScanFilingSuggestionService.nonBlankLength(ScanFilingSuggestionService.pdfText(new byte[]{1, 2})))
                .isZero();
    }

    // ── Service ─────────────────────────────────────────────────────────────

    private final ScanInboxItemRepository items = mock(ScanInboxItemRepository.class);
    private final ScanInboxService service =
            new ScanInboxService(items, mock(ScanFolderCatalogRepository.class), new ObjectMapper());

    private User user() {
        User u = new User();
        u.setId(UUID.randomUUID());
        return u;
    }

    private ScanInboxItem item(User owner, ScanInboxStatus status) {
        return ScanInboxItem.builder().id(UUID.randomUUID()).owner(owner).sha256("ab".repeat(32))
                .sourceName("scan.pdf").contentType("application/pdf").data(new byte[]{1})
                .suggestedFolder("Auto/2025").suggestedFilename("Re_ATU_Audi_06.2025.pdf").status(status).build();
    }

    @Test
    void knownHashIsNotAnalysedAgain() {
        User u = user();
        ScanInboxItem existing = item(u, ScanInboxStatus.PENDING);
        when(items.findFirstByOwnerIdAndSourceAndSha256AndStatusIn(eq(u.getId()), eq(ScanInboxSource.SCAN), anyString(), anyCollection()))
                .thenReturn(Optional.of(existing));
        var r = service.register(u, "AB".repeat(32), "renamed.pdf", "application/pdf", 1, new byte[]{1});
        assertThat(r.analyze()).isFalse();
        assertThat(r.response().created()).isFalse();
        assertThat(existing.getSourceName()).isEqualTo("renamed.pdf");
        verify(items, never()).save(any());
    }

    @Test
    void reappearingFileGetsOldSuggestionBack() {
        User u = user();
        ScanInboxItem gone = item(u, ScanInboxStatus.GONE);
        when(items.findFirstByOwnerIdAndSourceAndSha256AndStatusIn(any(), any(), anyString(), anyCollection()))
                .thenReturn(Optional.of(gone));
        var r = service.register(u, "ab".repeat(32), "scan.pdf", "application/pdf", 1, new byte[]{1});
        assertThat(r.analyze()).isFalse();
        assertThat(gone.getStatus()).isEqualTo(ScanInboxStatus.PENDING);
    }

    @Test
    void approveUsesCorrectionAndKeepsExtension() {
        User u = user();
        ScanInboxItem i = item(u, ScanInboxStatus.PENDING);
        when(items.findById(i.getId())).thenReturn(Optional.of(i));
        service.approve(i.getId(), new ApproveRequest("Auto/2026", "Re_ATU_Audi_06.2026"), u);
        assertThat(i.getStatus()).isEqualTo(ScanInboxStatus.APPROVED);
        assertThat(i.getTargetFolder()).isEqualTo("Auto/2026");
        assertThat(i.getTargetFilename()).isEqualTo("Re_ATU_Audi_06.2026.pdf");
    }

    @Test
    void approveWithoutCorrectionTakesSuggestion() {
        User u = user();
        ScanInboxItem i = item(u, ScanInboxStatus.PENDING);
        when(items.findById(i.getId())).thenReturn(Optional.of(i));
        service.approve(i.getId(), null, u);
        assertThat(i.getTargetFolder()).isEqualTo("Auto/2025");
        assertThat(i.getTargetFilename()).isEqualTo("Re_ATU_Audi_06.2025.pdf");
    }

    @Test
    void otherUsersItemIsNotFound() {
        ScanInboxItem i = item(user(), ScanInboxStatus.PENDING);
        when(items.findById(i.getId())).thenReturn(Optional.of(i));
        assertThatThrownBy(() -> service.approve(i.getId(), null, user()))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void missingFilesBecomeGone() {
        User u = user();
        ScanInboxItem present = item(u, ScanInboxStatus.PENDING);
        ScanInboxItem missing = item(u, ScanInboxStatus.APPROVED);
        missing.setSha256("cd".repeat(32));
        when(items.findByOwnerIdAndStatusInOrderByCreatedAtDesc(eq(u.getId()), anyCollection()))
                .thenReturn(List.of(present, missing));
        assertThat(service.markMissing(u, List.of("AB".repeat(32)))).isEqualTo(1);
        assertThat(present.getStatus()).isEqualTo(ScanInboxStatus.PENDING);
        assertThat(missing.getStatus()).isEqualTo(ScanInboxStatus.GONE);
    }

    @Test
    void movedDropsBytesAndFailedGoesBackToReview() {
        User u = user();
        ScanInboxItem i = item(u, ScanInboxStatus.APPROVED);
        when(items.findById(i.getId())).thenReturn(Optional.of(i));
        service.moveFailed(i.getId(), "Ziel nicht beschreibbar", u);
        assertThat(i.getStatus()).isEqualTo(ScanInboxStatus.PENDING);
        assertThat(i.getMoveError()).isEqualTo("Ziel nicht beschreibbar");

        i.setStatus(ScanInboxStatus.APPROVED);
        service.moved(i.getId(), "Auto/2025/Re_ATU_Audi_06.2025.pdf", u);
        assertThat(i.getStatus()).isEqualTo(ScanInboxStatus.DONE);
        assertThat(i.getData()).isNull();
    }

    // ── Mail attachments ────────────────────────────────────────────────────

    private ScanInboxItem mailItem(User owner, ScanInboxStatus status) {
        ScanInboxItem i = item(owner, status);
        i.setSource(ScanInboxSource.MAIL);
        i.setMailFrom("SoBa <info@soba.ch>");
        i.setMailSubject("Ihr Kontoauszug");
        i.setMailDate(java.time.Instant.parse("2026-11-03T08:00:00Z"));
        return i;
    }

    @Test
    void mailAttachmentSeenBeforeIsSkipped() {
        User u = user();
        when(items.existsByOwnerIdAndSourceAndSha256(eq(u.getId()), eq(ScanInboxSource.MAIL), anyString())).thenReturn(true);
        assertThat(service.registerMail(u, "<m1>", "a", "b", null, "agb.pdf", "application/pdf", new byte[]{1})).isNull();
        verify(items, never()).save(any());
    }

    @Test
    void newMailAttachmentIsAnalysed() {
        User u = user();
        when(items.save(any())).thenAnswer(inv -> {
            ScanInboxItem i = inv.getArgument(0);
            i.setId(UUID.randomUUID());
            return i;
        });
        UUID id = service.registerMail(u, "<m1>", "SoBa", "Auszug", null, "auszug.pdf", "application/pdf", new byte[]{1, 2});
        assertThat(id).isNotNull();
        verify(items).save(argThat(i -> i.isMail() && i.getStatus() == ScanInboxStatus.ANALYZING
                && i.getSha256().equals(ScanInboxService.sha256Hex(new byte[]{1, 2}))
                && "<m1>".equals(i.getMailMessageId())));
    }

    @Test
    void mailItemsAreNeverMarkedGone() {
        User u = user();
        ScanInboxItem mail = mailItem(u, ScanInboxStatus.PENDING);
        when(items.findByOwnerIdAndStatusInOrderByCreatedAtDesc(eq(u.getId()), anyCollection()))
                .thenReturn(List.of(mail));
        assertThat(service.markMissing(u, List.of())).isZero();
        assertThat(mail.getStatus()).isEqualTo(ScanInboxStatus.PENDING);
    }

    @Test
    void rejectingMailAttachmentDiscardsIt() {
        User u = user();
        ScanInboxItem mail = mailItem(u, ScanInboxStatus.PENDING);
        when(items.findById(mail.getId())).thenReturn(Optional.of(mail));
        service.reject(mail.getId(), u);
        assertThat(mail.getStatus()).isEqualTo(ScanInboxStatus.REJECTED);
        assertThat(mail.getData()).isNull();
        assertThatThrownBy(() -> service.undo(mail.getId(), u)).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void mailMoveJobCarriesDownloadUrl() {
        User u = user();
        ScanInboxItem mail = mailItem(u, ScanInboxStatus.APPROVED);
        mail.setTargetFolder("Finanzen/Banken/SoBa/2026");
        mail.setTargetFilename("SoBa_Kontoauszug_11.2026.pdf");
        when(items.findByOwnerIdAndStatusOrderByDecidedAtAsc(u.getId(), ScanInboxStatus.APPROVED)).thenReturn(List.of(mail));
        var job = service.moveJobs(u).get(0);
        assertThat(job.source()).isEqualTo(ScanInboxSource.MAIL);
        assertThat(job.fileUrl()).isEqualTo("/api/documents/scan/" + mail.getId() + "/file");
    }

    @Test
    void mailContextNamesSenderDateAndSubject() {
        assertThat(ScanInboxService.mailContext(mailItem(user(), ScanInboxStatus.ANALYZING)))
                .isEqualTo("Anhang einer E-Mail von SoBa <info@soba.ch> vom 03.11.2026, Betreff: \"Ihr Kontoauszug\".");
        assertThat(ScanInboxService.mailContext(item(user(), ScanInboxStatus.ANALYZING))).isNull();
    }
}
