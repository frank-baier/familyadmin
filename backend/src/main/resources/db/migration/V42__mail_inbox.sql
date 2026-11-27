-- Mail inbox: attachments picked up from the IMAP mailbox wait here as filing
-- suggestions until the user approves (→ documents) or rejects them.
CREATE TABLE mail_inbox_items (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id            VARCHAR(998) NOT NULL,
    attachment_index      INT NOT NULL,
    mail_from             VARCHAR(512),
    mail_subject          VARCHAR(998),
    mail_date             TIMESTAMPTZ,
    filename              VARCHAR(255) NOT NULL,
    content_type          VARCHAR(127) NOT NULL,
    file_size             BIGINT NOT NULL,
    -- Dropped (NULL) once the item is decided; the row stays so the mail is not re-imported.
    data                  BYTEA,
    suggested_category    VARCHAR(255),
    suggested_subcategory VARCHAR(255),
    suggested_year        INT,
    suggestion_reason     TEXT,
    suggestion_model      VARCHAR(100),
    suggested_important   BOOLEAN,
    status                VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    document_id           UUID REFERENCES documents(id) ON DELETE SET NULL,
    decided_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (owner_id, message_id, attachment_index)
);

CREATE INDEX idx_mail_inbox_items_owner_status ON mail_inbox_items (owner_id, status);

-- IMAP high-water mark per mailbox (UIDs are only valid together with UIDVALIDITY).
CREATE TABLE mail_inbox_sync_state (
    account       VARCHAR(255) PRIMARY KEY,
    uid_validity  BIGINT NOT NULL,
    last_uid      BIGINT NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
