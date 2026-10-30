/* src/lib/server/sessions.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { createHash, randomBytes } from "node:crypto";
import { db, now } from "./db.ts";

// Browser sessions live in D1 rather than in a signed cookie so they can be
// ended from the server side: on logout, and when the SSO stops vouching for
// the account (disabled, removed from the app's allowed groups, signed out
// everywhere).

/** Hard cap on a session, however often it is refreshed. */
export const SESSION_TTL = 60 * 60 * 24 * 30;
/** How stale the SSO's last word on a session may get before asking again. */
export const RECHECK_AFTER = 60 * 10;
/** How long to keep people signed in while the SSO can't be reached. */
export const OUTAGE_GRACE = 60 * 60;
/** Minimum gap between retries while the SSO is unreachable. */
const RETRY_AFTER = 60;
/** Sessions without a refresh token can't be re-checked, so they end sooner. */
export const UNCHECKED_TTL = 60 * 60 * 24;

export interface SessionRow {
  id_hash: string;
  sub: string;
  email: string | null;
  refresh_token: string | null;
  id_token: string | null;
  created_at: number;
  verified_at: number;
  checked_at: number;
  expires_at: number;
}

function hashId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface NewSession {
  sub: string;
  email: string | null;
  refreshToken: string | null;
  idToken: string | null;
}

/** Returns the cookie value. Only its hash is stored. */
export async function createSession(input: NewSession): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const ts = now();
  await db()
    .prepare(
      `INSERT INTO sessions (id_hash, sub, email, refresh_token, id_token, created_at, verified_at, checked_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      hashId(token),
      input.sub,
      input.email,
      input.refreshToken,
      input.idToken,
      ts,
      ts,
      ts,
      ts + (input.refreshToken ? SESSION_TTL : UNCHECKED_TTL),
    )
    .run();
  return token;
}

export async function findSession(token: string | undefined): Promise<SessionRow | null> {
  if (!token) return null;
  const row = await db()
    .prepare("SELECT * FROM sessions WHERE id_hash = ?")
    .bind(hashId(token))
    .first<SessionRow>();
  if (!row) return null;
  if (row.expires_at <= now()) {
    await deleteSessionRow(row.id_hash);
    return null;
  }
  return row;
}

export async function deleteSessionRow(idHash: string): Promise<void> {
  await db().prepare("DELETE FROM sessions WHERE id_hash = ?").bind(idHash).run();
}

export async function purgeExpiredSessions(): Promise<number> {
  const result = await db().prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now()).run();
  return result.meta.changes;
}

export type RefreshOutcome =
  | {
      kind: "ok";
      sub: string | null;
      email: string | null;
      refreshToken: string | null;
      idToken: string | null;
    }
  /** The SSO refused: the session must end. */
  | { kind: "revoked" }
  /** The SSO couldn't be asked (network, outage). */
  | { kind: "unavailable" };

export type Refresher = (refreshToken: string) => Promise<RefreshOutcome>;

/**
 * Makes sure the SSO still vouches for a session, asking at most every
 * RECHECK_AFTER seconds. Refresh tokens rotate on every use and replaying one
 * shuts the whole grant down, so concurrent requests on one session let a
 * single one refresh (claimed in D1) instead of racing with the same token.
 */
export function revalidate(row: SessionRow, refresh: Refresher): Promise<SessionRow | null> {
  const ts = now();
  if (ts - row.verified_at < RECHECK_AFTER) return Promise.resolve(row);

  if (!row.refresh_token) {
    // Nothing to check with; expires_at (UNCHECKED_TTL) bounds these.
    return Promise.resolve(row);
  }

  if (ts - row.checked_at < RETRY_AFTER) {
    // A recent attempt failed to reach the SSO; don't hammer it on every request.
    return ts - row.verified_at > RECHECK_AFTER + OUTAGE_GRACE ? end(row) : Promise.resolve(row);
  }

  return (async (): Promise<SessionRow | null> => {
    // Whoever moves checked_at first spends the refresh token; the rest carry on with the row they have
    const claim = await db()
      .prepare("UPDATE sessions SET checked_at = ? WHERE id_hash = ? AND checked_at = ?")
      .bind(ts, row.id_hash, row.checked_at)
      .run();
    if (claim.meta.changes === 0) return row;

    let outcome: RefreshOutcome;
    try {
      outcome = await refresh(row.refresh_token!);
    } catch {
      outcome = { kind: "unavailable" };
    }
    const at = now();

    if (outcome.kind === "revoked" || (outcome.kind === "ok" && outcome.sub && outcome.sub !== row.sub)) {
      return end(row);
    }

    if (outcome.kind === "unavailable") {
      if (at - row.verified_at > RECHECK_AFTER + OUTAGE_GRACE) return end(row);
      await db().prepare("UPDATE sessions SET checked_at = ? WHERE id_hash = ?").bind(at, row.id_hash).run();
      return { ...row, checked_at: at };
    }

    const updated: SessionRow = {
      ...row,
      email: outcome.email ?? row.email,
      refresh_token: outcome.refreshToken ?? row.refresh_token,
      id_token: outcome.idToken ?? row.id_token,
      verified_at: at,
      checked_at: at,
    };
    await db()
      .prepare(
        `UPDATE sessions SET email = ?, refresh_token = ?, id_token = ?, verified_at = ?, checked_at = ?
         WHERE id_hash = ?`,
      )
      .bind(
        updated.email,
        updated.refresh_token,
        updated.id_token,
        at,
        at,
        row.id_hash,
      )
      .run();
    return updated;
  })();
}

async function end(row: SessionRow): Promise<null> {
  await deleteSessionRow(row.id_hash);
  return null;
}
