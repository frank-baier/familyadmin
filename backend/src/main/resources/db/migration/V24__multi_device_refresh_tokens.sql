-- Replace single refresh_jti column with a proper refresh_tokens table.
-- This allows the same user to be logged in on multiple devices simultaneously.

CREATE TABLE refresh_tokens (
    id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti        TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_refresh_tokens_jti ON refresh_tokens(jti);

-- Migrate existing active tokens (grant 7-day expiry from now)
INSERT INTO refresh_tokens (user_id, jti, expires_at)
SELECT id, refresh_jti, NOW() + INTERVAL '7 days'
FROM users
WHERE refresh_jti IS NOT NULL;

ALTER TABLE users DROP COLUMN refresh_jti;
