/* src/routes/auth/logout/+page.server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { config } from "#lib/server/config.ts";
import { SESSION_COOKIE, logout } from "#lib/server/auth.ts";

// POST so a stray link or image can't sign anyone out
export const load: PageServerLoad = () => redirect(303, "/");

export const actions: Actions = {
  default: async ({ cookies }) => {
    const target = await logout(cookies.get(SESSION_COOKIE));
    cookies.delete(SESSION_COOKIE, { path: "/" });

    // Home, or on to the SSO's own logout
    const allowed = [new URL(config.baseUrl).origin];
    if (config.oidc.issuer) allowed.push(new URL(config.oidc.issuer).origin);
    redirect(303, target, {
      external: allowed,
    });
  },
};
