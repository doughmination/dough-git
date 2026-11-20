/* src/lib/server/background.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Work that outlives its response, like Discord notifications. A long-running
// server keeps it alive on its own; this just tracks it so tests can wait for it

const pending = new Set<Promise<unknown>>();

export function background(work: Promise<unknown>): void {
  const tracked = work
    .catch((err) => {
      console.error("[background]", err);
    })
    .finally(() => {
      pending.delete(tracked);
    });
  pending.add(tracked);
}

/** Waits for everything handed to background() so far, including what that work queued */
export async function settle(): Promise<void> {
  while (pending.size) await Promise.allSettled([...pending]);
}
