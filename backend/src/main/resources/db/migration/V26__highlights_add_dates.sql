ALTER TABLE trip_location_highlights
    ADD COLUMN IF NOT EXISTS check_in  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS check_out VARCHAR(20);
