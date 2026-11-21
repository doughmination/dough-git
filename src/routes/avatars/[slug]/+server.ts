/* src/routes/avatars/[slug]/+server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { RequestHandler } from "./$types";
import { readAvatar } from "#lib/server/avatars.ts";
import { ownerSlug } from "#lib/server/gitref.ts";

export const GET: RequestHandler = async ({ params }) => {
  // Only real slugs, so the path can't climb out of the avatars folder
  const slug = params.slug;
  const avatar = slug === ownerSlug(slug) ? await readAvatar(slug) : null;
  if (!avatar) return new Response("no such avatar\n", { status: 404 });

  return new Response(avatar.bytes, {
    headers: {
      "Content-Type": avatar.type,
      // Every upload gets a new ?v=, so a day of caching never shows a stale picture for long
      "Cache-Control": "public, max-age=86400",
    },
  });
};
