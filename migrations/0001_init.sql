-- migrations/0001_init.sql
-- LICENCED DASL-1.0 (c) Clove Twilight

CREATE TABLE IF NOT EXISTS users (
  sub        TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  username   TEXT,
  name       TEXT,
  picture    TEXT,
  created_at INTEGER NOT NULL,
  last_login INTEGER NOT NULL,
  -- NULL marks accounts made by the previous provider (PocketID)
  issuer     TEXT
);

CREATE TABLE IF NOT EXISTS tokens (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  hash       TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  last_used  INTEGER,
  owner      TEXT
);
CREATE INDEX IF NOT EXISTS tokens_hash ON tokens (hash);

-- Browser sessions, so they can be ended server-side when the SSO stops vouching
CREATE TABLE IF NOT EXISTS sessions (
  id_hash       TEXT PRIMARY KEY,
  sub           TEXT NOT NULL,
  email         TEXT,
  refresh_token TEXT,
  id_token      TEXT,
  created_at    INTEGER NOT NULL,
  verified_at   INTEGER NOT NULL,
  checked_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_sub ON sessions (sub);

CREATE TABLE IF NOT EXISTS collaborators (
  owner    TEXT NOT NULL,
  repo     TEXT NOT NULL,
  slug     TEXT NOT NULL,
  level    TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (owner, repo, slug)
);
CREATE INDEX IF NOT EXISTS collaborators_slug ON collaborators (slug);

CREATE TABLE IF NOT EXISTS user_settings (
  owner            TEXT PRIMARY KEY,
  discord_webhook  TEXT,
  discord_private  INTEGER NOT NULL DEFAULT 0,
  default_private  INTEGER NOT NULL DEFAULT 1,
  mirror_auto      INTEGER NOT NULL DEFAULT 1,
  webhook_error    TEXT,
  webhook_error_at INTEGER,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mirror_status (
  owner      TEXT NOT NULL,
  repo       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  error      TEXT,
  ok_at      INTEGER,
  state      TEXT,
  local_sha  TEXT,
  remote_sha TEXT,
  detail     TEXT,
  PRIMARY KEY (owner, repo, kind)
);
