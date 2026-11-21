/* src/routes/settings/moderation/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { redirect, type RequestEvent } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { sessionSlug } from "#lib/server/auth.ts";
import { config } from "#lib/server/config.ts";
import { addMod, listModLog, listMods, removeMod } from "#lib/server/roles.ts";
import { fail, field, me } from "#lib/server/web.ts";

// Only the site owner manages moderators; everyone else gets a plain 404
function ownerOnly(event: RequestEvent): string {
  const slug = sessionSlug(me(event));
  if (slug !== config.siteOwner) fail("not found", "No such page.", 404);
  return slug;
}

export const load: PageServerLoad = async (event) => {
  ownerOnly(event);
  return {
    owner: config.siteOwner,
    mods: await listMods(),
    log: await listModLog(),
  };
};

export const actions: Actions = {
  add: async (event) => {
    const actor = ownerOnly(event);
    const form = await event.request.formData();
    if (!(await addMod(actor, field(form, "slug")))) fail("can't add", "That isn't a valid username, or it's the site owner.");
    redirect(303, "/settings/moderation");
  },

  remove: async (event) => {
    const actor = ownerOnly(event);
    const form = await event.request.formData();
    await removeMod(actor, field(form, "slug"));
    redirect(303, "/settings/moderation");
  },
};
