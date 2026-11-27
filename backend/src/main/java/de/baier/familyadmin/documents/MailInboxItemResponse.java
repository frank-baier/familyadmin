package de.baier.familyadmin.documents;

import java.time.Instant;
import java.util.UUID;

public record MailInboxItemResponse(
        UUID id,
        String mailFrom,
        String mailSubject,
        Instant mailDate,
        String filename,
        String contentType,
        long fileSize,
        String suggestedCategory,
        String suggestedSubcategory,
        Integer suggestedYear,
        String suggestionReason,
        String suggestionModel,
        Boolean suggestedImportant,
        MailInboxStatus status,
        String previewUrl
) {
    public static MailInboxItemResponse from(MailInboxItem i) {
        return new MailInboxItemResponse(i.getId(), i.getMailFrom(), i.getMailSubject(), i.getMailDate(),
                i.getFilename(), i.getContentType(), i.getFileSize(),
                i.getSuggestedCategory(), i.getSuggestedSubcategory(), i.getSuggestedYear(),
                i.getSuggestionReason(), i.getSuggestionModel(), i.getSuggestedImportant(), i.getStatus(),
                "/api/documents/inbox/" + i.getId() + "/file");
    }
}
