ALTER TABLE recipes
    ADD COLUMN source VARCHAR(255),
    ADD COLUMN source_url VARCHAR(512),
    ADD COLUMN total_minutes INT,
    ADD COLUMN rating SMALLINT,
    ADD COLUMN difficulty VARCHAR(50),
    ADD COLUMN notes TEXT,
    ADD COLUMN nutritional_info TEXT,
    ADD COLUMN categories TEXT;
