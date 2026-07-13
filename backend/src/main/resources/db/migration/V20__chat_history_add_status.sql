ALTER TABLE document_chat_history ADD COLUMN status TEXT NOT NULL DEFAULT 'DONE';
ALTER TABLE document_chat_history ALTER COLUMN answer SET DEFAULT '';
