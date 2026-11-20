/* deploy/server.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import rawDeployConfig from "../.deno-deploy/deploy.json" with { type: "json" };
import rawSvelteData from "../.deno-deploy/svelte.json" with { type: "json" };
import { prepareServer } from "../.deno-deploy/handler.ts";

// The adapter's own server.ts binds 0.0.0.0:8000, so this one honours HOST and PORT
const hostname = Deno.env.get("HOST") ?? "127.0.0.1";
const port = Number(Deno.env.get("PORT") ?? "3102");

const handler = prepareServer(rawSvelteData, rawDeployConfig, Deno.cwd());

Deno.serve(
  {
    hostname,
    port,
  },
  handler,
);
