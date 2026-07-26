-- Mark image-only documents as accepted (skip re-indexing)
ALTER TABLE documents ADD COLUMN indexing_skipped BOOLEAN NOT NULL DEFAULT FALSE;

-- User-level document sharing: owner shares ALL their documents with shared_with
CREATE TABLE user_document_shares (
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner_id, shared_with_id)
);
