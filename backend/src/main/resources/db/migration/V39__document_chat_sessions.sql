-- Document-chat questions are grouped into sessions so follow-up questions keep their context.
-- Each user has at most one open session (closed_at IS NULL); closed sessions form the history.
CREATE TABLE document_chat_session (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    closed_at  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_document_chat_session_open ON document_chat_session (user_id) WHERE closed_at IS NULL;
CREATE INDEX idx_document_chat_session_user ON document_chat_session (user_id, created_at DESC);

ALTER TABLE document_chat_history ADD COLUMN session_id UUID;

-- Existing questions become one closed single-question session each (session id = entry id).
INSERT INTO document_chat_session (id, user_id, closed_at, created_at, updated_at)
SELECT id, user_id, created_at, created_at, created_at FROM document_chat_history;

UPDATE document_chat_history SET session_id = id;

ALTER TABLE document_chat_history
    ALTER COLUMN session_id SET NOT NULL,
    ADD CONSTRAINT fk_document_chat_history_session
        FOREIGN KEY (session_id) REFERENCES document_chat_session (id) ON DELETE CASCADE;

CREATE INDEX idx_document_chat_history_session ON document_chat_history (session_id, created_at);
CREATE INDEX idx_document_chat_history_created ON document_chat_history (created_at);
