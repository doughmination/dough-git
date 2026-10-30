/* container/store.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Snapshots of every bare repository in R2. The container's disk is a cache:
// it is rebuilt from here on boot, and each write is uploaded before it is acknowledged

import { S3Client } from "bun";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { config } from "./config.ts";
import type { RepoRef } from "../src/lib/server/gitref.ts";

const TRASH_DIR = ".trash";

const enabled = Boolean(config.r2.endpoint && config.r2.accessKeyId && config.r2.secretAccessKey);

const s3 = enabled
  ? new S3Client({
      endpoint: config.r2.endpoint,
      bucket: config.r2.bucket,
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    })
  : null;

if (!enabled) console.warn("[store] R2 is not configured; repositories live only on this disk");

function repoKey(ref: RepoRef): string {
  return `repos/${ref.owner}/${ref.name}.git.tar`;
}

function trashKey(owner: string, entry: string): string {
  return `trash/${owner}/${entry}.tar`;
}

async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function run(args: string[]): Promise<void> {
  const child = Bun.spawn(args, {
    stdout: "ignore",
    stderr: "pipe",
  });
  const code = await child.exited;
  if (code !== 0) {
    const stderr = await new Response(child.stderr).text();
    throw new Error(`${args[0]} exited ${code}: ${stderr.trim().slice(0, 200)}`);
  }
}

let counter = 0;

function scratch(): string {
  counter += 1;
  return join(tmpdir(), `dough-${process.pid}-${Date.now()}-${counter}.tar`);
}

async function upload(parent: string, entry: string, key: string): Promise<void> {
  const file = scratch();
  try {
    await run([
      "tar",
      "-C",
      parent,
      "-cf",
      file,
      entry,
    ]);
    await s3!.write(key, Bun.file(file));
  } finally {
    await rm(file, { force: true });
  }
}

async function download(key: string, parent: string): Promise<void> {
  const file = scratch();
  try {
    await Bun.write(file, s3!.file(key));
    await mkdir(parent, { recursive: true });
    await run([
      "tar",
      "-C",
      parent,
      "-xf",
      file,
    ]);
  } finally {
    await rm(file, { force: true });
  }
}

async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await s3!.list({
      prefix,
      continuationToken,
    });
    for (const item of page.contents ?? []) keys.push(item.key);
    continuationToken = page.isTruncated ? page.nextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

// One sync at a time per key, so two quick writes can't upload out of order
const queues = new Map<string, Promise<void>>();

function serialise(key: string, task: () => Promise<void>): Promise<void> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  queues.set(key, next);
  void next.finally(() => {
    if (queues.get(key) === next) queues.delete(key);
  });
  return next;
}

/** Uploads a live repository, or removes its snapshot when it's gone from disk */
export function syncRepo(ref: RepoRef): Promise<void> {
  if (!s3) return Promise.resolve();
  const key = repoKey(ref);

  return serialise(key, async () => {
    const parent = join(config.reposRoot, ref.owner);
    const entry = `${ref.name}.git`;
    if (await isDir(join(parent, entry))) await upload(parent, entry, key);
    else await s3.delete(key);
  });
}

/** Makes R2's copy of one owner's Recently Deleted match the disk */
export function syncTrash(owner: string): Promise<void> {
  if (!s3) return Promise.resolve();
  const prefix = `trash/${owner}/`;

  return serialise(prefix, async () => {
    const parent = join(config.reposRoot, TRASH_DIR, owner);
    let local: string[] = [];
    try {
      local = (await readdir(parent)).filter((entry) => entry.endsWith(".git"));
    } catch {
    }

    const remote = new Set(await listKeys(prefix));

    // Trash entries never change once made, so upload only the new ones
    for (const entry of local) {
      const key = trashKey(owner, entry);
      if (!remote.has(key)) await upload(parent, entry, key);
      remote.delete(key);
    }
    for (const stale of remote) await s3.delete(stale);
  });
}

/** Rebuilds the repos root from R2; run once before serving anything */
export async function restoreAll(): Promise<void> {
  if (!s3) return;
  const started = Date.now();

  const repos = await listKeys("repos/");
  for (const key of repos) {
    // repos/<owner>/<name>.git.tar -> <root>/<owner>/
    const owner = key.split("/")[1]!;
    await download(key, join(config.reposRoot, owner));
  }

  const trash = await listKeys("trash/");
  for (const key of trash) {
    const owner = key.split("/")[1]!;
    await download(key, join(config.reposRoot, TRASH_DIR, owner));
  }

  console.log(`[store] restored ${repos.length} repos and ${trash.length} deleted ones in ${Date.now() - started}ms`);
}

/** Uploads everything on disk; for seeding R2 from an existing /srv/git */
export async function uploadAll(): Promise<void> {
  if (!s3) throw new Error("R2 is not configured");

  for (const owner of await readdir(config.reposRoot)) {
    if (owner.startsWith(".")) continue;
    const parent = join(config.reposRoot, owner);
    if (!(await isDir(parent))) continue;

    for (const entry of await readdir(parent)) {
      if (!entry.endsWith(".git")) continue;
      await upload(parent, entry, repoKey({ owner, name: entry.replace(/\.git$/, "") }));
      console.log(`[store] uploaded ${owner}/${entry}`);
    }
  }

  const trashRoot = join(config.reposRoot, TRASH_DIR);
  if (await isDir(trashRoot)) {
    for (const owner of await readdir(trashRoot)) await syncTrash(owner);
  }
}
