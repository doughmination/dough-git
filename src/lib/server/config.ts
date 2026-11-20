/* src/lib/server/config.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import process from "node:process";

// From .env, which both `deno task dev` and deploy/run hand to Deno
function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
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

  reposRoot: optional("MINIGIT_REPOS_ROOT", "./data/repos"),
  dbPath: optional("MINIGIT_DB_PATH", "./data/dough-git.db"),
  publicMarker: optional("MINIGIT_PUBLIC_MARKER", "minigit-public"),

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
