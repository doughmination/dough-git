/* src/routes/[owner]/[name=repo]/log/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { PageServerLoad } from "./$types";
import { log } from "#lib/server/git.ts";
import { revQuery, viewable } from "#lib/server/web.ts";

export const load: PageServerLoad = async (event) => {
  const { ref, refs, rev } = await viewable(event);
  return {
    owner: ref.owner,
    name: ref.name,
    refs,
    rev,
    query: revQuery(rev, refs.head),
    commits: await log(ref, rev, 100),
  };
};
