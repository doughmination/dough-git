/* src/routes/[owner]/[name=repo]/git-upload-pack/+server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { RequestHandler } from "./$types";
import { safeRef } from "#lib/server/git.ts";
import { rpc } from "#lib/server/transport.ts";

export const POST: RequestHandler = ({ params, request }) => {
  const ref = safeRef(params.owner, params.name);
  if (!ref) return new Response("bad repo\n", { status: 400 });
  return rpc(request, ref, "git-upload-pack");
};
