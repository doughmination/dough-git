/* src/lib/server/transport.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { config } from "./config.ts";
import { authenticateGit, gitActor } from "./auth.ts";
import { canRead, canWrite } from "./access.ts";
import { clearRepoMetadata } from "./repometa.ts";
import { notifyPush, notifyRepoCreated } from "./notify.ts";
import { markStale } from "./mirror.ts";
import { serviceRpc, type GitService } from "./smart-http.ts";
import {
  initBareRepo,
  isRepoPublic,
  localMirrorRefs,
  refDir,
  refSlug,
  repoExists,
  trashHasName,
  type RepoRef,
} from "./git.ts";

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
  const auth = authenticateGit(request.headers.get("authorization") ?? undefined);
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
      clearRepoMetadata(ref);
      console.log(`[git] auto-created ${refSlug(ref)}.git on first push`);
      notifyRepoCreated(ref, actor, false);
      return ALLOW(actor);
    }

    const isPublic = await isRepoPublic(ref);
    if (!canWrite({ ref, isPublic, viewer: actor })) {
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
    if (canRead({ ref, isPublic, viewer: actor })) return ALLOW(actor);
  }
  if (auth.kind === "anonymous") return DENY(authChallenge());
  return DENY(new Response("repository not found\n", { status: 404 }));
}

/** Serves git-upload-pack or git-receive-pack once the gate lets the request through */
export async function rpc(request: Request, ref: RepoRef, service: GitService): Promise<Response> {
  const isPush = service === "git-receive-pack";
  const gate = await gitGate(request, ref, isPush);
  if (gate.response) return gate.response;

  const before = isPush ? await localMirrorRefs(ref) : new Map<string, string>();
  const actor = gate.actor;
  const isPublic = isPush ? await isRepoPublic(ref) : false;

  return serviceRpc({
    repoDir: refDir(ref),
    service,
    body: request.body,
    gzip: request.headers.get("content-encoding") === "gzip",
    onDone: isPush
      ? (code) => {
          if (code !== 0) {
            console.warn(`[git] receive-pack for ${refSlug(ref)} exited ${code}`);
            return;
          }
          void (async () => {
            try {
              const after = await localMirrorRefs(ref);
              markStale(ref);
              notifyPush(ref, actor ?? "unknown", isPublic, before, after);
            } catch (err) {
              console.warn(`[git] post-push processing failed for ${refSlug(ref)}:`, err);
            }
          })();
        }
      : undefined,
  });
}
