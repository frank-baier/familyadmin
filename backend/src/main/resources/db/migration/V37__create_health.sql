-- Apple Health daily metrics, pushed from an iOS Shortcuts automation. Strictly per user.
CREATE TABLE health_daily_metrics (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_date  DATE NOT NULL,
    metric       VARCHAR(40) NOT NULL,
    value        DOUBLE PRECISION NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, metric_date, metric)
);

CREATE INDEX idx_health_daily_user_date ON health_daily_metrics(user_id, metric_date);

-- One long-lived sync token per user (only the SHA-256 hash is stored).
CREATE TABLE health_sync_tokens (
    user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token_hash    VARCHAR(64) NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ
);
