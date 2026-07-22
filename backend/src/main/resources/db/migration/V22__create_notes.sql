CREATE TABLE note_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_note_category_owner_name UNIQUE (owner_id, name)
);

CREATE TABLE note_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES note_categories(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES note_nodes(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    content TEXT,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_note_categories_owner ON note_categories(owner_id);
CREATE INDEX idx_note_nodes_owner ON note_nodes(owner_id);
CREATE INDEX idx_note_nodes_category ON note_nodes(category_id);
CREATE INDEX idx_note_nodes_parent ON note_nodes(parent_id);
