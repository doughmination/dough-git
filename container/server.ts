/* container/server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// The git side of dough-git. Only the Worker can reach it (through its Durable
// Object), so nothing here checks who is asking: the Worker already decided

import * as git from "./git.ts";
import { advertiseResponse, serviceRpc, type GitService } from "./smart-http.ts";
import { restoreAll, syncRepo, syncTrash } from "./store.ts";
import { config } from "./config.ts";
import {
  safeRef,
  type CreateResult,
  type RepoRef,
  type RestoreResult,
  type TrashEntry,
} from "../src/lib/server/gitref.ts";

const ready = restoreAll().catch((err) => {
  console.error("[store] restore failed:", err);
  throw err;
});

// Arguments arrive as JSON, so their shapes are the Worker client's promise, not checked here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

type Handler = (...args: Loose[]) => Promise<unknown>;

// What the Worker may call, and what each call changes on disk
const CALLS: Record<string, { run: Handler; after?: (args: Loose, result: Loose) => Promise<void> }> = {
  repoExists: { run: git.repoExists },
  isRepoPublic: { run: git.isRepoPublic },
  listRepos: { run: git.listRepos },
  listTrash: { run: git.listTrash },
  trashHasName: { run: git.trashHasName },
  description: { run: git.description },
  lsRemote: { run: git.lsRemote },
  hasCommit: { run: git.hasCommit },
  isAncestor: { run: git.isAncestor },
  readLinks: { run: git.readLinks },
  listRefs: { run: git.listRefs },
  resolveRev: { run: git.resolveRev },
  log: { run: git.log },
  logRange: { run: git.logRange },
  tree: { run: git.tree },
  blob: { run: git.blob },
  readme: { run: git.readme },
  headReadme: { run: git.headReadme },
  commit: { run: git.commit },

  // Maps don't survive JSON
  localMirrorRefs: {
    run: async (ref: RepoRef) => Object.fromEntries(await git.localMirrorRefs(ref)),
  },

  initBareRepo: {
    run: git.initBareRepo,
    after: ([ref]: [RepoRef]) => syncRepo(ref),
  },
  createRepo: {
    run: git.createRepo,
    after: (_args, result: CreateResult) => (result.ref ? syncRepo(result.ref) : Promise.resolve()),
  },
  importRepo: {
    run: git.importRepo,
    after: (_args, result: CreateResult) => (result.ref ? syncRepo(result.ref) : Promise.resolve()),
  },
  setRepoPublic: {
    run: git.setRepoPublic,
    after: ([ref]: [RepoRef]) => syncRepo(ref),
  },
  setDescription: {
    run: git.setDescription,
    after: ([ref]: [RepoRef]) => syncRepo(ref),
  },
  setLinks: {
    run: git.setLinks,
    after: ([ref]: [RepoRef]) => syncRepo(ref),
  },
  trashRepo: {
    run: git.trashRepo,
    after: async ([ref]: [RepoRef]) => {
      await syncRepo(ref);
      await syncTrash(ref.owner);
    },
  },
  restoreFromTrash: {
    run: git.restoreFromTrash,
    after: async ([owner]: [string], result: RestoreResult) => {
      await syncTrash(owner);
      const ref = result.meta ? safeRef(owner, result.meta.name) : null;
      if (ref) await syncRepo(ref);
    },
  },
  purgeFromTrash: {
    run: git.purgeFromTrash,
    after: ([owner]: [string]) => syncTrash(owner),
  },
  purgeExpired: {
    run: git.purgeExpired,
    after: ([owner]: [string]) => syncTrash(owner),
  },
  purgeAllExpired: {
    run: git.purgeAllExpired,
    after: async (_args, result: TrashEntry[]) => {
      for (const owner of new Set(result.map((entry) => entry.owner))) await syncTrash(owner);
    },
  },
};

async function call(name: string, request: Request): Promise<Response> {
  const entry = CALLS[name];
  if (!entry) return new Response("no such call\n", { status: 404 });

  const { args } = (await request.json()) as { args: Loose[] };
  const result = await entry.run(...args);
  if (entry.after) await entry.after(args, result);

  // undefined isn't JSON; the client reads null back as "nothing"
  return Response.json({ result: result ?? null });
}

const SERVICES: GitService[] = ["git-upload-pack", "git-receive-pack"];

async function smart(request: Request, url: URL, parts: string[]): Promise<Response> {
  // /smart/<owner>/<name>/info/refs or /smart/<owner>/<name>/<service>
  const ref = safeRef(parts[0] ?? "", parts[1] ?? "");
  if (!ref) return new Response("bad repo\n", { status: 400 });
  const dir = git.refDir(ref);

  if (parts[2] === "info" && parts[3] === "refs") {
    const service = url.searchParams.get("service") as GitService | null;
    if (!service || !SERVICES.includes(service)) return new Response("bad service\n", { status: 400 });
    return advertiseResponse(dir, service);
  }

  const service = parts[2] as GitService;
  if (!SERVICES.includes(service) || request.method !== "POST") {
    return new Response("bad service\n", { status: 400 });
  }

  let exited!: (code: number) => void;
  const exit = new Promise<number>((resolve) => (exited = resolve));

  const response = serviceRpc({
    repoDir: dir,
    service,
    body: request.body,
    gzip: request.headers.get("content-encoding") === "gzip",
    onDone: exited,
  });
  if (service === "git-upload-pack") return response;

  // A push isn't finished until R2 has it, so the stream stays open until then
  const persisted = response.body!.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      async flush() {
        const code = await exit;
        if (code === 0) await syncRepo(ref);
        else console.warn(`[git] receive-pack for ${ref.owner}/${ref.name} exited ${code}`);
      },
    }),
  );
  return new Response(persisted, response);
}

export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (parts[0] === "health") return new Response("ok\n");

  try {
    await ready;
    if (parts[0] === "rpc" && parts[1] && request.method === "POST") return await call(parts[1], request);
    if (parts[0] === "smart") return await smart(request, url, parts.slice(1));
  } catch (err) {
    console.error("[agent]", request.method, url.pathname, err);
    return new Response("git agent failed\n", { status: 500 });
  }
  return new Response("not found\n", { status: 404 });
}

// The tests import handle() and call it in-process
if (import.meta.main) {
  Bun.serve({
    port: config.port,
    hostname: "0.0.0.0",
    // Big pushes and imports can sit quiet for minutes; never cut them off
    idleTimeout: 0,
    maxRequestBodySize: Number.MAX_SAFE_INTEGER,
    fetch: handle,
  });

  console.log(`git agent listening on :${config.port} (repos ${config.reposRoot})`);
}
