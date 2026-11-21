/* src/routes/[owner]/[name=repo]/+layout.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { LayoutServerLoad } from "./$types";
import { repoImageVersion } from "#lib/server/avatars.ts";
import { config } from "#lib/server/config.ts";
import { isRepoPublic, safeRef } from "#lib/server/git.ts";
import { findUserBySlug } from "#lib/server/users.ts";

// The page loads do the access checks; this only picks images
export const load: LayoutServerLoad = async ({ params }) => {
  const ref = safeRef(params.owner, params.name);
  const version = ref ? await repoImageVersion(ref) : null;
  const repoImage = ref && version ? `/${ref.owner}/${ref.name}/image?v=${version}` : null;
  const ownerPicture = (await findUserBySlug(params.owner))?.picture ?? null;

  // Discord can't fetch a private repository's image, so those embeds keep the owner's picture
  const isPublic = ref ? await isRepoPublic(ref) : false;

  return {
    repoImage,
    embedImage: isPublic && repoImage ? config.baseUrl + repoImage : ownerPicture,
  };
};
