/* src/routes/settings/+layout.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { LayoutServerLoad } from "./$types";
import { me } from "#lib/server/web.ts";

// Every settings page needs a signed-in user
export const load: LayoutServerLoad = (event) => {
  me(event);
};
