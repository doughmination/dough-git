-- migrations/0003_avatars_mod_log.sql
-- LICENCED DASL-1.0 (c) Clove Twilight

-- Set when the user uploaded their own avatar; sign-ins then stop copying the SSO picture over it
ALTER TABLE users ADD COLUMN avatar_at INTEGER;

CREATE TABLE IF NOT EXISTS mod_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  actor  TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  at     INTEGER NOT NULL
);
