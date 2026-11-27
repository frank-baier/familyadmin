-- Documents without extractable text (scans OCR can't read) were re-processed every hour.
-- Remember the last failed attempt so the scheduler retries them only weekly.
ALTER TABLE documents ADD COLUMN last_index_attempt_at TIMESTAMPTZ;
