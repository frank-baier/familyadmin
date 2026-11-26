-- Which model answered a document-chat question, what it cost and how long it took.
ALTER TABLE document_chat_history
    ADD COLUMN model       VARCHAR(100),
    ADD COLUMN cost_usd    NUMERIC(12, 6),
    ADD COLUMN duration_ms BIGINT;
