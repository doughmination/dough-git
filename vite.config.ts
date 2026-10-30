/* vite.config.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: {
        // Runes everywhere except libraries
        runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
      },
      // worker/index.ts wraps the Worker this produces, adding the container and cron
      adapter: adapter({
        config: "wrangler.kit.jsonc",
      }),
      csp: {
        mode: "auto",
        directives: {
          "default-src": ["self"],
          "script-src": ["self"],
          // Two exact style attributes only: iconsax's color:currentColor on every icon,
          // and SvelteKit's visually-hidden route announcer
          "style-src": [
            "self",
            "unsafe-hashes",
            "sha256-muhGX4Mn7np2XQi6DH6Iz+0SHdws6/BLgVigE46O3Xc=",
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
  ],
  // iconsax fetches its icon data relative to its own file, which pre-bundling breaks
  optimizeDeps: {
    exclude: ["iconsax"],
  },
});
