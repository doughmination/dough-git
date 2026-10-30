/* container/config.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  reposRoot: optional("MINIGIT_REPOS_ROOT", "/srv/git"),
  port: Number(optional("GIT_AGENT_PORT", "4011")),
  publicMarker: optional("MINIGIT_PUBLIC_MARKER", "minigit-public"),
  trashDays: Math.max(0, Number(optional("MINIGIT_TRASH_DAYS", "30")) || 0),

  // R2's S3 API; repos are snapshotted there because container disks don't survive a sleep
  r2: {
    endpoint: optional("R2_ENDPOINT", ""),
    bucket: optional("R2_BUCKET", "dough-git"),
    accessKeyId: optional("R2_ACCESS_KEY_ID", ""),
    secretAccessKey: optional("R2_SECRET_ACCESS_KEY", ""),
  },
} as const;
