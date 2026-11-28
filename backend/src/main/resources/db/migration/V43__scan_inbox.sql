-- Scan inbox: files the Mac picks up from iCloud "Dokumente/_Wohin?" wait here with an
-- AI suggestion (target folder + file name). Nothing is moved until the user approves;
-- the Mac script then moves the file in iCloud Drive and reports back.
CREATE TABLE scan_inbox_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sha256               VARCHAR(64) NOT NULL,
    -- File name as it lies in _Wohin? (the Mac finds the file again by sha256)
    source_name          VARCHAR(512) NOT NULL,
    content_type         VARCHAR(127) NOT NULL,
    file_size            BIGINT NOT NULL,
    -- Dropped (NULL) once the file has been moved.
    data                 BYTEA,
    status               VARCHAR(20) NOT NULL DEFAULT 'ANALYZING',
    -- PDF_TEXT (existing OCR/text layer used), DOCUMENT (PDF read by the model), IMAGE, NONE
    analysis_input       VARCHAR(20),
    user_hint            TEXT,
    suggested_folder     VARCHAR(1024),
    suggested_filename   VARCHAR(512),
    tax_relevant         BOOLEAN,
    suggestion_reason    TEXT,
    suggestion_model     VARCHAR(100),
    suggestion_cost_usd  NUMERIC(10, 6),
    analysis_error       TEXT,
    -- What the user approved (suggestion or correction)
    target_folder        VARCHAR(1024),
    target_filename      VARCHAR(512),
    -- Path below "Dokumente" the Mac actually moved the file to
    final_path           VARCHAR(1536),
    move_error           TEXT,
    decided_at           TIMESTAMPTZ,
    moved_at             TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_inbox_items_owner_status ON scan_inbox_items (owner_id, status);
CREATE INDEX idx_scan_inbox_items_owner_sha ON scan_inbox_items (owner_id, sha256);

-- Folder tree of iCloud "Dokumente" with a few example file names per folder, uploaded by
-- the Mac so suggestions can use existing folders and naming patterns.
CREATE TABLE scan_folder_catalog (
    owner_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    folders     TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
