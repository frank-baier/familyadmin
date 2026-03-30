CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT,
    cover_photo_url VARCHAR(512),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE packing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = shared
    name VARCHAR(255) NOT NULL,
    packed BOOLEAN NOT NULL DEFAULT false,
    position INT NOT NULL DEFAULT 0
);

CREATE TABLE itinerary_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    entry_time TIME,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    position INT NOT NULL DEFAULT 0
);

CREATE TABLE trip_key_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    position INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_trips_start_date ON trips(start_date);
CREATE INDEX idx_packing_items_trip ON packing_items(trip_id);
CREATE INDEX idx_itinerary_trip_date ON itinerary_entries(trip_id, entry_date);
