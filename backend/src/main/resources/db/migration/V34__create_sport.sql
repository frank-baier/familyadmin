-- Sport module: activities imported from Strava (bulk export now, API later), scoped per user.
CREATE TABLE sport_activities (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source            VARCHAR(20)  NOT NULL DEFAULT 'STRAVA',
    external_id       VARCHAR(64)  NOT NULL,
    name              VARCHAR(500),
    sport_type        VARCHAR(100) NOT NULL,
    start_time        TIMESTAMPTZ  NOT NULL,
    elapsed_seconds   INTEGER,
    moving_seconds    INTEGER,
    distance_m        DOUBLE PRECISION,
    elevation_gain_m  DOUBLE PRECISION,
    avg_heart_rate    DOUBLE PRECISION,
    max_heart_rate    DOUBLE PRECISION,
    avg_speed_mps     DOUBLE PRECISION,
    max_speed_mps     DOUBLE PRECISION,
    avg_watts         DOUBLE PRECISION,
    calories          DOUBLE PRECISION,
    relative_effort   DOUBLE PRECISION,
    commute           BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, source, external_id)
);

CREATE INDEX idx_sport_activities_user_start ON sport_activities(user_id, start_time);

-- Per-user physiology used for fitness calculations (all optional; estimated from data when NULL).
CREATE TABLE sport_profiles (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    max_heart_rate      INTEGER,
    resting_heart_rate  INTEGER,
    birth_year          INTEGER,
    sex                 VARCHAR(10),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
