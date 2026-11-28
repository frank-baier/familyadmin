-- Scan-Eingang → Dokumentenarchiv: what Claude read while filing a document is kept,
-- and an approved file goes straight into the archive (searchable, also tax folders).
ALTER TABLE scan_inbox_items ADD COLUMN suggestion_summary TEXT;
ALTER TABLE scan_inbox_items ADD COLUMN document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- Short AI description of a document (issuer, date, amount, numbers); indexed as an
-- extra chunk so search and chat find it even for image-only scans.
ALTER TABLE documents ADD COLUMN ai_summary TEXT;
