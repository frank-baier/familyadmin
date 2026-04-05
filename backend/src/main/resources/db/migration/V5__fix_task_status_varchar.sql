-- Hibernate 6 does not auto-cast to custom PostgreSQL enum types.
-- Convert task_status column to VARCHAR so Hibernate can insert without casting.
ALTER TABLE tasks ALTER COLUMN status TYPE VARCHAR(20) USING status::TEXT;
DROP TYPE task_status CASCADE;
