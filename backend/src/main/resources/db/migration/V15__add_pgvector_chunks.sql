CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID         NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index   INTEGER      NOT NULL,
    chunk_text    TEXT         NOT NULL,
    embedding     vector(768),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);
