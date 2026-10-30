/* src/routes/[owner]/[name=repo]/info/refs/+server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { RequestHandler } from "./$types";
import { safeRef } from "#lib/server/git.ts";
import { GIT_SERVICES, advertise, type GitService } from "#lib/server/transport.ts";

export const GET: RequestHandler = async ({ params, url, request }) => {
  const ref = safeRef(params.owner, params.name);
  const service = url.searchParams.get("service") as GitService | null;
  if (!ref || !service || !GIT_SERVICES.includes(service)) {
    return new Response("only smart HTTP is supported\n", { status: 400 });
  }

  return advertise(request, ref, service);
};
