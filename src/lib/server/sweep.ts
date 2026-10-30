/* src/lib/server/sweep.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Run by the cron trigger in worker/index.ts, every six hours

import { purgeExpiredSessions } from "./sessions.ts";
import { purgeAllExpired } from "./git.ts";
import { clearRepoMetadata } from "./repometa.ts";

async function sweepSessions(): Promise<void> {
  try {
    const purged = await purgeExpiredSessions();
    if (purged) console.log(`[auth] purged ${purged} expired sessions`);
  } catch (err) {
    console.warn("[auth] session sweep failed:", err);
  }
}

async function sweepTrash(): Promise<void> {
  try {
    for (const gone of await purgeAllExpired()) {
      await clearRepoMetadata({
        owner: gone.owner,
        name: gone.name,
      });
      console.log(`[trash] expired ${gone.owner}/${gone.name}`);
    }
  } catch (err) {
    console.warn("[trash] scheduled sweep failed:", err);
  }
}

export async function sweep(): Promise<void> {
  await Promise.all([
    sweepSessions(),
    sweepTrash(),
  ]);
}
