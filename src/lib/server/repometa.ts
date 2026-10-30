/* src/lib/server/repometa.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { dropRepoAccess } from "./access.ts";
import { dropMirrorStatus } from "./mirror.ts";
import type { RepoRef } from "./gitref.ts";

export async function clearRepoMetadata(ref: RepoRef): Promise<void> {
  await dropRepoAccess(ref);
  await dropMirrorStatus(ref);
}
