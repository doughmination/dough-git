/* src/lib/server/tokens.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { randomBytes, createHash } from "node:crypto";
import { db, now } from "./db.ts";
import { slugForSub } from "./users.ts";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface TokenRow {
  id: string;
  label: string;
  owner: string | null;
  created_by: string | null;
  created_at: number;
  last_used: number | null;
}

const COLUMNS = "id, label, owner, created_by, created_at, last_used";

export async function listTokens(owner: string): Promise<TokenRow[]> {
  const { results } = await db()
    .prepare(`SELECT ${COLUMNS} FROM tokens WHERE owner = ? ORDER BY created_at DESC`)
    .bind(owner)
    .all<TokenRow>();
  return results;
}

export async function createToken(
  label: string,
  owner: string,
  createdBy: string | null,
): Promise<string> {
  const id = randomBytes(6).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  const plaintext = `dgt_${id}_${secret}`;
  await db()
    .prepare(
      `INSERT INTO tokens (id, label, hash, owner, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      label.trim() || "token",
      sha256(plaintext),
      owner,
      createdBy,
      now(),
    )
    .run();
  return plaintext;
}

export async function revokeToken(id: string, owner: string): Promise<boolean> {
  const row = await db()
    .prepare("SELECT owner FROM tokens WHERE id = ?")
    .bind(id)
    .first<{ owner: string | null }>();
  if (!row || row.owner !== owner) return false;
  await db().prepare("DELETE FROM tokens WHERE id = ?").bind(id).run();
  return true;
}

export async function verifyDbToken(plaintext: string): Promise<{ owner: string | null } | null> {
  const row = await db()
    .prepare("SELECT id, owner, created_by FROM tokens WHERE hash = ?")
    .bind(sha256(plaintext))
    .first<{ id: string; owner: string | null; created_by: string | null }>();
  if (!row) return null;

  let owner = row.owner;
  if (!owner) {
    owner = await slugForSub(row.created_by);
    if (owner) {
      await db().prepare("UPDATE tokens SET owner = ? WHERE id = ?").bind(owner, row.id).run();
    }
  }

  await db().prepare("UPDATE tokens SET last_used = ? WHERE id = ?").bind(now(), row.id).run();
  return { owner };
}
