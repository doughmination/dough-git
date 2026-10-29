/* src/routes/[owner]/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { PageServerLoad } from "./$types";
import { ownerPage } from "#lib/server/owner.ts";
import { viewerOf } from "#lib/server/web.ts";

export const load: PageServerLoad = (event) => ownerPage(event.params.owner, viewerOf(event), true);
