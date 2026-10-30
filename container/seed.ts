/* container/seed.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// One-off: copies an existing repos root into R2, for moving off the old server.
//   MINIGIT_REPOS_ROOT=/srv/git R2_ENDPOINT=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… bun container/seed.ts

import { uploadAll } from "./store.ts";

await uploadAll();
console.log("[seed] done");
