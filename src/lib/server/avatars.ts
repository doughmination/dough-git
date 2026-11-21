/* src/lib/server/avatars.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Uploaded avatars, one file per user named by slug. The type is read from the bytes, never trusted from the upload

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.ts";
import { db, now } from "./db.ts";

export const AVATAR_MAX_BYTES = 4 * 1024 * 1024;

export type AvatarType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** The image type from the file's magic bytes, or null for anything else */
export function sniffImage(bytes: Uint8Array): AvatarType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // "GIF87a" or "GIF89a"
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    return "image/gif";
  }
  // "RIFF" .... "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

function avatarPath(slug: string): string {
  return join(config.avatarsDir, slug);
}

/** Stores the avatar and points users.picture at it. False when the bytes aren't an allowed image */
export async function saveAvatar(slug: string, bytes: Uint8Array): Promise<boolean> {
  if (bytes.length === 0 || bytes.length > AVATAR_MAX_BYTES || !sniffImage(bytes)) return false;

  await mkdir(config.avatarsDir, { recursive: true });
  await writeFile(avatarPath(slug), bytes);

  const stamp = now();
  // Absolute, so Discord embeds can fetch it; ?v= busts caches on every upload
  const picture = `${config.baseUrl}/avatars/${slug}?v=${stamp}`;
  await db()
    .prepare("UPDATE users SET picture = ?, avatar_at = ? WHERE slug = ?")
    .bind(picture, stamp, slug)
    .run();
  return true;
}

/** Drops the upload; the SSO picture comes back on the next sign-in */
export async function removeAvatar(slug: string): Promise<void> {
  await unlink(avatarPath(slug)).catch(() => {});
  await db()
    .prepare("UPDATE users SET picture = NULL, avatar_at = NULL WHERE slug = ?")
    .bind(slug)
    .run();
}

export async function readAvatar(slug: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: AvatarType } | null> {
  const file = await readFile(avatarPath(slug)).catch(() => null);
  if (!file) return null;

  // A copy on a plain ArrayBuffer, which is what Response accepts as a body
  const bytes = new Uint8Array(file);

  const type = sniffImage(bytes);
  return type
    ? {
        bytes,
        type,
      }
    : null;
}
