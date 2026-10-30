/* src/lib/server/config.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { building } from "$app/env";
import { env } from "cloudflare:workers";

// Vars and secrets from wrangler.jsonc, or .dev.vars locally. The build has no
// bindings, and touching them there throws
const vars: Record<string, string | undefined> = building ? {} : (env as unknown as Record<string, string>);

function optional(name: string, fallback: string): string {
  return vars[name] ?? fallback;
}

export const config = {
  baseUrl: optional("MINIGIT_BASE_URL", "http://localhost:5173"),
  title: optional("MINIGIT_TITLE", "dough-git"),

  favicon: optional(
    "MINIGIT_FAVICON",
    "/favicon.png",
  ),

  description: optional(
    "MINIGIT_DESCRIPTION",
    "A minimal self-hosted git mirror.",
  ),

  themeColor: optional("MINIGIT_THEME_COLOR", "#eb459e"),

  autoCreate: optional("MINIGIT_AUTO_CREATE", "true") !== "false",

  trashDays: Math.max(0, Number(optional("MINIGIT_TRASH_DAYS", "30")) || 0),

  oidc: {
    issuer: optional("OIDC_ISSUER", "").replace(/\/+$/, ""),
    clientId: optional("OIDC_CLIENT_ID", ""),
    clientSecret: optional("OIDC_CLIENT_SECRET", ""),
    adoptLegacyUsers: optional("OIDC_ADOPT_LEGACY_USERS", "true") !== "false",
  },

  sessionSecret: optional("SESSION_SECRET", "dev-insecure-secret-change-me"),
} as const;

export const oidcEnabled =
  Boolean(config.oidc.issuer) &&
  Boolean(config.oidc.clientId) &&
  Boolean(config.oidc.clientSecret);
