-- Ensure frank@baier.de exists with ADMIN role.
-- If the user doesn't exist yet, this INSERT creates them with a placeholder
-- password that must be changed on first login via the admin UI.
-- BCrypt hash of 'ChangeMe123!' (cost 10)
INSERT INTO users (email, name, password, role)
VALUES (
    'frank@baier.de',
    'Frank Baier',
    '$2b$10$oF88i7FgD9suLQOEP2UIpu0qz71MrtC0owVIHNx7Qxswg4.BNgJI.',
    'ADMIN'
)
ON CONFLICT (email) DO UPDATE
    SET role = 'ADMIN';
