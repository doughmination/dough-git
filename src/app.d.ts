/* src/app.d.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

/// <reference types="unplugin-icons/types/svelte5" />

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

export {};
