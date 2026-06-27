ALTER TABLE trips
    ADD COLUMN email_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX idx_trips_email_token ON trips(email_token);

CREATE TABLE documents (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    filename      VARCHAR(255) NOT NULL,
    content_type  VARCHAR(127) NOT NULL,
    file_size     BIGINT       NOT NULL,
    data          BYTEA        NOT NULL,
    uploaded_by   UUID         NOT NULL REFERENCES users(id),
    source        VARCHAR(20)  NOT NULL DEFAULT 'UPLOAD',
    email_subject VARCHAR(512),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE trip_documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE (trip_id, document_id)
);

CREATE INDEX idx_trip_documents_trip ON trip_documents(trip_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
