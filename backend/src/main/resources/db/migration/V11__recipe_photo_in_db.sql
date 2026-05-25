ALTER TABLE recipes
    ADD COLUMN IF NOT EXISTS photo_data        BYTEA,
    ADD COLUMN IF NOT EXISTS photo_content_type VARCHAR(100);
