CREATE TABLE transport_legs (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id             UUID         NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    type                VARCHAR(20)  NOT NULL DEFAULT 'OTHER',
    from_location       VARCHAR(255) NOT NULL,
    to_location         VARCHAR(255) NOT NULL,
    departure_at        TIMESTAMPTZ  NOT NULL,
    arrival_at          TIMESTAMPTZ  NOT NULL,
    carrier             VARCHAR(255),
    booking_reference   VARCHAR(100),
    seat                VARCHAR(50),
    notes               TEXT,
    position            INT          NOT NULL DEFAULT 0,
    -- Flight tracking (only populated for FLIGHT type)
    flight_number       VARCHAR(20),
    flight_status       VARCHAR(50),
    actual_departure_at TIMESTAMPTZ,
    actual_arrival_at   TIMESTAMPTZ,
    departure_gate      VARCHAR(20),
    departure_terminal  VARCHAR(20),
    arrival_gate        VARCHAR(20),
    arrival_terminal    VARCHAR(20),
    delay_minutes       INT,
    status_checked_at   TIMESTAMPTZ
);

CREATE INDEX idx_transport_legs_trip ON transport_legs(trip_id);
CREATE INDEX idx_transport_legs_departure ON transport_legs(trip_id, departure_at);
