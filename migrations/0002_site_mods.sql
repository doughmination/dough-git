-- migrations/0002_site_mods.sql
-- LICENCED DASL-1.0 (c) Clove Twilight

-- Site moderators, keyed by namespace slug. The site owner comes from MINIGIT_SITE_OWNER, not this table
CREATE TABLE IF NOT EXISTS site_mods (
  slug     TEXT PRIMARY KEY,
  added_at INTEGER NOT NULL
);
