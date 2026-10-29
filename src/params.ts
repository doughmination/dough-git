/* src/params.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { defineParams } from "@sveltejs/kit/params";

export const params = defineParams({
  // A repository name: anything but the owner's repository listing
  repo: (param) => (param !== "+repos" ? param : undefined),

  // The owner's full repository listing, /<owner>/+repos
  repos: (param) => (param === "+repos" ? param : undefined),
});
