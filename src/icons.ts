/* src/icons.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Stroke width in rendered pixels, kept constant at every size
// (lucide's absoluteStrokeWidth behaviour)
const STROKE_WIDTH = 2.25;
const GRID = 24;

const require = createRequire(import.meta.url);
const cache = new Map<string, string>();

// "house" -> "lucide-static/icons/house.svg"
function assetPath(name: string): string {
  return `lucide-static/icons/${name}.svg`;
}

function parse(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  let source: string;
  try {
    source = readFileSync(require.resolve(assetPath(name)), "utf8");
  } catch {
    throw new Error(`icon: unknown lucide icon "${name}"`);
  }

  // Skip the licence comment and the <svg ...> open tag
  const open = source.indexOf("<svg");
  const body = source
    .slice(source.indexOf(">", open) + 1, source.lastIndexOf("</svg>"))
    .replace(/\s*\n\s*/g, " ")
    .replace(/>\s+</g, "><")
    .trim();

  cache.set(name, body);
  return body;
}

export function icon(name: string, size = 16): string {
  const body = parse(name);
  const stroke = +((STROKE_WIDTH * GRID) / size).toFixed(3);
  return `<svg class="icon" viewBox="0 0 ${GRID} ${GRID}" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
