/* src/routes/new/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { redirect, type RequestEvent } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { sessionSlug } from "#lib/server/auth.ts";
import { clearRepoMetadata } from "#lib/server/repometa.ts";
import { notifyRepoCreated } from "#lib/server/notify.ts";
import { getSettings } from "#lib/server/settings.ts";
import {
  createRepo,
  importRepo,
  refSlug,
  setRepoPublic,
  type CreateResult,
} from "#lib/server/git.ts";
import { fail, field, me } from "#lib/server/web.ts";

export const load: PageServerLoad = (event) => {
  return { owner: sessionSlug(me(event)) };
};

// Shared tail of "create empty" and "import": metadata, visibility, notify
async function finishCreate(event: RequestEvent, result: CreateResult, verb: string): Promise<never> {
  if (!result.ok || !result.ref) {
    const title = result.reserved ? "that name is still reserved" : `could not ${verb} repo`;
    fail(title, result.error ?? "unknown error", result.reserved ? 409 : 400);
  }

  const owner = sessionSlug(me(event));
  await clearRepoMetadata(result.ref);
  const startsPublic = !(await getSettings(owner)).defaultPrivate;
  if (startsPublic) await setRepoPublic(result.ref, true);
  notifyRepoCreated(result.ref, owner, startsPublic);
  redirect(303, `/${result.ref.owner}/${result.ref.name}`);
}

export const actions: Actions = {
  create: async (event) => {
    const owner = sessionSlug(me(event));
    const form = await event.request.formData();
    const result = await createRepo(owner, field(form, "name"));
    return finishCreate(event, result, "create");
  },

  import: async (event) => {
    const owner = sessionSlug(me(event));
    const form = await event.request.formData();
    const url = field(form, "url");
    const result = await importRepo(owner, field(form, "name"), url);
    if (result.ref) console.log(`[import] ${refSlug(result.ref)} from ${url}`);
    return finishCreate(event, result, "import");
  },
};
