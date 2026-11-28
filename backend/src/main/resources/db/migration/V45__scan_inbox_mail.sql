-- E-mail attachments join the scan inbox: same AI suggestion, same review page.
-- They are not in iCloud "_Wohin?"; after approval the Mac script downloads the file
-- and writes it into the approved folder.
ALTER TABLE scan_inbox_items
    ADD COLUMN source          VARCHAR(10) NOT NULL DEFAULT 'SCAN',
    ADD COLUMN mail_message_id VARCHAR(998),
    ADD COLUMN mail_from       VARCHAR(512),
    ADD COLUMN mail_subject    VARCHAR(998),
    ADD COLUMN mail_date       TIMESTAMPTZ,
    -- false = the AI thinks it is not worth keeping (ads, T&Cs, newsletters …)
    ADD COLUMN worth_keeping   BOOLEAN;

CREATE INDEX idx_scan_inbox_items_owner_mail ON scan_inbox_items (owner_id, mail_message_id)
    WHERE mail_message_id IS NOT NULL;

-- IMAP high-water mark per mailbox (UIDs are only valid together with UIDVALIDITY).
CREATE TABLE mail_inbox_sync_state (
    account       VARCHAR(255) PRIMARY KEY,
    uid_validity  BIGINT NOT NULL,
    last_uid      BIGINT NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
