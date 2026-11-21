/* src/routes/[owner]/[name=repo]/image/+server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { RequestHandler } from "./$types";
import { canRead } from "#lib/server/access.ts";
import { readRepoImage } from "#lib/server/avatars.ts";
import { isRepoPublic, repoExists } from "#lib/server/git.ts";
import { refFrom, viewerOf } from "#lib/server/web.ts";

// Same rule as the repository: a private repository's image is only for people who can read it
export const GET: RequestHandler = async (event) => {
  const ref = refFrom(event);
  const isPublic = ref ? await isRepoPublic(ref) : false;
  const allowed =
    ref !== null &&
    (await repoExists(ref)) &&
    (await canRead({
      ref,
      isPublic,
      viewer: viewerOf(event),
    }));

  const image = allowed ? await readRepoImage(ref) : null;
  if (!image) return new Response("no such image\n", { status: 404 });

  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.type,
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=86400`,
    },
  });
};
