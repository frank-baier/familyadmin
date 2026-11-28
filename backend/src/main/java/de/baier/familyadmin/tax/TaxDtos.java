package de.baier.familyadmin.tax;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Request/response records of the tax API ({@code /api/documents/tax}). */
public final class TaxDtos {

    private TaxDtos() {}

    // ── Mac → server ────────────────────────────────────────────────────────

    /** One file; {@code path} is relative to iCloud "Dokumente". */
    public record ListedFile(String path, Long size, String modified) {}

    /** Files and folders of "Steuerunterlagen <year>" plus "Behörden/Finanzamt/<year>". */
    public record ListingYear(Integer year, List<ListedFile> files, List<String> folders) {}

    public record ListingRequest(List<ListingYear> years) {}

    /** What is stored per year. */
    public record StoredListing(List<ListedFile> files, List<String> folders) {}

    /** A hint the user wants copied into the tax folder; the Mac fetches the file by id. */
    public record CopyJob(UUID id, UUID documentId, String filename, String folder) {}

    public record CopiedRequest(String finalPath) {}

    public record CopyFailedRequest(String error) {}

    // ── App → server ────────────────────────────────────────────────────────

    public record ItemRequest(String rubric, String title, String person, String note) {}

    /** {@code userStatus}: DONE, NOT_NEEDED or null (= open again). */
    public record ItemStatusRequest(String userStatus) {}

    public record HintCopyRequest(String folder) {}

    // ── Server → app ────────────────────────────────────────────────────────

    public record FolderFile(String path, String name, String rubric, Long size, String modified) {}

    public record ItemResponse(UUID id, String rubric, String title, String person, String note,
                               TaxChecklistItem.Source source, TaxChecklistItem.AiStatus aiStatus,
                               List<String> matchedFiles, List<String> priorFiles,
                               TaxChecklistItem.UserStatus userStatus) {}

    public record HintResponse(UUID id, UUID documentId, String filename, String documentPath,
                               TaxHint.Status status, String rubric, String reason, String targetFolder,
                               String finalPath, String copyError) {}

    public record JobInfo(TaxJobStatus status, String error, Instant finishedAt, BigDecimal costUsd) {}

    public record Overview(
            int year,
            List<Integer> years,
            boolean aiConfigured,
            /** Folder of this year below "Dokumente". */
            String folder,
            Instant listingUpdatedAt,
            List<FolderFile> files,
            List<String> rubrics,
            List<ItemResponse> items,
            String checklistSummary,
            JobInfo checklist,
            /** The folder changed after the last comparison. */
            boolean checklistStale,
            JobInfo hints,
            /** Documents of this year in the archive not yet checked by the AI. */
            long uncheckedDocuments,
            List<HintResponse> hintItems,
            JobInfo priorReturn,
            String priorReturnFilename,
            String priorReturnSummary) {}
}
