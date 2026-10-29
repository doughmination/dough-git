/* src/routes/[owner]/[name=repo]/blob/[...path]/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { PageServerLoad } from "./$types";
import { blob } from "#lib/server/git.ts";
import { notFound, revQuery, viewable } from "#lib/server/web.ts";

export const load: PageServerLoad = async (event) => {
  const { ref, refs, rev } = await viewable(event);
  const path = event.params.path;

  const file = await blob(ref, rev, path);
  if (!file) notFound();

  return {
    owner: ref.owner,
    name: ref.name,
    path,
    query: revQuery(rev, refs.head),
    ...file,
  };
};
