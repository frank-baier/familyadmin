package de.baier.familyadmin.documents;

/** Filing location chosen by the user; null fields fall back to the suggestion. */
public record MailInboxApproveRequest(
        String category,
        String subcategory,
        Integer year,
        String filename
) {}
