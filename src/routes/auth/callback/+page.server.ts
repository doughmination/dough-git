/* src/routes/auth/callback/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { config } from "#lib/server/config.ts";
import { OAUTH_COOKIE, SESSION_COOKIE, finishLogin } from "#lib/server/auth.ts";
import { SESSION_TTL } from "#lib/server/sessions.ts";
import { fail } from "#lib/server/web.ts";

export const load: PageServerLoad = async ({ cookies, url }) => {
  const tx = cookies.get(OAUTH_COOKIE);
  cookies.delete(OAUTH_COOKIE, { path: "/" });

  const idpError = url.searchParams.get("error");
  if (idpError) {
    console.error(`[auth] provider returned error=${idpError} ${url.searchParams.get("error_description") ?? ""}`);
  }
  if (!tx) {
    console.error(
      "[auth] no oauth transaction cookie on callback — likely a cookie issue " +
        "(MINIGIT_BASE_URL scheme vs how you're actually reaching the site, or a " +
        "host mismatch between /auth/login and /auth/callback).",
    );
  }

  const currentUrl = `${config.baseUrl}/auth/callback${url.search}`;

  let session: string | null = null;
  try {
    session = await finishLogin(currentUrl, tx);
  } catch (err) {
    const e = err as {
      error?: string;
      error_description?: string;
      message?: string;
    };
    console.error(
      "[auth] callback failed:",
      e?.error ? `error=${e.error}` : "",
      e?.error_description ? `desc=${e.error_description}` : "",
      err instanceof Error ? e.message : err,
    );
  }

  if (!session) {
    const message =
      idpError === "access_denied"
        ? "Your SSO account isn't allowed to use this instance. Ask an SSO admin to add you to its allowed groups."
        : "Could not complete sign-in. Please try again.";
    fail("login failed", message, 403);
  }

  cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: config.baseUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
  redirect(303, "/");
};
