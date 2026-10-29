/* src/lib/index.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Formatting shared by pages; safe on the client

export const mainSite = "https://doughmination.gay";

export function fmtDate(unix: number | null | undefined): string {
  if (!unix) return "";
  return new Date(unix * 1000).toISOString().slice(0, 16).replace("T", " ");
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ago(seconds: number): string {
  if (seconds < 90) return `${Math.max(0, Math.round(seconds))}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export interface Profile {
  name: string | null;
  username: string | null;
  picture: string | null;
}

export function displayName(profile: Profile & { sub?: string }): string {
  return profile.name ?? profile.username ?? profile.sub ?? "user";
}

/** Clips text for <meta name="description"> */
export function metaText(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}
