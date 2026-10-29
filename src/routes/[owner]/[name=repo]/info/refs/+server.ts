/* src/routes/[owner]/[name=repo]/info/refs/+server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { RequestHandler } from "./$types";
import { refDir, safeRef } from "#lib/server/git.ts";
import { advertiseResponse, type GitService } from "#lib/server/smart-http.ts";
import { GIT_SERVICES, gitGate } from "#lib/server/transport.ts";

export const GET: RequestHandler = async ({ params, url, request }) => {
  const ref = safeRef(params.owner, params.name);
  const service = url.searchParams.get("service") as GitService | null;
  if (!ref || !service || !GIT_SERVICES.includes(service)) {
    return new Response("only smart HTTP is supported\n", { status: 400 });
  }

  const gate = await gitGate(request, ref, service === "git-receive-pack");
  if (gate.response) return gate.response;
  return advertiseResponse(refDir(ref), service);
};
