/* src/lib/server/mirrorview.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// How a mirror's last check reads on the repository page. Each glyph names a
// Material outline icon, which the page maps to its component

import { ago } from "../index.ts";
import { mirrorSlug } from "./urls.ts";
import type { MirrorLink } from "./gitref.ts";
import type { MirrorStatus } from "./mirror.ts";

const MIRROR_LABELS: Record<string, { label: string; glyph: string; cls: string }> = {
  synced: {
    label: "Up to date",
    glyph: "check-circle",
    cls: "good",
  },
  ahead: {
    label: "Mirror behind",
    glyph: "arrow-upward",
    cls: "warn",
  },
  behind: {
    label: "Local behind",
    glyph: "arrow-downward",
    cls: "warn",
  },
  diverged: {
    label: "Diverged",
    glyph: "warning",
    cls: "bad",
  },
  out_of_sync: {
    label: "Out of sync",
    glyph: "warning",
    cls: "bad",
  },
  denied: {
    label: "Private or missing",
    glyph: "lock",
    cls: "warn",
  },
  missing: {
    label: "Repository missing",
    glyph: "cancel",
    cls: "bad",
  },
};

const UNKNOWN_STATE = {
  label: "Unavailable",
  glyph: "help-outline",
  cls: "bad",
};

// A verified state older than this is flagged as stale
const STALE_AFTER = 24 * 3600;

export interface MirrorRow {
  kind: string;
  url: string;
  slug: string;
  label: string;
  glyph: string;
  cls: string;
  sha: string;
  detail: string;
  note: string;
  noteCls: string;
}

export function describeMirror(link: MirrorLink, status: MirrorStatus | null, nowSec: number): MirrorRow {
  const shown = {
    kind: link.kind,
    url: link.url,
    slug: mirrorSlug(link.kind, link.url),
  };
  const idle = {
    ...shown,
    glyph: "hourglass",
    cls: "empty",
    sha: "",
    note: "",
    noteCls: "muted",
  };

  if (link.isPrivate) {
    return {
      ...idle,
      label: "Not checked (private)",
      glyph: "lock",
      detail: "status checks are anonymous",
    };
  }
  if (!status || (!status.state && !status.error)) {
    return {
      ...idle,
      label: "not checked yet",
      detail: "",
    };
  }

  const known = (status.state && MIRROR_LABELS[status.state]) || UNKNOWN_STATE;
  const sha = status.remoteSha ? status.remoteSha.slice(0, 7) : "";
  const verifiedAgo = status.okAt !== null ? nowSec - status.okAt : null;
  const stale = verifiedAgo !== null && verifiedAgo > STALE_AFTER;

  if (status.error) {
    let note = `${link.kind}: check failed ${ago(nowSec - status.checkedAt)} ago (${status.error})`;
    if (verifiedAgo !== null) {
      note += stale
        ? ` — NOT VERIFIED for ${ago(verifiedAgo)}`
        : ` — showing last verified state from ${ago(verifiedAgo)} ago`;
    }
    return {
      ...shown,
      ...known,
      cls: status.state ? "empty" : "bad",
      sha,
      detail: verifiedAgo !== null ? `last verified ${ago(verifiedAgo)} ago` : "never verified",
      note,
      noteCls: stale || verifiedAgo === null ? "bad" : "warn",
    };
  }

  return {
    ...shown,
    ...known,
    sha,
    detail: [status.detail, verifiedAgo !== null ? `checked ${ago(verifiedAgo)} ago` : ""]
      .filter(Boolean)
      .join(" · "),
    note: stale ? `${link.kind}: not verified for ${ago(verifiedAgo!)}` : "",
    noteCls: "bad",
  };
}
