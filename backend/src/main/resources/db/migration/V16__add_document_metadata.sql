ALTER TABLE documents
    ADD COLUMN category    VARCHAR(255),
    ADD COLUMN subcategory VARCHAR(255),
    ADD COLUMN year        INTEGER;

CREATE INDEX idx_documents_category ON documents(category);
