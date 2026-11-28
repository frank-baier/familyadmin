package de.baier.familyadmin.documents;

public enum ScanInboxStatus {
    /** Uploaded, Claude is working on the suggestion. */
    ANALYZING,
    /** Suggestion ready (or analysis failed / move failed): waits for the user. */
    PENDING,
    /** User approved; waits for the Mac to move the file. */
    APPROVED,
    /** Moved in iCloud Drive. */
    DONE,
    /** User wants the file left in _Wohin? without further suggestions. */
    REJECTED,
    /** File no longer in _Wohin? (moved or deleted by hand). */
    GONE
}
