/* src/lib/server/access.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { db, now } from "./db.ts";
import type { RepoRef } from "./gitref.ts";

export type Level = "read" | "write";

export type Access = "none" | "read" | "write";

export function isLevel(value: string): value is Level {
  return value === "read" || value === "write";
}

export interface CollaboratorRow {
  slug: string;
  level: Level;
  added_at: number;
}

export async function listCollaborators(ref: RepoRef): Promise<CollaboratorRow[]> {
  const { results } = await db()
    .prepare(
      `SELECT slug, level, added_at
       FROM collaborators
       WHERE owner = ? AND repo = ?
       ORDER BY slug`,
    )
    .bind(ref.owner, ref.name)
    .all<CollaboratorRow>();
  return results;
}

export async function setCollaborator(
  ref: RepoRef,
  slug: string,
  level: Level,
): Promise<boolean> {
  if (!slug || slug === ref.owner) return false;
  await db()
    .prepare(
      `INSERT INTO collaborators (owner, repo, slug, level, added_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (owner, repo, slug) DO UPDATE SET level = excluded.level`,
    )
    .bind(
      ref.owner,
      ref.name,
      slug,
      level,
      now(),
    )
    .run();
  return true;
}

export async function removeCollaborator(ref: RepoRef, slug: string): Promise<boolean> {
  const result = await db()
    .prepare("DELETE FROM collaborators WHERE owner = ? AND repo = ? AND slug = ?")
    .bind(ref.owner, ref.name, slug)
    .run();
  return result.meta.changes > 0;
}

export async function dropRepoAccess(ref: RepoRef): Promise<void> {
  await db()
    .prepare("DELETE FROM collaborators WHERE owner = ? AND repo = ?")
    .bind(ref.owner, ref.name)
    .run();
}

export async function collaboratorLevel(ref: RepoRef, slug: string): Promise<Level | null> {
  const row = await db()
    .prepare("SELECT level FROM collaborators WHERE owner = ? AND repo = ? AND slug = ?")
    .bind(ref.owner, ref.name, slug)
    .first<{ level: string }>();
  if (!row || !isLevel(row.level)) return null;
  return row.level;
}

export interface SharedRepo {
  owner: string;
  name: string;
  level: Level;
}

export async function sharedWith(slug: string): Promise<SharedRepo[]> {
  const { results: rows } = await db()
    .prepare(
      `SELECT owner, repo AS name, level
       FROM collaborators
       WHERE slug = ?`,
    )
    .bind(slug)
    .all<{ owner: string; name: string; level: string }>();
  return rows
    .filter((row) => isLevel(row.level))
    .map((row) => ({
      owner: row.owner,
      name: row.name,
      level: row.level as Level,
    }));
}

export interface AccessQuery {
  ref: RepoRef;
  isPublic: boolean;
  viewer: string | null;
}

export async function accessFor(query: AccessQuery): Promise<Access> {
  const { ref, isPublic, viewer } = query;

  if (viewer) {
    if (viewer === ref.owner) return "write";
    const invited = await collaboratorLevel(ref, viewer);
    if (invited === "write") return "write";
    if (invited === "read") return "read";
  }

  return isPublic ? "read" : "none";
}

export async function canRead(query: AccessQuery): Promise<boolean> {
  return (await accessFor(query)) !== "none";
}

export async function canWrite(query: AccessQuery): Promise<boolean> {
  return (await accessFor(query)) === "write";
}
