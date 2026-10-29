/* src/hooks.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { Handle, HandleServerError, ServerInit } from "@sveltejs/kit/hooks";
import { config, oidcEnabled } from "#lib/server/config.ts";
import { SESSION_COOKIE, oidcIssuer, sessionUser } from "#lib/server/auth.ts";
import { purgeExpiredSessions } from "#lib/server/sessions.ts";
import { purgeAllExpired } from "#lib/server/git.ts";
import { clearRepoMetadata } from "#lib/server/repometa.ts";

const SITE_ORIGIN = new URL(config.baseUrl).origin;

// Logging out POSTs to /auth/logout, which redirects on to the SSO's logout,
// and browsers check form-action against that redirect too
const SSO_ORIGIN = config.oidc.issuer ? new URL(config.oidc.issuer).origin : "";

const GIT_TRANSPORT = /\/(?:git-upload-pack|git-receive-pack|info\/refs)$/;

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

function sweepSessions(): void {
  try {
    const purged = purgeExpiredSessions();
    if (purged) console.log(`[auth] purged ${purged} expired sessions`);
  } catch (err) {
    console.warn("[auth] session sweep failed:", err);
  }
}

async function sweepTrash(): Promise<void> {
  try {
    for (const gone of await purgeAllExpired()) {
      clearRepoMetadata({
        owner: gone.owner,
        name: gone.name,
      });
      console.log(`[trash] expired ${gone.owner}/${gone.name}`);
    }
  } catch (err) {
    console.warn("[trash] scheduled sweep failed:", err);
  }
}

export const init: ServerInit = async () => {
  console.log(`  oidc:       ${oidcEnabled ? "enabled" : "disabled"}`);
  console.log(
    `  trash:      ${config.trashDays > 0 ? `${config.trashDays}d, swept every 6h` : "kept forever"}`,
  );
  if (oidcEnabled) {
    try {
      console.log(`  oidc issuer (must equal the callback's iss): ${await oidcIssuer()}`);
      console.log(`  oidc redirect_uri: ${config.baseUrl}/auth/callback`);
    } catch (err) {
      console.error("  oidc discovery FAILED (check OIDC_ISSUER):", err instanceof Error ? err.message : err);
    }
  }

  void sweepTrash();
  sweepSessions();
  setInterval(() => {
    void sweepTrash();
    sweepSessions();
  }, SWEEP_INTERVAL_MS).unref();
};

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) return origin === SITE_ORIGIN;

  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === SITE_ORIGIN;
  } catch {
    return false;
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  const { request, url } = event;

  // Git transport never looks at the browser session, and skipping it keeps
  // SSO re-checks off that hot path. It authenticates with Basic auth instead
  if (GIT_TRANSPORT.test(url.pathname)) {
    event.locals.user = null;
    return resolve(event);
  }

  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (unsafe && !sameOrigin(request)) {
    return new Response("cross-site request refused\n", { status: 403 });
  }

  const token = event.cookies.get(SESSION_COOKIE);
  event.locals.user = await sessionUser(token);
  if (token && !event.locals.user) event.cookies.delete(SESSION_COOKIE, { path: "/" });

  const response = await resolve(event);
  const headers = response.headers;

  const csp = headers.get("content-security-policy");
  if (csp && SSO_ORIGIN) {
    headers.set("content-security-policy", csp.replace("form-action 'self'", `form-action 'self' ${SSO_ORIGIN}`));
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");
  if (SITE_ORIGIN.startsWith("https://")) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
};

// App errors (thrown with error()) keep their own title and message; this only softens unknown ones
export const handleError: HandleServerError = ({ kind, error, event }) => {
  if (kind !== "unknown") return;

  console.error("[error]", event.request.method, event.url.pathname, error);
  return {
    title: "something went wrong",
    message: "Something went wrong on our side. Please try again.",
  };
};
