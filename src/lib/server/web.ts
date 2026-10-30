/* src/lib/server/web.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Glue between SvelteKit requests and the git/access modules

import { error, redirect, type RequestEvent } from "@sveltejs/kit";
import { sessionSlug, type SessionUser } from "./auth.ts";
import { accessFor, canWrite, type Access } from "./access.ts";
import {
  isRepoPublic,
  listRefs,
  repoExists,
  resolveRev,
  safeRef,
  type RefList,
  type RepoRef,
} from "./git.ts";

/** An error page with a title, like the old messagePage */
export function fail(title: string, message: string, status = 400): never {
  error(status, {
    title,
    message,
  });
}

export function notFound(): never {
  fail("not found", "No such repository, or you don't have access.", 404);
}

/** The signed-in user, or off to sign in */
export function me(event: RequestEvent): SessionUser {
  const user = event.locals.user;
  if (user) return user;
  if (event.request.method === "GET") redirect(303, "/auth/login");
  fail("forbidden", "Sign in first.", 403);
}

export function viewerOf(event: RequestEvent): string | null {
  const user = event.locals.user;
  return user ? sessionSlug(user) : null;
}

export function refFrom(event: RequestEvent): RepoRef | null {
  const { owner, name } = event.params as { owner?: string; name?: string };
  if (!owner || !name) return null;
  return safeRef(owner, name);
}

export interface ViewableRepo {
  ref: RepoRef;
  isPublic: boolean;
  access: Access;
  refs: RefList;
  rev: string;
}

/** A repository this viewer may read, at the revision asked for in ?h= */
export async function viewable(event: RequestEvent): Promise<ViewableRepo> {
  const ref = refFrom(event);
  if (!ref || !(await repoExists(ref))) notFound();

  const isPublic = await isRepoPublic(ref);
  const access = await accessFor({
    ref,
    isPublic,
    viewer: viewerOf(event),
  });
  if (access === "none") notFound();

  const refs = await listRefs(ref);
  const rev = await resolveRev(ref, event.url.searchParams.get("h") ?? undefined, refs);
  return {
    ref,
    isPublic,
    access,
    refs,
    rev,
  };
}

/** A repository the signed-in user owns */
export async function ownedRef(event: RequestEvent): Promise<RepoRef> {
  const user = event.locals.user;
  const ref = refFrom(event);
  if (!user || !ref || ref.owner !== sessionSlug(user) || !(await repoExists(ref))) notFound();
  return ref;
}

/** A repository the signed-in user may push to */
export async function writableRef(event: RequestEvent): Promise<RepoRef> {
  const ref = refFrom(event);
  if (!ref || !(await repoExists(ref))) notFound();

  const isPublic = await isRepoPublic(ref);
  const allowed = await canWrite({
    ref,
    isPublic,
    viewer: viewerOf(event),
  });
  if (!allowed) notFound();
  return ref;
}

/** A form field as a string, "" when missing */
export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** The ?h= suffix that keeps a non-default revision across links */
export function revQuery(rev: string, head: string): string {
  return rev === head ? "" : `?h=${encodeURIComponent(rev)}`;
}
