/* src/lib/server/gitref.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Repository names, shapes and parsers shared by the Worker and the git container

import { isMirrorKind, mirrorUrl, MIRROR_KINDS, type MirrorKind } from "./urls.ts";

export interface RepoRef {
  owner: string;
  name: string;
}

const SEGMENT = /^[A-Za-z0-9._-]+$/;

export function safeSegment(s: string): boolean {
  return SEGMENT.test(s) && !s.startsWith(".") && !s.includes("..");
}

export const PROFILE_REPO = "+dough";

export const PROFILE_REPOS_PATH = "+repos";

const NAME_SEGMENT = /^[A-Za-z0-9._+-]+$/;

export function safeName(s: string): boolean {
  if (!NAME_SEGMENT.test(s) || s.startsWith(".") || s.includes("..")) return false;
  if (s.startsWith("+")) return s === PROFILE_REPO;
  return !s.includes("+");
}

export function isProfileRepo(name: string): boolean {
  return name === PROFILE_REPO;
}

const OBJECT_ID = /^[0-9a-fA-F]{4,64}$/;

export function safeObjectId(sha: string): string | null {
  return OBJECT_ID.test(sha) ? sha : null;
}

export function safeRef(owner: string, nameRaw: string): RepoRef | null {
  const name = nameRaw.replace(/\.git$/, "");
  if (!safeSegment(owner) || !safeName(name)) return null;
  return { owner, name };
}

export function refSlug(ref: RepoRef): string {
  return `${ref.owner}/${ref.name}`;
}

export function ownerSlug(raw: string): string {
  const slug = raw.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "user";
}

export interface CreateResult {
  ok: boolean;
  ref?: RepoRef;
  error?: string;
  reserved?: boolean;
}

export const DELETED_META = "dough-deleted.json";

export interface DeletedGrant {
  slug: string;
  level: string;
}

export interface DeletedMeta {
  version: 1;
  owner: string;
  name: string;
  deletedAt: number;
  deletedBy: string;
  grants: DeletedGrant[];
}

export interface TrashEntry {
  entry: string;
  owner: string;
  name: string;
  deletedAt: number;
  deletedBy: string;
  grants: DeletedGrant[];
  degraded: boolean;
}

export interface RestoreResult {
  ok: boolean;
  error?: string;
  meta?: TrashEntry;
}

export interface RepoSummary {
  owner: string;
  name: string;
  description: string;
  head: string;
  lastCommit: number | null;
  isPublic: boolean;
}

export type RemoteFailure = "denied" | "missing" | "error";

export type LsRemoteResult =
  | { ok: true; text: string }
  | { ok: false; kind: RemoteFailure; message: string };

export function classifyRemoteError(stderr: string, timedOut: boolean): {
  kind: RemoteFailure;
  message: string;
} {
  if (timedOut) return { kind: "error", message: "timed out" };

  const text = stderr.trim();
  const first =
    text
      .split("\n")
      .map((l) => l.replace(/^(?:fatal|error|warning|remote):\s*/i, "").trim())
      .filter((l) => l.length > 0)
      .pop() ?? "unknown error";
  const short = first.slice(0, 160);

  if (/terminal prompts disabled|could not read Username|Authentication failed|403/i.test(text)) {
    return { kind: "denied", message: short };
  }
  if (/repository not found|not found|404/i.test(text)) {
    return { kind: "missing", message: short };
  }
  return { kind: "error", message: short };
}

// Any public https forge, but never a host on this machine or a raw IP
const IMPORT_URL = /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}\/[A-Za-z0-9._~\/-]+$/;

export function importUrl(raw: string): string | null {
  const value = raw.trim().replace(/\/+$/, "");
  if (value.length > 400 || !IMPORT_URL.test(value) || value.includes("..")) return null;
  return value;
}

// "https://codeberg.org/someone/thing.git" -> "thing"
export function nameFromUrl(url: string): string {
  return (url.split("/").pop() ?? "").replace(/\.git$/, "");
}

export const LINKS_FILE = "dough-links";

export const MAX_LINKS_BYTES = 2048;
const MAX_LINK_LINES = 16;

export interface MirrorLink {
  kind: MirrorKind;
  url: string;
  isPrivate: boolean;
}

export function parseLinks(text: string): MirrorLink[] {
  const out: MirrorLink[] = [];
  const seen = new Set<string>();

  for (const raw of text.split("\n").slice(0, MAX_LINK_LINES)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split(/\s+/);
    const kind = (parts[0] ?? "").toLowerCase();
    const url = parts[1] ?? "";
    if (!isMirrorKind(kind)) continue;
    if (seen.has(kind)) continue;

    const valid = mirrorUrl(kind, url);
    if (!valid) continue;

    seen.add(kind);
    out.push({
      kind,
      url: valid,
      isPrivate: parts.slice(2).includes("private"),
    });
  }

  out.sort((a, b) => MIRROR_KINDS.indexOf(a.kind) - MIRROR_KINDS.indexOf(b.kind));
  return out;
}

export function serialiseLinks(links: MirrorLink[]): string {
  return links
    .map((l) => `${l.kind} ${l.url}${l.isPrivate ? " private" : ""}`)
    .join("\n");
}

// "refs/heads/main" -> "main", "refs/tags/v1" -> "tag v1"
export function shortRef(name: string): string {
  return name.replace(/^refs\/heads\//, "").replace(/^refs\/tags\//, "tag ");
}

export interface RefList {
  branches: string[];
  tags: string[];
  head: string;
}

export interface Commit {
  hash: string;
  author: string;
  email: string;
  time: number;
  subject: string;
}

export interface TreeEntry {
  mode: string;
  type: "blob" | "tree" | "commit";
  hash: string;
  size: string;
  name: string;
}

export interface Blob {
  text: string;
  binary: boolean;
  truncated: boolean;
  bytes: number;
}

export interface Readme {
  path: string;
  text: string;
}

export interface CommitDetail extends Commit {
  body: string;
  diff: string;
  diffTruncated: boolean;
}
