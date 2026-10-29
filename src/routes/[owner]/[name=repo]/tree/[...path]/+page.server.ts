/* src/routes/[owner]/[name=repo]/tree/[...path]/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { PageServerLoad } from "./$types";
import { tree } from "#lib/server/git.ts";
import { revQuery, viewable } from "#lib/server/web.ts";

export const load: PageServerLoad = async (event) => {
  const { ref, refs, rev } = await viewable(event);
  const path = event.params.path.replace(/\/+$/, "");
  return {
    owner: ref.owner,
    name: ref.name,
    path,
    refs,
    rev,
    query: revQuery(rev, refs.head),
    entries: await tree(ref, rev, path),
  };
};
