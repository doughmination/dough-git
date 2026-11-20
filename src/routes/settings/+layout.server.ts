/* src/routes/settings/+layout.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { LayoutServerLoad } from "./$types";
import { sessionSlug } from "#lib/server/auth.ts";
import { config } from "#lib/server/config.ts";
import { me } from "#lib/server/web.ts";

// Every settings page needs a signed-in user
export const load: LayoutServerLoad = (event) => {
  const user = me(event);
  return {
    isSiteOwner: sessionSlug(user) === config.siteOwner,
  };
};
