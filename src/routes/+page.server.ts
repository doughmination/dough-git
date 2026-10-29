/* src/routes/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { PageServerLoad } from "./$types";
import { canRead, sharedWith } from "#lib/server/access.ts";
import { isProfileRepo, listRepos } from "#lib/server/git.ts";
import { viewerOf } from "#lib/server/web.ts";

export const load: PageServerLoad = async (event) => {
  const viewer = viewerOf(event);
  const shared = viewer ? new Set(sharedWith(viewer).map((r) => `${r.owner}/${r.name}`)) : null;

  const repos = (await listRepos())
    .filter((r) => !isProfileRepo(r.name))
    .filter((r) =>
      canRead({
        ref: {
          owner: r.owner,
          name: r.name,
        },
        isPublic: r.isPublic,
        viewer,
      }),
    )
    .map((r) => ({
      ...r,
      shared: shared?.has(`${r.owner}/${r.name}`) ?? false,
    }));

  return { repos };
};
