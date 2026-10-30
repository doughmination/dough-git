/* src/routes/settings/tokens/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { config } from "#lib/server/config.ts";
import { sessionSlug } from "#lib/server/auth.ts";
import { createToken, listTokens, revokeToken } from "#lib/server/tokens.ts";
import { field, me } from "#lib/server/web.ts";

export const load: PageServerLoad = async (event) => {
  const slug = sessionSlug(me(event));
  return {
    slug,
    baseUrl: config.baseUrl,
    tokens: await listTokens(slug),
  };
};

export const actions: Actions = {
  create: async (event) => {
    const user = me(event);
    const form = await event.request.formData();
    const newToken = await createToken(field(form, "label"), sessionSlug(user), user.sub);
    // Shown once, straight back on this page; never stored in the clear
    return { newToken };
  },

  revoke: async (event) => {
    const form = await event.request.formData();
    await revokeToken(field(form, "id"), sessionSlug(me(event)));
    redirect(303, "/settings/tokens");
  },
};
