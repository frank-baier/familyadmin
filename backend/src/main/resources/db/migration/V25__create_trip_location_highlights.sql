CREATE TABLE trip_location_highlights (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id      UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    location     VARCHAR(500) NOT NULL,
    highlights   TEXT        NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (trip_id, location)
);
