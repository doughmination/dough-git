/* vite.config.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

// The build imports server modules to analyse them; keep it off the real database
if (process.argv.includes("build")) process.env.MINIGIT_DB_PATH = ":memory:";

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: {
        // Runes everywhere except libraries
        runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
      },
      // serve.ts runs the built app on Bun.serve; this adapter only produces the build
      adapter: adapter(),
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
