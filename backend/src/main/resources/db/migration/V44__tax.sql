-- Steuer-Assistent (documents app, /documents/steuer): helps collecting the documents for
-- the German income tax return of a Grenzgänger family (work in Basel, live in Germany).

-- Current file list of iCloud "Dokumente/Behörden/Finanzamt/Steuerunterlagen <Jahr>" and
-- "Behörden/Finanzamt/<Jahr>", sent by the Mac (inbox.py). Names only, no contents.
CREATE TABLE tax_folder_listings (
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tax_year    INTEGER NOT NULL,
    -- JSON {"files": [{"path": "<relative to Dokumente>", "size": 123, "modified": "<ISO>"}],
    --       "folders": ["<relative to Dokumente>", ...]}
    files       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, tax_year)
);

-- Per tax year: state of the background AI jobs and the imported prior-year return.
CREATE TABLE tax_years (
    owner_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tax_year                 INTEGER NOT NULL,
    checklist_status         VARCHAR(20) NOT NULL DEFAULT 'IDLE',
    checklist_error          TEXT,
    checklist_summary        TEXT,
    checklist_generated_at   TIMESTAMPTZ,
    -- listing.updated_at the checklist was built from (→ "folder changed since")
    checklist_listing_at     TIMESTAMPTZ,
    checklist_model          VARCHAR(100),
    checklist_cost_usd       NUMERIC(10, 6),
    hints_status             VARCHAR(20) NOT NULL DEFAULT 'IDLE',
    hints_error              TEXT,
    hints_scanned_at         TIMESTAMPTZ,
    hints_cost_usd           NUMERIC(10, 6),
    -- Return of the previous year (tax_year - 1) read by the AI → checklist items RETURN
    return_status            VARCHAR(20) NOT NULL DEFAULT 'IDLE',
    return_error             TEXT,
    return_filename          VARCHAR(512),
    return_summary           TEXT,
    -- JSON array of {rubric, title, person, note}: what the return says is needed again
    return_items             TEXT,
    return_imported_at       TIMESTAMPTZ,
    return_cost_usd          NUMERIC(10, 6),
    PRIMARY KEY (owner_id, tax_year)
);

CREATE TABLE tax_checklist_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tax_year       INTEGER NOT NULL,
    -- e.g. "01 Arbeitnehmer" (rubric folder name without suffixes like "_fertig")
    rubric         VARCHAR(120),
    title          VARCHAR(300) NOT NULL,
    person         VARCHAR(60),
    note           TEXT,
    -- BASELINE (Grenzgänger knowledge), PRIOR_YEAR (folder of last year), RETURN (last return), MANUAL
    source         VARCHAR(20) NOT NULL,
    -- From the last comparison: FOUND, PARTIAL, MISSING, UNKNOWN
    ai_status      VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    matched_files  TEXT,
    prior_files    TEXT,
    -- Set by the user, survives a new comparison: DONE, NOT_NEEDED (null = open)
    user_status    VARCHAR(20),
    position       INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_checklist_items_owner_year ON tax_checklist_items (owner_id, tax_year);

-- Documents from the archive (outside the tax folder) the AI checked for tax relevance.
CREATE TABLE tax_hints (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tax_year      INTEGER NOT NULL,
    document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    -- PENDING (relevant, waiting for the user), NOT_RELEVANT, ALREADY_FILED,
    -- COPY_REQUESTED (Mac copies it into the tax folder), COPIED, DISMISSED
    status        VARCHAR(20) NOT NULL,
    rubric        VARCHAR(120),
    reason        TEXT,
    target_folder VARCHAR(1024),
    final_path    VARCHAR(1536),
    copy_error    TEXT,
    model         VARCHAR(100),
    decided_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (owner_id, tax_year, document_id)
);

CREATE INDEX idx_tax_hints_owner_year_status ON tax_hints (owner_id, tax_year, status);
