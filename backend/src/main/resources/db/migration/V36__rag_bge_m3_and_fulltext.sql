-- Switch document embeddings from nomic-embed-text (768 dims, English-centric)
-- to bge-m3 (1024 dims, multilingual). Existing vectors are incompatible and are
-- cleared; EmbeddingBackfillScheduler re-embeds them from chunk_text (no re-OCR).
DROP INDEX IF EXISTS idx_document_chunks_embedding;

ALTER TABLE document_chunks
    ALTER COLUMN embedding TYPE vector(1024) USING NULL::vector(1024);

CREATE INDEX idx_document_chunks_embedding
    ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- German full-text search for exact terms (invoice numbers, names, amounts),
-- combined with vector search in RAGService (hybrid retrieval).
ALTER TABLE document_chunks
    ADD COLUMN search_tsv tsvector
        GENERATED ALWAYS AS (to_tsvector('german', chunk_text)) STORED;

CREATE INDEX idx_document_chunks_search_tsv
    ON document_chunks USING gin (search_tsv);
