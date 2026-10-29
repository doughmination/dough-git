/* serve.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Runs the built SvelteKit app on Bun.serve. adapter-node's own server caps
// request bodies and idles connections out; a big push or clone needs neither

import { join, normalize } from "node:path";
import { config } from "./src/lib/server/config.ts";

const BUILD = join(import.meta.dir, "build");
const CLIENT = join(BUILD, "client");

// adapter-node's build exposes the SvelteKit server it would have wrapped
const { server } = await import(join(BUILD, "adapter-node.js"));

await server.init({
  env: process.env,
  read: (file: string) => Bun.file(join(CLIENT, file)).stream(),
});

const SITE = new URL(config.baseUrl);

// Hashed build output never changes under the same name
function cacheFor(path: string): string {
  return path.startsWith("/_app/immutable/") ? "public, max-age=31536000, immutable" : "public, max-age=3600";
}

async function staticFile(pathname: string): Promise<Response | null> {
  let path: string;
  try {
    path = normalize(decodeURIComponent(pathname));
  } catch {
    return null;
  }
  if (path.includes("\0") || path.includes("..") || path === "/") return null;

  const file = Bun.file(join(CLIENT, path));
  if (!(await file.exists())) return null;

  return new Response(file, {
    headers: {
      "Cache-Control": cacheFor(path),
    },
  });
}

Bun.serve({
  port: config.port,
  hostname: config.host,
  // Big pushes and imports can sit quiet for minutes; never cut them off
  idleTimeout: 0,
  maxRequestBodySize: Number.MAX_SAFE_INTEGER,

  async fetch(request, bun) {
    const url = new URL(request.url);

    if (request.method === "GET" || request.method === "HEAD") {
      const asset = await staticFile(url.pathname);
      if (asset) return asset;
    }

    // SvelteKit sees the public URL, so its own origin checks match what browsers send
    const publicUrl = new URL(url.pathname + url.search, SITE);
    const forwarded = new Request(publicUrl, request);

    return server.respond(forwarded, {
      getClientAddress: () => bun.requestIP(request)?.address ?? "",
      platform: {},
    });
  },
});

console.log(`dough-git listening on http://${config.host}:${config.port}`);
console.log(`  repos root: ${config.reposRoot}`);
console.log(`  base url:   ${config.baseUrl}`);
