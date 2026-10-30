/* src/lib/server/transport.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { waitUntil } from "cloudflare:workers";
import { config } from "./config.ts";
import { authenticateGit, gitActor } from "./auth.ts";
import { canRead, canWrite } from "./access.ts";
import { clearRepoMetadata } from "./repometa.ts";
import { notifyPush, notifyRepoCreated } from "./notify.ts";
import { markStale } from "./mirror.ts";
import {
  agentFetch,
  initBareRepo,
  isRepoPublic,
  localMirrorRefs,
  refSlug,
  repoExists,
  trashHasName,
  type RepoRef,
} from "./git.ts";

export type GitService = "git-upload-pack" | "git-receive-pack";

export const GIT_SERVICES: GitService[] = ["git-upload-pack", "git-receive-pack"];

function authChallenge(message = "authentication required"): Response {
  return new Response(`${message}\n`, {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="dough-git"' },
  });
}

interface GitGate {
  response: Response | null;
  actor: string | null;
}

const ALLOW = (actor: string | null): GitGate => ({ response: null, actor });
const DENY = (response: Response): GitGate => ({ response, actor: null });

export async function gitGate(request: Request, ref: RepoRef, needPush: boolean): Promise<GitGate> {
  const auth = await authenticateGit(request.headers.get("authorization") ?? undefined);
  const actor = gitActor(auth);
  const exists = await repoExists(ref);

  if (auth.kind === "rejected") {
    console.warn(`[git] denied ${refSlug(ref)}: ${auth.message}`);
    return DENY(new Response(`${auth.message}\n`, { status: 403 }));
  }

  if (needPush) {
    if (!actor) return DENY(authChallenge());

    if (!exists) {
      if (actor !== ref.owner) {
        console.warn(`[git] denied create of ${refSlug(ref)} by ${actor}`);
        return DENY(
          new Response(`${actor} can only create repositories under ${actor}/\n`, {
            status: 403,
          }),
        );
      }
      if (await trashHasName(ref.owner, ref.name)) {
        console.warn(`[git] refused auto-create of trashed ${refSlug(ref)}`);
        return DENY(
          new Response(
            `${refSlug(ref)} is in Recently Deleted. Restore it, or delete it ` +
              `permanently, before pushing to that name again.\n`,
            { status: 409 },
          ),
        );
      }
      if (!config.autoCreate) {
        return DENY(new Response("repository not found\n", { status: 404 }));
      }
      await initBareRepo(ref);
      await clearRepoMetadata(ref);
      console.log(`[git] auto-created ${refSlug(ref)}.git on first push`);
      notifyRepoCreated(ref, actor, false);
      return ALLOW(actor);
    }

    const isPublic = await isRepoPublic(ref);
    if (!(await canWrite({ ref, isPublic, viewer: actor }))) {
      console.warn(`[git] denied push to ${refSlug(ref)} by ${actor}`);
      return DENY(
        new Response(`${actor} does not have write access to ${refSlug(ref)}\n`, {
          status: 403,
        }),
      );
    }
    return ALLOW(actor);
  }

  if (exists) {
    const isPublic = await isRepoPublic(ref);
    if (await canRead({ ref, isPublic, viewer: actor })) return ALLOW(actor);
  }
  if (auth.kind === "anonymous") return DENY(authChallenge());
  return DENY(new Response("repository not found\n", { status: 404 }));
}

function smartPath(ref: RepoRef, rest: string): string {
  return `/smart/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}/${rest}`;
}

/** The info/refs advertisement, once the gate lets the request through */
export async function advertise(request: Request, ref: RepoRef, service: GitService): Promise<Response> {
  const gate = await gitGate(request, ref, service === "git-receive-pack");
  if (gate.response) return gate.response;
  return agentFetch(smartPath(ref, `info/refs?service=${service}`));
}

/** Serves git-upload-pack or git-receive-pack once the gate lets the request through */
export async function rpc(request: Request, ref: RepoRef, service: GitService): Promise<Response> {
  const isPush = service === "git-receive-pack";
  const gate = await gitGate(request, ref, isPush);
  if (gate.response) return gate.response;

  const before = isPush ? await localMirrorRefs(ref) : new Map<string, string>();
  const actor = gate.actor;
  const isPublic = isPush ? await isRepoPublic(ref) : false;

  const headers = new Headers({
    "Content-Type": `application/x-${service}-request`,
  });
  const encoding = request.headers.get("content-encoding");
  if (encoding) headers.set("Content-Encoding", encoding);

  const upstream = await agentFetch(smartPath(ref, service), {
    method: "POST",
    headers,
    body: request.body,
  });
  if (!isPush || !upstream.body) return upstream;

  // The container closes the stream only once the push is safe in R2
  const afterPush = async () => {
    try {
      const after = await localMirrorRefs(ref);
      const changed =
        after.size !== before.size || [...after].some(([name, sha]) => before.get(name) !== sha);
      if (!changed) return;

      await markStale(ref);
      notifyPush(ref, actor ?? "unknown", isPublic, before, after);
    } catch (err) {
      console.warn(`[git] post-push processing failed for ${refSlug(ref)}:`, err);
    }
  };

  const body = upstream.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      flush() {
        waitUntil(afterPush());
      },
    }),
  );
  return new Response(body, upstream);
}
