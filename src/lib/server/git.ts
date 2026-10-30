/* src/lib/server/git.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Every git and disk operation runs in the container (container/git.ts); this
// is the Worker's side of that call, with the same names and shapes

import { env } from "cloudflare:workers";
import type {
  Blob,
  Commit,
  CommitDetail,
  CreateResult,
  DeletedMeta,
  LsRemoteResult,
  MirrorLink,
  Readme,
  RefList,
  RepoRef,
  RepoSummary,
  RestoreResult,
  TrashEntry,
  TreeEntry,
} from "./gitref.ts";

export * from "./gitref.ts";

// One container holds every repository, so pushes and reads always agree.
// Same as @cloudflare/containers' getContainer, which can't load in the build
function agent() {
  return env.GIT.get(env.GIT.idFromName("main"));
}

/** Raw request to the container, for the streaming git transport */
export function agentFetch(path: string, init?: RequestInit): Promise<Response> {
  // `bun run agent` during `vite dev`, which has no containers
  const devAgent = (env as unknown as { GIT_AGENT_URL?: string }).GIT_AGENT_URL;
  if (devAgent) return fetch(new Request(`${devAgent}${path}`, init));
  return agent().fetch(new Request(`http://git-agent${path}`, init));
}

async function call<T>(name: string, ...args: unknown[]): Promise<T> {
  const response = await agentFetch(`/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ args }),
  });
  if (!response.ok) throw new Error(`git agent ${name} failed: HTTP ${response.status}`);
  const { result } = (await response.json()) as { result: T };
  return result;
}

export const repoExists = (ref: RepoRef) => call<boolean>("repoExists", ref);
export const initBareRepo = (ref: RepoRef) => call<void>("initBareRepo", ref);
export const createRepo = (owner: string, nameRaw: string) => call<CreateResult>("createRepo", owner, nameRaw);

export const trashRepo = (ref: RepoRef, meta: Omit<DeletedMeta, "version" | "owner" | "name">) =>
  call<{ ok: boolean; entry?: string; error?: string }>("trashRepo", ref, meta);

export const listTrash = (owner: string) => call<TrashEntry[]>("listTrash", owner);
export const trashHasName = (owner: string, name: string) => call<boolean>("trashHasName", owner, name);
export const restoreFromTrash = (owner: string, entry: string) => call<RestoreResult>("restoreFromTrash", owner, entry);
export const purgeFromTrash = (owner: string, entry: string) => call<boolean>("purgeFromTrash", owner, entry);
export const purgeExpired = (owner: string) => call<TrashEntry[]>("purgeExpired", owner);
export const purgeAllExpired = () => call<TrashEntry[]>("purgeAllExpired");

export const isRepoPublic = (ref: RepoRef) => call<boolean>("isRepoPublic", ref);
export const setRepoPublic = (ref: RepoRef, isPublic: boolean) => call<void>("setRepoPublic", ref, isPublic);
export const listRepos = () => call<RepoSummary[]>("listRepos");
export const setDescription = (ref: RepoRef, raw: string) => call<void>("setDescription", ref, raw);
export const description = (ref: RepoRef) => call<string>("description", ref);

export const lsRemote = (url: string) => call<LsRemoteResult>("lsRemote", url);

export const importRepo = (owner: string, nameRaw: string, urlRaw: string) =>
  call<CreateResult>("importRepo", owner, nameRaw, urlRaw);

export async function localMirrorRefs(ref: RepoRef): Promise<Map<string, string>> {
  const refs = await call<Record<string, string>>("localMirrorRefs", ref);
  return new Map(Object.entries(refs));
}

export const hasCommit = (ref: RepoRef, sha: string) => call<boolean>("hasCommit", ref, sha);

export const isAncestor = (ref: RepoRef, ancestor: string, descendant: string) =>
  call<boolean>("isAncestor", ref, ancestor, descendant);

export const readLinks = (ref: RepoRef) => call<MirrorLink[]>("readLinks", ref);
export const setLinks = (ref: RepoRef, links: MirrorLink[]) => call<void>("setLinks", ref, links);
export const listRefs = (ref: RepoRef) => call<RefList>("listRefs", ref);

export const resolveRev = (ref: RepoRef, requested: string | undefined, known?: RefList) =>
  call<string>("resolveRev", ref, requested, known);

export const log = (ref: RepoRef, refspec: string, limit = 50) => call<Commit[]>("log", ref, refspec, limit);

export const logRange = (ref: RepoRef, from: string | null, to: string, limit: number) =>
  call<Commit[]>("logRange", ref, from, to, limit);

export const tree = (ref: RepoRef, refspec: string, path: string) => call<TreeEntry[]>("tree", ref, refspec, path);
export const blob = (ref: RepoRef, refspec: string, path: string) => call<Blob | null>("blob", ref, refspec, path);
export const readme = (ref: RepoRef, refspec: string) => call<Readme | null>("readme", ref, refspec);
export const headReadme = (ref: RepoRef) => call<Readme | null>("headReadme", ref);
export const commit = (ref: RepoRef, shaRaw: string) => call<CommitDetail | null>("commit", ref, shaRaw);
