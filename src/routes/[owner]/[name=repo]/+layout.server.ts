/* src/routes/[owner]/[name=repo]/+layout.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { LayoutServerLoad } from "./$types";
import { findUserBySlug } from "#lib/server/users.ts";

// Repository embeds show the owner's picture; it's already public on their profile
export const load: LayoutServerLoad = async ({ params }) => {
  return {
    ownerPicture: (await findUserBySlug(params.owner))?.picture ?? null,
  };
};
