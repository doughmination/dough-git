/* src/lib/server/db.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// The schema lives in migrations/; apply it with `wrangler d1 migrations apply`

import { env } from "cloudflare:workers";

export function db(): D1Database {
  return env.DB;
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}
