/* src/routes/auth/login/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { config, oidcEnabled } from "#lib/server/config.ts";
import { OAUTH_COOKIE, startLogin } from "#lib/server/auth.ts";
import { fail } from "#lib/server/web.ts";

export const load: PageServerLoad = async ({ cookies }) => {
  if (!oidcEnabled) {
    fail("login unavailable", "Single sign-on (OIDC) is not configured on this instance.", 501);
  }

  const { redirectUrl, txCookie } = await startLogin();
  cookies.set(OAUTH_COOKIE, txCookie, {
    httpOnly: true,
    secure: config.baseUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  // Off-site, but only ever to the SSO
  redirect(303, redirectUrl, {
    external: [new URL(config.oidc.issuer).origin],
  });
};
