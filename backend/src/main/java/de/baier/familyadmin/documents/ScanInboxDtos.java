package de.baier.familyadmin.documents;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Request/response records of the scan inbox API. */
public final class ScanInboxDtos {

    private ScanInboxDtos() {}

    /** One folder below "Dokumente" with a few recent file names (naming examples). */
    public record CatalogFolder(String path, List<String> files) {}

    public record CatalogRequest(List<CatalogFolder> folders) {}

    public record ApproveRequest(String folder, String filename) {}

    public record ReanalyzeRequest(String hint) {}

    public record PresentRequest(List<String> sha256) {}

    public record MovedRequest(String finalPath) {}

    public record MoveFailedRequest(String error) {}

    /** What the Mac needs to move one approved file. */
    public record MoveJob(UUID id, String sha256, String sourceName, String folder, String filename) {
        static MoveJob from(ScanInboxItem i) {
            return new MoveJob(i.getId(), i.getSha256(), i.getSourceName(), i.getTargetFolder(), i.getTargetFilename());
        }
    }

    public record ItemResponse(
            UUID id,
            String sourceName,
            String contentType,
            long fileSize,
            ScanInboxStatus status,
            String analysisInput,
            String userHint,
            String suggestedFolder,
            String suggestedFilename,
            Boolean taxRelevant,
            String suggestionReason,
            String suggestionModel,
            BigDecimal suggestionCostUsd,
            String analysisError,
            String targetFolder,
            String targetFilename,
            String finalPath,
            String moveError,
            Instant createdAt,
            Instant movedAt,
            String previewUrl
    ) {
        static ItemResponse from(ScanInboxItem i) {
            return new ItemResponse(i.getId(), i.getSourceName(), i.getContentType(), i.getFileSize(), i.getStatus(),
                    i.getAnalysisInput(), i.getUserHint(), i.getSuggestedFolder(), i.getSuggestedFilename(),
                    i.getTaxRelevant(), i.getSuggestionReason(), i.getSuggestionModel(), i.getSuggestionCostUsd(),
                    i.getAnalysisError(), i.getTargetFolder(), i.getTargetFilename(), i.getFinalPath(),
                    i.getMoveError(), i.getCreatedAt(), i.getMovedAt(),
                    i.getStatus() == ScanInboxStatus.DONE ? null : "/api/documents/scan/" + i.getId() + "/file");
        }
    }

    public record UploadResponse(UUID id, ScanInboxStatus status, boolean created) {}
}
