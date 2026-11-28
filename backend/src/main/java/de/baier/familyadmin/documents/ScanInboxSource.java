package de.baier.familyadmin.documents;

public enum ScanInboxSource {
    /** File in iCloud "Dokumente/_Wohin?" (uploaded by the Mac script). */
    SCAN,
    /** Attachment of an e-mail fetched by {@link MailInboxPoller}; exists only on the server until filed. */
    MAIL
}
