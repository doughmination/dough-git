/* src/lib/server/users.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { db, now } from "./db.ts";
import { ownerSlug } from "./gitref.ts";

export interface UserRow {
  sub: string;
  slug: string;
  username: string | null;
  name: string | null;
  picture: string | null;
  issuer: string | null;
  created_at: number;
  last_login: number;
}

export function findUserBySlug(slug: string): Promise<UserRow | null> {
  return db().prepare("SELECT * FROM users WHERE slug = ?").bind(slug).first<UserRow>();
}

export function findUserBySub(sub: string): Promise<UserRow | null> {
  return db().prepare("SELECT * FROM users WHERE sub = ?").bind(sub).first<UserRow>();
}

async function uniqueSlug(preferred: string, sub: string): Promise<string> {
  const taken = async (slug: string) => {
    const row = await findUserBySlug(slug);
    return row !== null && row.sub !== sub;
  };
  if (!(await taken(preferred))) return preferred;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${preferred}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${preferred}-${sub.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
}

export interface RememberInput {
  sub: string;
  username: string | null;
  name: string | null;
  picture: string | null;
  /** The OIDC issuer that vouched for `sub`. */
  issuer?: string | null;
  /**
   * Let a first sign-in take over the pre-migration account whose namespace
   * matches this username. See adoptLegacyUser.
   */
  adoptLegacy?: boolean;
}

/**
 * Moving identity providers changes every `sub`, but namespaces, tokens and
 * collaborator grants all hang off the slug. So when someone signs in from the
 * new provider for the first time, an account left over from the old one
 * (issuer IS NULL) with the same namespace is re-pointed at their new `sub`
 * rather than a fresh "name-2" namespace being made.
 *
 * Usernames on the new provider are issued by its admins, which is what makes
 * matching on them acceptable. Each old account can only be adopted once.
 */
async function adoptLegacyUser(input: RememberInput): Promise<UserRow | null> {
  if (!input.username || !input.issuer) return null;
  const slug = ownerSlug(input.username);
  const legacy = await db()
    .prepare("SELECT * FROM users WHERE slug = ? AND issuer IS NULL")
    .bind(slug)
    .first<UserRow>();
  if (!legacy) return null;

  // A batch is one transaction: both move, or neither does
  await db().batch([
    db()
      .prepare("UPDATE users SET sub = ?, issuer = ? WHERE sub = ?")
      .bind(
        input.sub,
        input.issuer,
        legacy.sub,
      ),
    db()
      .prepare("UPDATE tokens SET created_by = ? WHERE created_by = ?")
      .bind(input.sub, legacy.sub),
  ]);

  console.warn(
    `[auth] adopted pre-migration account "${slug}" for ${input.issuer} subject ${input.sub}`,
  );
  return { ...legacy, sub: input.sub, issuer: input.issuer };
}

export async function rememberUser(input: RememberInput): Promise<UserRow> {
  const existing =
    (await findUserBySub(input.sub)) ?? (input.adoptLegacy ? await adoptLegacyUser(input) : null);
  const ts = now();
  const issuer = input.issuer ?? null;
  const profile = {
    sub: input.sub,
    username: input.username,
    name: input.name,
    picture: input.picture,
  };

  if (existing) {
    await db()
      .prepare(
        `UPDATE users SET username = ?, name = ?, picture = ?, last_login = ?,
           issuer = COALESCE(?, issuer)
         WHERE sub = ?`,
      )
      .bind(
        input.username,
        input.name,
        input.picture,
        ts,
        issuer,
        input.sub,
      )
      .run();
    return { ...existing, ...profile, issuer: issuer ?? existing.issuer, last_login: ts };
  }

  const slug = await uniqueSlug(
    ownerSlug(input.username ?? input.name ?? "user"),
    input.sub,
  );
  await db()
    .prepare(
      `INSERT INTO users (sub, slug, username, name, picture, issuer, created_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.sub,
      slug,
      input.username,
      input.name,
      input.picture,
      issuer,
      ts,
      ts,
    )
    .run();
  return { ...profile, slug, issuer, created_at: ts, last_login: ts };
}

export async function slugForSub(sub: string | null): Promise<string | null> {
  if (!sub) return null;
  return (await findUserBySub(sub))?.slug ?? null;
}
