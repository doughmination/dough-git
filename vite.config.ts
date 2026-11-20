/* vite.config.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import adapter from "@deno/svelte-adapter";
import { sveltekit } from "@sveltejs/kit/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import Icons from "unplugin-icons/vite";

export default defineConfig({
  resolve: {
    // Kit 3 only reads `#lib` from package.json imports, and this project has none
    alias: [
      {
        find: /^#lib$/,
        replacement: fileURLToPath(new URL("./src/lib/index.ts", import.meta.url)),
      },
      {
        find: /^#lib\//,
        replacement: fileURLToPath(new URL("./src/lib/", import.meta.url)),
      },
    ],
  },
  plugins: [
    sveltekit({
      compilerOptions: {
        // Runes everywhere except libraries
        runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
      },
      adapter: adapter(),
      // Inspector breaks under Deno's symlinked node_modules (its CSS fails to load)
      inspector: false,
      csp: {
        mode: "auto",
        directives: {
          "default-src": ["self"],
          "script-src": ["self"],
          // One exact style attribute only: SvelteKit's visually-hidden route announcer
          "style-src": [
            "self",
            "unsafe-hashes",
            "sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo=",
          ],
          "img-src": ["self", "data:", "https:"],
          "font-src": ["self", "https://raw.doughmination.gay"],
          "connect-src": ["self"],
          // hooks.server.ts adds the SSO origin, which is only known at runtime
          "form-action": ["self"],
          "frame-ancestors": ["none"],
          "base-uri": ["none"],
          "object-src": ["none"],
        },
      },
    }),
    // Turns each `~icons/<set>/<name>` import into an inline-SVG Svelte component at build time
    Icons({
      compiler: "svelte",
      scale: 1,
    }),
  ],
});
