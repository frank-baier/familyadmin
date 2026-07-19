-- Rename name → label (aligns with frontend interface)
ALTER TABLE packing_items RENAME COLUMN name TO label;

-- Category grouping
ALTER TABLE packing_items ADD COLUMN category VARCHAR(100);

-- Track who added the item (shared items have no owner, so we need a separate field)
ALTER TABLE packing_items ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Creation timestamp
ALTER TABLE packing_items ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX idx_packing_items_trip_category ON packing_items(trip_id, category, position);
