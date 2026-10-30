/* worker/index.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// SvelteKit serves every request; this adds the git container and the cron sweep.
// The class lives here, not re-exported: esbuild drops a re-export it can't prove is a value

import { Container } from "@cloudflare/containers";
// @ts-ignore: produced by `vite build`, so it only exists after one
import kit from "../.svelte-kit/cloudflare/_worker.js";
import { sweep } from "../src/lib/server/sweep.ts";

// Set with `wrangler secret put`, so `wrangler types` can't see them
interface Secrets {
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}

// The git agent (container/server.ts). It sleeps when idle, and rebuilds its
// disk from the R2 snapshots when it wakes
export class GitContainer extends Container<Env> {
  defaultPort = 4011;
  sleepAfter = "30m";

  constructor(ctx: DurableObjectState<{}>, env: Env & Secrets) {
    super(ctx, env);
    this.envVars = {
      MINIGIT_PUBLIC_MARKER: env.MINIGIT_PUBLIC_MARKER,
      MINIGIT_TRASH_DAYS: env.MINIGIT_TRASH_DAYS,
      R2_ENDPOINT: env.R2_ENDPOINT,
      R2_BUCKET: env.R2_BUCKET,
      R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    };
  }
}

export default {
  fetch: (kit as ExportedHandler<Env>).fetch,

  scheduled(_controller, _env, ctx) {
    ctx.waitUntil(sweep());
  },
} satisfies ExportedHandler<Env>;
