/* src/app.d.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import type { SessionUser } from "#lib/server/auth.ts";

declare global {
  namespace App {
    interface Error {
      message: string;
      title?: string;
    }

    interface Locals {
      user: SessionUser | null;
    }
  }
}

// <iconsax-icon> is registered by `import "iconsax"` in src/hooks.client.ts
declare module "svelte/elements" {
  export interface SvelteHTMLElements {
    "iconsax-icon": HTMLAttributes<HTMLElement> & {
      name: string;
      type?: "bold" | "broken" | "bulk" | "linear" | "outline" | "twotone";
      size?: number | string;
      color?: string;
      pro?: boolean;
    };
  }
}

export {};
