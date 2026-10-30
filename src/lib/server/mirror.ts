/* src/lib/server/mirror.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { db, now } from "./db.ts";
import {
  lsRemote,
  localMirrorRefs,
  hasCommit,
  isAncestor,
  listRefs,
  refSlug,
  shortRef,
  type RepoRef,
  type MirrorLink,
} from "./git.ts";
import type { MirrorKind } from "./urls.ts";

export type MirrorState =
  | "synced"
  | "ahead"
  | "behind"
  | "diverged"
  | "out_of_sync"
  | "denied"
  | "missing";

export interface MirrorStatus {
  kind: string;
  checkedAt: number;
  error: string | null;
  okAt: number | null;
  state: MirrorState | null;
  localSha: string | null;
  remoteSha: string | null;
  detail: string | null;
}

interface Row {
  kind: string;
  checked_at: number;
  error: string | null;
  ok_at: number | null;
  state: string | null;
  local_sha: string | null;
  remote_sha: string | null;
  detail: string | null;
}

function toStatus(row: Row): MirrorStatus {
  return {
    kind: row.kind,
    checkedAt: row.checked_at,
    error: row.error,
    okAt: row.ok_at,
    state: (row.state as MirrorState | null) ?? null,
    localSha: row.local_sha,
    remoteSha: row.remote_sha,
    detail: row.detail,
  };
}

export async function getStatuses(ref: RepoRef): Promise<Map<string, MirrorStatus>> {
  const { results: rows } = await db()
    .prepare(
      `SELECT kind, checked_at, error, ok_at, state, local_sha, remote_sha, detail
       FROM mirror_status WHERE owner = ? AND repo = ?`,
    )
    .bind(ref.owner, ref.name)
    .all<Row>();
  return new Map(rows.map((r) => [r.kind, toStatus(r)]));
}

async function recordSuccess(
  ref: RepoRef,
  kind: MirrorKind,
  result: {
    state: MirrorState;
    localSha: string | null;
    remoteSha: string | null;
    detail: string;
  },
): Promise<void> {
  const ts = now();
  await db().prepare(
    `INSERT INTO mirror_status
       (owner, repo, kind, checked_at, error, ok_at, state, local_sha, remote_sha, detail)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
     ON CONFLICT (owner, repo, kind) DO UPDATE SET
       checked_at = excluded.checked_at,
       error      = NULL,
       ok_at      = excluded.ok_at,
       state      = excluded.state,
       local_sha  = excluded.local_sha,
       remote_sha = excluded.remote_sha,
       detail     = excluded.detail`,
  ).bind(
    ref.owner,
    ref.name,
    kind,
    ts,
    ts,
    result.state,
    result.localSha,
    result.remoteSha,
    result.detail,
  ).run();
}

async function recordFailure(ref: RepoRef, kind: MirrorKind, error: string): Promise<void> {
  const message = error.slice(0, 200);
  await db().prepare(
    `INSERT INTO mirror_status (owner, repo, kind, checked_at, error)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (owner, repo, kind) DO UPDATE SET
       checked_at = excluded.checked_at,
       error      = excluded.error`,
  ).bind(
    ref.owner,
    ref.name,
    kind,
    now(),
    message,
  ).run();
}

export async function dropMirrorStatus(ref: RepoRef): Promise<void> {
  await db()
    .prepare("DELETE FROM mirror_status WHERE owner = ? AND repo = ?")
    .bind(ref.owner, ref.name)
    .run();
}

export async function dropMirrorStatusKind(ref: RepoRef, kind: string): Promise<void> {
  await db()
    .prepare("DELETE FROM mirror_status WHERE owner = ? AND repo = ? AND kind = ?")
    .bind(ref.owner, ref.name, kind)
    .run();
}

export async function markStale(ref: RepoRef): Promise<void> {
  await db()
    .prepare("UPDATE mirror_status SET checked_at = 0 WHERE owner = ? AND repo = ?")
    .bind(ref.owner, ref.name)
    .run();
}

export function parseLsRemote(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab === -1) continue;
    const sha = line.slice(0, tab).trim();
    const name = line.slice(tab + 1).trim();
    if (!/^[0-9a-f]{7,64}$/i.test(sha)) continue;
    if (name.endsWith("^{}")) continue;
    if (!name.startsWith("refs/heads/") && !name.startsWith("refs/tags/")) continue;
    out.set(name, sha);
  }
  return out;
}

export interface Comparison {
  matched: number;
  total: number;
  missingRemote: string[];
  missingLocal: string[];
  differing: string[];
}

export function compareRefs(
  local: Map<string, string>,
  remote: Map<string, string>,
): Comparison {
  const names = new Set([...local.keys(), ...remote.keys()]);
  const cmp: Comparison = {
    matched: 0,
    total: names.size,
    missingRemote: [],
    missingLocal: [],
    differing: [],
  };
  for (const name of names) {
    const a = local.get(name);
    const b = remote.get(name);
    if (a && !b) cmp.missingRemote.push(name);
    else if (!a && b) cmp.missingLocal.push(name);
    else if (a === b) cmp.matched++;
    else cmp.differing.push(name);
  }
  cmp.missingRemote.sort();
  cmp.missingLocal.sort();
  cmp.differing.sort();
  return cmp;
}

export function rollUp(
  cmp: Comparison,
  headVerdict: MirrorState | null,
): MirrorState {
  if (cmp.total === 0) return "synced";
  if (cmp.matched === cmp.total) return "synced";
  if (headVerdict && headVerdict !== "synced") return headVerdict;

  const onlyWeHaveExtra = cmp.missingLocal.length === 0 && cmp.differing.length === 0;
  const onlyTheyHaveExtra = cmp.missingRemote.length === 0 && cmp.differing.length === 0;
  if (onlyWeHaveExtra) return "ahead";
  if (onlyTheyHaveExtra) return "behind";
  return "out_of_sync";
}

export async function ancestryVerdict(
  ref: RepoRef,
  localSha: string | null,
  remoteSha: string | null,
): Promise<MirrorState | null> {
  if (!localSha || !remoteSha) return null;
  if (localSha === remoteSha) return "synced";
  if (!(await hasCommit(ref, remoteSha))) return "out_of_sync";
  if (await isAncestor(ref, remoteSha, localSha)) return "ahead";
  if (await isAncestor(ref, localSha, remoteSha)) return "behind";
  return "diverged";
}

export const FRESH_FOR_SECONDS = 6 * 3600;
const MIN_INTERVAL_SECONDS = 60;

const inFlight = new Set<string>();

function key(ref: RepoRef, kind: string): string {
  return `${refSlug(ref)}/${kind}`;
}

export function needsCheck(status: MirrorStatus | undefined): boolean {
  if (!status) return true;
  if (status.checkedAt === 0) return true;
  if (status.okAt === null) return true;
  return now() - status.okAt > FRESH_FOR_SECONDS;
}

export async function checkMirror(
  ref: RepoRef,
  link: MirrorLink,
): Promise<boolean> {
  if (link.isPrivate) return false;

  const k = key(ref, link.kind);
  if (inFlight.has(k)) return false;

  const existing = (await getStatuses(ref)).get(link.kind);
  if (
    existing &&
    existing.checkedAt > 0 &&
    now() - existing.checkedAt < MIN_INTERVAL_SECONDS
  ) {
    return false;
  }

  inFlight.add(k);
  try {
    const remoteResult = await lsRemote(link.url);
    if (!remoteResult.ok) {
      logIssue(ref, link, remoteResult.kind, remoteResult.message);
      if (remoteResult.kind === "denied" || remoteResult.kind === "missing") {
        await recordSuccess(ref, link.kind, {
          state: remoteResult.kind,
          localSha: null,
          remoteSha: null,
          detail:
            remoteResult.kind === "denied"
              ? "not readable without credentials"
              : "no such repository",
        });
      } else {
        await recordFailure(ref, link.kind, remoteResult.message);
      }
      return true;
    }

    const remote = parseLsRemote(remoteResult.text);
    const local = await localMirrorRefs(ref);
    const cmp = compareRefs(local, remote);

    const head = await defaultBranchRef(ref, local);
    const localHead = head ? (local.get(head) ?? null) : null;
    const remoteHead = head ? (remote.get(head) ?? null) : null;
    const headVerdict = await ancestryVerdict(ref, localHead, remoteHead);
    const state = rollUp(cmp, headVerdict);

    for (const reason of mismatchReasons(cmp, local, remote)) {
      logIssue(ref, link, state, reason);
    }

    await recordSuccess(ref, link.kind, {
      state,
      localSha: localHead,
      remoteSha: remoteHead,
      detail: describeMismatch(cmp),
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "check failed";
    logIssue(ref, link, "error", message);
    await recordFailure(ref, link.kind, message);
    return true;
  } finally {
    inFlight.delete(k);
  }
}

const ISSUE_LABELS: Record<string, string> = {
  ahead: "mirror behind",
  behind: "local behind",
  diverged: "diverged",
  out_of_sync: "out of sync",
  denied: "private or missing",
  missing: "repository missing",
  error: "check failed",
};

function logIssue(
  ref: RepoRef,
  link: MirrorLink,
  state: string,
  reason: string,
): void {
  const label = ISSUE_LABELS[state] ?? state;
  console.warn(`[mirror] ${refSlug(ref)} -> ${link.kind} ${label}: ${reason} (${link.url})`);
}

export function mismatchReasons(
  cmp: Comparison,
  local: Map<string, string>,
  remote: Map<string, string>,
): string[] {
  const sha = (s: string | undefined) => (s ?? "?").slice(0, 7);
  return [
    ...cmp.differing.map(
      (n) => `${shortRef(n)} differs (local ${sha(local.get(n))}, mirror ${sha(remote.get(n))})`,
    ),
    ...cmp.missingRemote.map((n) => `${shortRef(n)} not on mirror (local ${sha(local.get(n))})`),
    ...cmp.missingLocal.map((n) => `${shortRef(n)} only on mirror (${sha(remote.get(n))})`),
  ];
}

export function describeMismatch(cmp: Comparison): string {
  const base = `${cmp.matched}/${cmp.total} refs`;
  const parts = [
    ...cmp.differing.map((n) => `${shortRef(n)} differs`),
    ...cmp.missingRemote.map((n) => `${shortRef(n)} not on mirror`),
    ...cmp.missingLocal.map((n) => `${shortRef(n)} only on mirror`),
  ];
  if (parts.length === 0) return base;
  const shown = parts.slice(0, 2).join(", ");
  const more = parts.length > 2 ? ` +${parts.length - 2} more` : "";
  return `${base} (${shown}${more})`;
}

async function defaultBranchRef(
  ref: RepoRef,
  local: Map<string, string>,
): Promise<string | null> {
  try {
    const refs = await listRefs(ref);
    const head = `refs/heads/${refs.head}`;
    if (local.has(head)) return head;
  } catch {
  }
  for (const name of local.keys()) {
    if (name.startsWith("refs/heads/")) return name;
  }
  return null;
}

export async function checkAllMirrors(
  ref: RepoRef,
  links: MirrorLink[],
): Promise<void> {
  for (const link of links) {
    await checkMirror(ref, link);
  }
}
