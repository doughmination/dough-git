/* src/lib/server/roles.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { SiteRole } from "../index.ts";
import { config } from "./config.ts";
import { db, now } from "./db.ts";
import { ownerSlug } from "./gitref.ts";

export interface ModRow {
  slug: string;
  added_at: number;
}

export interface ModLogRow {
  id: number;
  actor: string;
  action: string;
  target: string;
  at: number;
}

async function logAction(actor: string, action: string, target: string): Promise<void> {
  await db()
    .prepare("INSERT INTO mod_log (actor, action, target, at) VALUES (?, ?, ?, ?)")
    .bind(
      actor,
      action,
      target,
      now(),
    )
    .run();
}

export async function listModLog(limit = 50): Promise<ModLogRow[]> {
  const { results } = await db()
    .prepare("SELECT id, actor, action, target, at FROM mod_log ORDER BY id DESC LIMIT ?")
    .bind(limit)
    .all<ModLogRow>();
  return results;
}

export async function siteRole(slug: string | null): Promise<SiteRole | null> {
  if (!slug) return null;
  if (slug === config.siteOwner) return "owner";

  const row = await db()
    .prepare("SELECT slug FROM site_mods WHERE slug = ?")
    .bind(slug)
    .first<{ slug: string }>();
  return row ? "mod" : null;
}

export async function listMods(): Promise<ModRow[]> {
  const { results } = await db()
    .prepare("SELECT slug, added_at FROM site_mods ORDER BY slug")
    .all<ModRow>();
  return results;
}

/** False when the slug is empty, malformed, or the site owner */
export async function addMod(actor: string, raw: string): Promise<boolean> {
  const slug = raw.trim().toLowerCase();
  if (!slug || slug !== ownerSlug(slug) || slug === config.siteOwner) return false;

  const result = await db()
    .prepare("INSERT INTO site_mods (slug, added_at) VALUES (?, ?) ON CONFLICT (slug) DO NOTHING")
    .bind(slug, now())
    .run();
  if (result.meta.changes > 0) await logAction(actor, "added mod", slug);
  return true;
}

export async function removeMod(actor: string, slug: string): Promise<boolean> {
  const result = await db()
    .prepare("DELETE FROM site_mods WHERE slug = ?")
    .bind(slug)
    .run();
  if (result.meta.changes === 0) return false;

  await logAction(actor, "removed mod", slug);
  return true;
}
