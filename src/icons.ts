/* src/icons.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

export type IconWeight =
  | "thin"
  | "light"
  | "regular"
  | "bold"
  | "fill"
  | "duotone";

const require = createRequire(import.meta.url);
const cache = new Map<string, { viewBox: string; body: string }>();

// "house" + "bold" -> "@phosphor-icons/core/bold/house-bold.svg"
function assetPath(name: string, weight: IconWeight): string {
  const fileName = weight === "regular" ? name : `${name}-${weight}`;
  return `@phosphor-icons/core/${weight}/${fileName}.svg`;
}

function parse(
  name: string,
  weight: IconWeight,
): { viewBox: string; body: string } {
  const cacheKey = `${name}:${weight}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  let source: string;
  try {
    source = readFileSync(require.resolve(assetPath(name, weight)), "utf8");
  } catch {
    throw new Error(`icon: unknown phosphor icon "${name}" (${weight})`);
  }

  const viewBox = /viewBox="([^"]+)"/.exec(source)?.[1] ?? "0 0 256 256";
  const body = source
    .slice(source.indexOf(">") + 1, source.lastIndexOf("</svg>"))
    .replace(/\s*\n\s*/g, "")
    .replace(/>\s+</g, "><")
    .trim();

  const parsed = {
    viewBox,
    body,
  };
  cache.set(cacheKey, parsed);
  return parsed;
}

export function icon(
  name: string,
  size = 16,
  weight: IconWeight = "regular",
): string {
  const { viewBox, body } = parse(name, weight);
  return `<svg class="icon" viewBox="${viewBox}" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${body}</svg>`;
}