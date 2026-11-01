-- Unguessable token for public, unauthenticated recipe share links (NULL = not shared)
ALTER TABLE recipes ADD COLUMN share_token VARCHAR(64) UNIQUE;
