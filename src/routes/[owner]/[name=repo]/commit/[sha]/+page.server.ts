/* src/routes/[owner]/[name=repo]/commit/[sha]/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { PageServerLoad } from "./$types";
import { commit } from "#lib/server/git.ts";
import { notFound, viewable } from "#lib/server/web.ts";

export const load: PageServerLoad = async (event) => {
  const { ref, rev } = await viewable(event);

  const detail = await commit(ref, event.params.sha);
  if (!detail) notFound();

  return {
    owner: ref.owner,
    name: ref.name,
    query: `?h=${encodeURIComponent(rev)}`,
    commit: detail,
  };
};
