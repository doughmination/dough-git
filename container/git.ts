/* container/git.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readdir,
  readFile,
  access,
  writeFile,
  unlink,
  mkdir,
  rm,
  rename,
} from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { config } from "./config.ts";
import {
  DELETED_META,
  LINKS_FILE,
  MAX_LINKS_BYTES,
  classifyRemoteError,
  importUrl,
  nameFromUrl,
  parseLinks,
  safeName,
  safeObjectId,
  safeRef,
  safeSegment,
  serialiseLinks,
  type Blob,
  type Commit,
  type CommitDetail,
  type CreateResult,
  type DeletedMeta,
  type LsRemoteResult,
  type MirrorLink,
  type Readme,
  type RefList,
  type RepoRef,
  type RepoSummary,
  type RestoreResult,
  type TrashEntry,
  type TreeEntry,
} from "../src/lib/server/gitref.ts";

// Tests import the shared helpers from here alongside the disk ones
export * from "../src/lib/server/gitref.ts";

const exec = promisify(execFile);

const NUL = "\x00";
const REC = "\x1e";

const FNUL = "%x00";
const FREC = "%x1e";

async function git(repoDir: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", ["-C", repoDir, ...args], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: "utf8",
  });
  return stdout;
}

export function refDir(ref: RepoRef): string {
  return join(config.reposRoot, ref.owner, `${ref.name}.git`);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function repoExists(ref: RepoRef): Promise<boolean> {
  return pathExists(join(refDir(ref), "HEAD"));
}

export async function initBareRepo(ref: RepoRef): Promise<void> {
  const dir = refDir(ref);
  await mkdir(dir, { recursive: true });
  await exec("git", ["init", "--bare", "--initial-branch=main", dir], {
    encoding: "utf8",
  });
}

async function claimName(owner: string, nameRaw: string): Promise<CreateResult> {
  const ref = safeRef(owner, nameRaw);
  if (!ref) {
    return { ok: false, error: "invalid name — use letters, digits, . _ -" };
  }
  if (await repoExists(ref)) {
    return { ok: false, error: "a repo with that name already exists" };
  }
  if (await trashHasName(ref.owner, ref.name)) {
    return {
      ok: false,
      error:
        `${ref.owner}/${ref.name} is in Recently Deleted and still holds that name. ` +
        `Restore it, or delete it permanently, from your settings.`,
      reserved: true,
    };
  }
  return { ok: true, ref };
}

export async function createRepo(owner: string, nameRaw: string): Promise<CreateResult> {
  const claim = await claimName(owner, nameRaw);
  if (claim.ref) await initBareRepo(claim.ref);
  return claim;
}

async function pruneEmptyDir(dir: string): Promise<void> {
  try {
    if ((await readdir(dir)).length === 0) {
      await rm(dir, { recursive: true, force: true });
    }
  } catch {
  }
}

const TRASH_DIR = ".trash";

const TRASH_ENTRY = /^\+?[A-Za-z0-9._-]+\.\d+\.git$/;

function trashRoot(): string {
  return join(config.reposRoot, TRASH_DIR);
}

function trashOwnerDir(owner: string): string {
  return join(trashRoot(), owner);
}

function trashEntryDir(owner: string, entry: string): string | null {
  if (!safeSegment(owner)) return null;
  if (entry.startsWith(".") || entry.includes("/") || entry.includes("\\")) {
    return null;
  }
  if (!TRASH_ENTRY.test(entry)) return null;
  if (!safeName(nameFromEntry(entry))) return null;

  const root = resolve(trashRoot());
  const full = resolve(join(root, owner, entry));
  if (!full.startsWith(root + sep)) return null;
  return full;
}

function nameFromEntry(entry: string): string {
  return entry.replace(/\.\d+\.git$/, "");
}

export async function trashRepo(
  ref: RepoRef,
  meta: Omit<DeletedMeta, "version" | "owner" | "name">,
): Promise<{ ok: boolean; entry?: string; error?: string }> {
  if (!(await repoExists(ref))) return { ok: false, error: "no such repository" };

  const ownerDir = trashOwnerDir(ref.owner);
  await mkdir(ownerDir, { recursive: true });

  let stamp = meta.deletedAt;
  let entry = `${ref.name}.${stamp}.git`;
  while (await pathExists(join(ownerDir, entry))) {
    stamp += 1;
    entry = `${ref.name}.${stamp}.git`;
  }

  const full: DeletedMeta = {
    version: 1,
    owner: ref.owner,
    name: ref.name,
    deletedAt: meta.deletedAt,
    deletedBy: meta.deletedBy,
    grants: meta.grants,
  };
  await writeFile(
    join(refDir(ref), DELETED_META),
    JSON.stringify(full, null, 2) + "\n",
  );

  await rename(refDir(ref), join(ownerDir, entry));
  await pruneEmptyDir(join(config.reposRoot, ref.owner));
  return { ok: true, entry };
}

export async function listTrash(owner: string): Promise<TrashEntry[]> {
  if (!safeSegment(owner)) return [];
  let entries: string[];
  try {
    entries = await readdir(trashOwnerDir(owner));
  } catch {
    return [];
  }

  const out: TrashEntry[] = [];
  for (const entry of entries) {
    const dir = trashEntryDir(owner, entry);
    if (!dir) continue;

    const fallbackTime = Number(/\.(\d+)\.git$/.exec(entry)?.[1] ?? 0);
    let meta: DeletedMeta | null = null;
    try {
      const parsed = JSON.parse(await readFile(join(dir, DELETED_META), "utf8"));
      if (
        parsed &&
        typeof parsed.name === "string" &&
        safeName(parsed.name) &&
        parsed.owner === owner
      ) {
        meta = parsed as DeletedMeta;
      }
    } catch {
    }

    out.push({
      entry,
      owner,
      name: meta?.name ?? nameFromEntry(entry),
      deletedAt: meta?.deletedAt ?? fallbackTime,
      deletedBy: meta?.deletedBy ?? "unknown",
      grants: Array.isArray(meta?.grants) ? meta.grants : [],
      degraded: meta === null,
    });
  }

  out.sort((a, b) => b.deletedAt - a.deletedAt);
  return out;
}

export async function trashHasName(owner: string, name: string): Promise<boolean> {
  const entries = await listTrash(owner);
  return entries.some((e) => e.name === name);
}

export async function restoreFromTrash(
  owner: string,
  entry: string,
): Promise<RestoreResult> {
  const dir = trashEntryDir(owner, entry);
  if (!dir || !(await pathExists(dir))) {
    return { ok: false, error: "no such deleted repository" };
  }

  const all = await listTrash(owner);
  const found = all.find((e) => e.entry === entry);
  if (!found) return { ok: false, error: "no such deleted repository" };

  const ref = safeRef(owner, found.name);
  if (!ref) return { ok: false, error: "that repository's name is not usable" };
  if (await repoExists(ref)) {
    return {
      ok: false,
      error: `${owner}/${found.name} already exists. Rename or delete it first, then restore.`,
    };
  }

  await mkdir(join(config.reposRoot, owner), { recursive: true });
  await rename(dir, refDir(ref));
  await unlink(join(refDir(ref), DELETED_META)).catch(() => {});
  await pruneEmptyDir(trashOwnerDir(owner));
  return { ok: true, meta: found };
}

export async function purgeFromTrash(
  owner: string,
  entry: string,
): Promise<boolean> {
  const dir = trashEntryDir(owner, entry);
  if (!dir) return false;
  if (!(await pathExists(dir))) return false;
  await rm(dir, { recursive: true, force: true });
  await pruneEmptyDir(trashOwnerDir(owner));
  return true;
}

export async function purgeExpired(owner: string): Promise<TrashEntry[]> {
  if (config.trashDays <= 0) return [];
  const cutoff = Math.floor(Date.now() / 1000) - config.trashDays * 86400;
  const purged: TrashEntry[] = [];
  for (const entry of await listTrash(owner)) {
    if (entry.degraded || entry.deletedAt <= 0) continue;
    if (entry.deletedAt >= cutoff) continue;
    if (await purgeFromTrash(owner, entry.entry)) purged.push(entry);
  }
  return purged;
}

export async function purgeAllExpired(): Promise<TrashEntry[]> {
  if (config.trashDays <= 0) return [];

  let owners: string[];
  try {
    owners = await readdir(trashRoot());
  } catch {
    return [];
  }

  const purged: TrashEntry[] = [];
  for (const owner of owners) {
    if (!safeSegment(owner)) continue;
    purged.push(...(await purgeExpired(owner)));
  }
  return purged;
}

export function isRepoPublic(ref: RepoRef): Promise<boolean> {
  return pathExists(join(refDir(ref), config.publicMarker));
}

export async function setRepoPublic(ref: RepoRef, isPublic: boolean): Promise<void> {
  const marker = join(refDir(ref), config.publicMarker);
  if (isPublic) await writeFile(marker, "");
  else await unlink(marker).catch(() => {});
}

const LIST_CONCURRENCY = 16;

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    for (let i = next++; i < items.length; i = next++) {
      out[i] = await fn(items[i]!);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

async function summarise(ref: RepoRef): Promise<RepoSummary | null> {
  const dir = refDir(ref);
  try {
    const [description, head, lastCommit, isPublic] = await Promise.all([
      readDescription(dir),
      headBranch(dir),
      lastCommitTime(dir),
      isRepoPublic(ref),
    ]);
    return { owner: ref.owner, name: ref.name, description, head, lastCommit, isPublic };
  } catch {
    return null;
  }
}

export async function listRepos(): Promise<RepoSummary[]> {
  let owners: string[];
  try {
    owners = await readdir(config.reposRoot);
  } catch {
    return [];
  }

  const refs: RepoRef[] = [];
  for (const owner of owners) {
    if (!safeSegment(owner)) continue;
    let entries: string[];
    try {
      entries = await readdir(join(config.reposRoot, owner));
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".git")) continue;
      const name = entry.replace(/\.git$/, "");
      if (!safeName(name)) continue;
      refs.push({ owner, name });
    }
  }

  const repos = (await mapLimit(refs, LIST_CONCURRENCY, summarise)).filter(
    (r): r is RepoSummary => r !== null,
  );

  repos.sort((a, b) => (b.lastCommit ?? 0) - (a.lastCommit ?? 0));
  return repos;
}

async function readDescription(dir: string): Promise<string> {
  try {
    const text = (await readFile(join(dir, "description"), "utf8")).trim();
    if (text.startsWith("Unnamed repository")) return "";
    return text;
  } catch {
    return "";
  }
}

async function headBranch(dir: string): Promise<string> {
  try {
    return (await git(dir, ["symbolic-ref", "--short", "HEAD"])).trim();
  } catch {
    return "main";
  }
}

const MAX_DESCRIPTION = 300;

export async function setDescription(ref: RepoRef, raw: string): Promise<void> {
  const text = raw.replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION);
  const path = join(refDir(ref), "description");
  if (!text) {
    await writeFile(path, "Unnamed repository; edit this file to name it.\n");
    return;
  }
  await writeFile(path, `${text}\n`);
}

const REMOTE_TIMEOUT_MS = 10_000;
const REMOTE_MAX_BYTES = 1024 * 1024;

const REMOTE_HARDENING = [
  "-c", "protocol.allow=never",
  "-c", "protocol.https.allow=always",
  "-c", "credential.helper=",
  "-c", "http.followRedirects=false",
  "-c", "http.lowSpeedLimit=1000",
  "-c", "http.lowSpeedTime=15",
];

// Cast: the Worker's generated types add its bindings to ProcessEnv, which this process never has
const REMOTE_ENV = {
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  HOME: "/nonexistent",
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "/bin/true",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  LC_ALL: "C",
} as unknown as NodeJS.ProcessEnv;

export async function lsRemote(url: string): Promise<LsRemoteResult> {
  try {
    const { stdout } = await exec(
      "git",
      [...REMOTE_HARDENING, "ls-remote", "--heads", "--tags", "--", url],
      {
        timeout: REMOTE_TIMEOUT_MS,
        killSignal: "SIGKILL",
        maxBuffer: REMOTE_MAX_BYTES,
        encoding: "utf8",
        env: REMOTE_ENV,
        windowsHide: true,
      },
    );
    return { ok: true, text: stdout };
  } catch (err) {
    const e = err as { stderr?: string; killed?: boolean; signal?: string; message?: string };
    const timedOut = e.killed === true || e.signal === "SIGKILL";
    return {
      ok: false,
      ...classifyRemoteError(e.stderr ?? e.message ?? "", timedOut),
    };
  }
}

const IMPORT_TIMEOUT_MS = 10 * 60_000;

export async function importRepo(
  owner: string,
  nameRaw: string,
  urlRaw: string,
): Promise<CreateResult> {
  const url = importUrl(urlRaw);
  if (!url) {
    return {
      ok: false,
      error: "give a public https clone URL, like https://codeberg.org/owner/repo.git",
    };
  }

  const claim = await claimName(owner, nameRaw.trim() || nameFromUrl(url));
  if (!claim.ref) return claim;

  const dir = refDir(claim.ref);
  await mkdir(join(config.reposRoot, owner), { recursive: true });
  try {
    await exec(
      "git",
      [...REMOTE_HARDENING, "clone", "--bare", "--quiet", "--", url, dir],
      {
        timeout: IMPORT_TIMEOUT_MS,
        killSignal: "SIGKILL",
        encoding: "utf8",
        env: REMOTE_ENV,
        windowsHide: true,
      },
    );
    await git(dir, ["remote", "remove", "origin"]);
    return claim;
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    const e = err as { stderr?: string; killed?: boolean; message?: string };
    const { message } = classifyRemoteError(e.stderr ?? e.message ?? "", e.killed === true);
    return { ok: false, error: `could not import ${url}: ${message}` };
  }
}

export async function localMirrorRefs(ref: RepoRef): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const text = await git(refDir(ref), [
      "for-each-ref",
      "--format=%(objectname) %(refname)",
      "refs/heads",
      "refs/tags",
    ]);
    for (const line of text.split("\n")) {
      const space = line.indexOf(" ");
      if (space === -1) continue;
      const sha = line.slice(0, space);
      const name = line.slice(space + 1).trim();
      if (safeObjectId(sha) && name) out.set(name, sha);
    }
  } catch {
  }
  return out;
}

export async function hasCommit(ref: RepoRef, sha: string): Promise<boolean> {
  const id = safeObjectId(sha);
  if (!id) return false;
  try {
    await git(refDir(ref), ["cat-file", "-e", `${id}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

export async function isAncestor(
  ref: RepoRef,
  ancestor: string,
  descendant: string,
): Promise<boolean> {
  const a = safeObjectId(ancestor);
  const b = safeObjectId(descendant);
  if (!a || !b) return false;
  try {
    await git(refDir(ref), ["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch {
    return false;
  }
}

export async function readLinks(ref: RepoRef): Promise<MirrorLink[]> {
  try {
    const text = await readFile(join(refDir(ref), LINKS_FILE), "utf8");
    return parseLinks(text.slice(0, MAX_LINKS_BYTES));
  } catch {
    return [];
  }
}

export async function setLinks(ref: RepoRef, links: MirrorLink[]): Promise<void> {
  const path = join(refDir(ref), LINKS_FILE);
  const valid = parseLinks(serialiseLinks(links));
  if (valid.length === 0) {
    await unlink(path).catch(() => {});
    return;
  }
  await writeFile(path, serialiseLinks(valid) + "\n");
}

export async function listRefs(ref: RepoRef): Promise<RefList> {
  const dir = refDir(ref);
  const head = await headBranch(dir);

  const read = async (namespace: string): Promise<string[]> => {
    try {
      const out = await git(dir, [
        "for-each-ref",
        "--format=%(refname:short)",
        "--sort=-creatordate",
        namespace,
      ]);
      return out.split("\n").filter((line) => line.trim().length > 0);
    } catch {
      return [];
    }
  };

  return {
    branches: await read("refs/heads"),
    tags: await read("refs/tags"),
    head,
  };
}

export async function resolveRev(
  ref: RepoRef,
  requested: string | undefined,
  known?: RefList,
): Promise<string> {
  const refs = known ?? (await listRefs(ref));
  const fallback = refs.head;

  const wanted = (requested ?? "").trim();
  if (!wanted) return fallback;
  if (refs.branches.includes(wanted) || refs.tags.includes(wanted)) return wanted;

  return (await hasCommit(ref, wanted)) ? wanted : fallback;
}

async function lastCommitTime(dir: string): Promise<number | null> {
  try {
    const out = (await git(dir, ["log", "-1", "--format=%at"])).trim();
    return out ? Number(out) : null;
  } catch {
    return null;
  }
}

const COMMIT_FORMAT = ["%H", "%an", "%ae", "%at", "%s"].join(FNUL) + FREC;

async function readCommits(ref: RepoRef, args: string[]): Promise<Commit[]> {
  let out: string;
  try {
    out = await git(refDir(ref), ["log", `--format=${COMMIT_FORMAT}`, ...args, "--"]);
  } catch {
    return [];
  }
  return out
    .split(REC)
    .map((row) => row.replace(/^\n/, ""))
    .filter((row) => row.trim().length > 0)
    .map((row) => {
      const [hash, author, email, time, subject] = row.split(NUL);
      return {
        hash: hash ?? "",
        author: author ?? "",
        email: email ?? "",
        time: Number(time ?? 0),
        subject: subject ?? "",
      };
    });
}

export function log(ref: RepoRef, refspec: string, limit = 50): Promise<Commit[]> {
  return readCommits(ref, [`--max-count=${limit}`, refspec]);
}

export async function logRange(
  ref: RepoRef,
  from: string | null,
  to: string,
  limit: number,
): Promise<Commit[]> {
  const toId = safeObjectId(to);
  const fromId = from ? safeObjectId(from) : null;
  if (!toId || (from && !fromId)) return [];

  return readCommits(ref, [
    `--max-count=${Math.max(1, Math.floor(limit))}`,
    fromId ? `${fromId}..${toId}` : toId,
  ]);
}

export async function tree(ref: RepoRef, refspec: string, path: string): Promise<TreeEntry[]> {
  const dir = refDir(ref);
  const spec = path ? `${refspec}:${path}` : refspec;
  let out: string;
  try {
    out = await git(dir, ["ls-tree", "--long", spec, "--"]);
  } catch {
    return [];
  }
  return out
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [meta, entryName] = line.split("\t");
      const [mode, type, hash, size] = (meta ?? "").split(/\s+/);
      return {
        mode: mode ?? "",
        type: (type ?? "blob") as TreeEntry["type"],
        hash: hash ?? "",
        size: size ?? "-",
        name: entryName ?? "",
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

const MAX_BLOB_RENDER_BYTES = 2 * 1024 * 1024;

export async function blob(ref: RepoRef, refspec: string, path: string): Promise<Blob | null> {
  const dir = refDir(ref);
  let stdout: Buffer;
  try {
    ({ stdout } = (await exec(
      "git",
      ["-C", dir, "show", `${refspec}:${path}`, "--"],
      {
        maxBuffer: 64 * 1024 * 1024,
        encoding: "buffer",
      },
    )) as unknown as { stdout: Buffer });
  } catch {
    return null;
  }

  const bytes = stdout.length;
  const binary = stdout.subarray(0, 8000).includes(0);
  if (binary) {
    return { text: "", binary: true, truncated: false, bytes };
  }

  const truncated = bytes > MAX_BLOB_RENDER_BYTES;
  const shown = truncated ? stdout.subarray(0, MAX_BLOB_RENDER_BYTES) : stdout;
  return {
    text: shown.toString("utf8"),
    binary: false,
    truncated,
    bytes,
  };
}

const README = /^readme(\.(?:md|markdown|mdown|mkd))?$/i;
const README_MD = /^readme\.(?:md|markdown|mdown|mkd)$/i;

export async function readme(ref: RepoRef, refspec: string): Promise<Readme | null> {
  const entries = await tree(ref, refspec, "");
  const blobs = entries.filter((e) => e.type === "blob");
  const hit =
    blobs.find((e) => README_MD.test(e.name)) ?? blobs.find((e) => README.test(e.name));
  if (!hit) return null;
  const content = await blob(ref, refspec, hit.name);
  if (!content || content.binary) return null;
  return { path: hit.name, text: content.text };
}

export async function headReadme(ref: RepoRef): Promise<Readme | null> {
  const refs = await listRefs(ref);
  if (refs.branches.length === 0) return null;
  const rev = refs.branches.includes(refs.head) ? refs.head : refs.branches[0]!;
  return readme(ref, rev);
}

export async function description(ref: RepoRef): Promise<string> {
  return readDescription(refDir(ref));
}

export async function commit(ref: RepoRef, shaRaw: string): Promise<CommitDetail | null> {
  const sha = safeObjectId(shaRaw);
  if (!sha) return null;

  const dir = refDir(ref);
  const format = ["%H", "%an", "%ae", "%at", "%s", "%b"].join(FNUL);
  let out: string;
  try {
    out = await git(dir, [
      "show",
      `--format=${format}${FREC}`,
      "--patch",
      sha,
      "--",
    ]);
  } catch {
    return null;
  }

  const sep = out.indexOf(REC);
  if (sep === -1) return null;
  const [hash, author, email, time, subject, body] = out.slice(0, sep).split(NUL);

  const fullDiff = out.slice(sep + 1).replace(/^\n/, "");
  const diffTruncated = fullDiff.length > MAX_BLOB_RENDER_BYTES;

  return {
    hash: hash ?? "",
    author: author ?? "",
    email: email ?? "",
    time: Number(time ?? 0),
    subject: subject ?? "",
    body: body ?? "",
    diff: diffTruncated ? fullDiff.slice(0, MAX_BLOB_RENDER_BYTES) : fullDiff,
    diffTruncated,
  };
}
