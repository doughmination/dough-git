/* src/views.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { config } from "./config.ts";
import { icon } from "./icons.ts";
import { escapeHtml as esc, renderMarkdown, plainSummary } from "./markdown.ts";
import { accountUrl, sessionSlug, type SessionUser } from "./auth.ts";
import { maskWebhook, mirrorHost, mirrorSlug, MIRROR_KINDS, type MirrorKind } from "./urls.ts";
import type { CollaboratorRow } from "./access.ts";
import type { TokenRow } from "./tokens.ts";
import type { UserRow } from "./users.ts";
import type { Settings } from "./settings.ts";
import { PROFILE_REPO, PROFILE_REPOS_PATH } from "./git.ts";
import type {
  RepoSummary,
  Commit,
  TreeEntry,
  CommitDetail,
  Readme,
  RefList,
  TrashEntry,
  MirrorLink,
} from "./git.ts";
import type { MirrorStatus } from "./mirror.ts";

function fmtDate(unix: number | null): string {
  if (!unix) return "";
  return new Date(unix * 1000).toISOString().slice(0, 16).replace("T", " ");
}

function base(owner: string, name: string): string {
  return `/${esc(owner)}/${esc(name)}`;
}

function cloneUrl(owner: string, name: string): string {
  return `${config.baseUrl}/${owner}/${name}.git`;
}

function revQuery(rev: string, head: string): string {
  return rev === head ? "" : `?h=${encodeURIComponent(rev)}`;
}

function visibility(isPublic: boolean): string {
  return `<span class="with-icon">${icon(isPublic ? "lock-open" : "lock", 13)}${isPublic ? "public" : "private"}</span>`;
}

// [id, label, icon, href] rows rendered as a tab strip
function tabs(active: string, items: [string, string, string, string][]): string {
  const links = items.map(
    ([id, label, glyph, href]) =>
      `<a class="tab${id === active ? " active" : ""}" href="${href}">${icon(glyph)}${label}</a>`,
  );
  return `    <nav class="tabs">${links.join("")}</nav>`;
}

function revPicker(refs: RefList, rev: string): string {
  const all = [...refs.branches, ...refs.tags];
  if (all.length === 0 || (all.length < 2 && all.includes(rev))) return "";

  const options = (names: string[], label: string): string => {
    if (names.length === 0) return "";
    const items = names
      .map((name) => `<option value="${esc(name)}"${name === rev ? " selected" : ""}>${esc(name)}</option>`)
      .join("");
    return `<optgroup label="${label}">${items}</optgroup>`;
  };

  const detached = all.includes(rev)
    ? ""
    : `<option value="${esc(rev)}" selected>${esc(rev.slice(0, 10))}</option>`;

  return `<form method="get" class="row rev-picker">
      <label class="label with-icon" for="rev-picker">${icon("git-branch")}revision</label>
      <select id="rev-picker" name="h" data-autosubmit>
        ${detached}${options(refs.branches, "branches")}${options(refs.tags, "tags")}
      </select>
      <button type="submit">${icon("arrow-right")}go</button>
    </form>`;
}

function metaText(s: string, max = 200): string {
  const flat = s.replace(/\s+/g, " ").trim();
  const clipped =
    flat.length > max ? flat.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : flat;
  return esc(clipped);
}

interface Profile {
  name: string | null;
  username: string | null;
  picture: string | null;
}

function displayName(p: Profile & { sub?: string }): string {
  return p.name ?? p.username ?? p.sub ?? "user";
}

function avatar(p: Profile, size: "sm" | "lg"): string {
  const initial = esc(displayName(p).trim().slice(0, 1).toUpperCase() || "?");
  const img = p.picture ? `<img src="${esc(p.picture)}" alt="" loading="lazy" data-avatar>` : "";
  return `<span class="avatar avatar-${size}">${initial}${img}</span>`;
}

function layout(opts: {
  title: string;
  user: SessionUser | null;
  body: string;
  description?: string;
  path?: string;
  noindex?: boolean;
}): string {
  const whoami = opts.user
    ? `<a class="user" href="/${esc(sessionSlug(opts.user))}">${avatar(opts.user, "sm")}${esc(displayName(opts.user))}</a>`
    : "";
  const nav = opts.user
    ? `<a class="nav-link" href="/new">${icon("plus")}new</a>
       <a class="nav-link" href="/settings">${icon("gear")}settings</a>
       <form method="post" action="/auth/logout" class="nav-form">
         <button type="submit" class="nav-link nav-button">${icon("sign-out")}logout</button>
       </form>`
    : `<a class="nav-link" href="/auth/login">${icon("sign-in")}login</a>`;

  const description = metaText(opts.description || config.description);
  const url = esc(config.baseUrl + (opts.path ?? ""));
  const faviconUrl = esc(config.favicon);
  const logo = config.favicon
    ? `<img class="site-logo" src="${faviconUrl}" alt="" width="24" height="24">`
    : icon("git-branch", 20);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(opts.title)}</title>
  <meta name="description" content="${description}">
  <meta name="theme-color" content="${esc(config.themeColor)}">
  <meta name="generator" content="dough-git">
  ${opts.noindex ? `<meta name="robots" content="noindex, nofollow">` : `<link rel="canonical" href="${url}">`}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(config.title)}">
  <meta property="og:title" content="${esc(opts.title)}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${faviconUrl}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="${faviconUrl}">
  <link rel="apple-touch-icon" href="${faviconUrl}">
  <link rel="stylesheet" href="/static/style.css">
  <script src="/static/app.js" defer></script>
</head>
<body>
  <header class="site-header">
    <a class="site-title" href="/">${logo}${esc(config.title)}</a>
    <div class="site-who">${whoami}</div>
    <nav class="site-nav">${nav}</nav>
  </header>
  <main class="content">
${opts.body}
  </main>
  <footer class="site-footer">
    <span class="with-icon">${icon("git-merge")}dough-git &middot; a minimal git mirror</span>
  </footer>
</body>
</html>`;
}

// A table with a header row, or one full-width "empty" cell
function table(headers: string[], rows: string[], empty: string): string {
  const head = headers.length
    ? `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`
    : "";
  const span = Math.max(1, headers.length);
  const body = rows.join("\n") || `<tr><td colspan="${span}" class="empty">${esc(empty)}</td></tr>`;
  return `<table>${head}
      <tbody>
${body}
      </tbody>
    </table>`;
}

function repoTable(
  repos: RepoSummary[],
  opts: {
    showOwner: boolean;
    empty: string;
    sharedSlugs?: Set<string> | null;
  },
): string {
  const rows = repos.map((r) => {
    const owner = opts.showOwner
      ? `<a class="muted" href="/${esc(r.owner)}">${esc(r.owner)}</a>/`
      : "";
    const shared = opts.sharedSlugs?.has(`${r.owner}/${r.name}`)
      ? `<span class="badge">${icon("users", 11)}shared</span>`
      : "";
    return `      <tr>
        <td class="repo-name">${icon("git-branch")} ${owner}<a href="${base(r.owner, r.name)}/">${esc(r.name)}</a>${shared}</td>
        <td class="muted">${esc(r.description)}</td>
        <td class="mono">${visibility(r.isPublic)}</td>
        <td class="mono">${fmtDate(r.lastCommit)}</td>
      </tr>`;
  });
  return table(["repository", "description", "visibility", "updated"], rows, opts.empty);
}

export function repoListPage(
  repos: RepoSummary[],
  user: SessionUser | null,
  sharedSlugs: Set<string> | null,
): string {
  const body = `    <h1 class="page-title">repositories</h1>
    ${repoTable(repos, {
      showOwner: true,
      empty: "no repositories visible",
      sharedSlugs,
    })}`;
  return layout({
    title: config.title,
    user,
    body,
    path: "/",
  });
}

export function newRepoPage(user: SessionUser): string {
  const owner = esc(sessionSlug(user));
  const body = `    <h1 class="page-title">new repository</h1>

    <h2 class="section-title">${icon("folder-plus")}empty repository</h2>
    <form method="post" action="/new" class="box row">
      <span class="mono">${owner}/</span>
      <input class="grow" type="text" name="name" placeholder="my-project" pattern="[A-Za-z0-9._-]+" required>
      <button type="submit">${icon("plus")}create</button>
    </form>

    <h2 class="section-title">${icon("download")}import from another forge</h2>
    <p class="muted">Copies every branch and tag from a public repository on GitHub, Codeberg,
    GitLab, or any other forge. The import is a one-off copy, not a live mirror.</p>
    <form method="post" action="/new/import" class="box">
      <p class="row">
        <label class="label with-icon" for="import-url">${icon("link")}clone url</label>
        <input id="import-url" class="grow" type="url" name="url" required
          placeholder="https://codeberg.org/owner/repo.git" autocapitalize="off" spellcheck="false">
      </p>
      <p class="row">
        <label class="label with-icon" for="import-name">${icon("tag")}name</label>
        <span class="mono">${owner}/</span>
        <input id="import-name" class="grow" type="text" name="name" pattern="[A-Za-z0-9._-]+"
          placeholder="leave blank to use the source name">
      </p>
      <button type="submit">${icon("download")}import</button>
    </form>`;
  return layout({
    title: "new repository",
    user,
    body,
    noindex: true,
  });
}

const PROFILE_PREVIEW = 6;

function ownerName(owner: string, profile: UserRow | null): string {
  return profile ? displayName(profile) : owner;
}

function ownerHead(owner: string, profile: UserRow | null): string {
  const handle =
    profile?.username && profile.username !== profile.slug ? profile.username : null;

  const known = profile
    ? `<p class="muted">@${esc(profile.slug)}${handle ? ` &middot; ${esc(handle)}` : ""} &middot; joined ${fmtDate(profile.created_at).slice(0, 10)}</p>`
    : `<p class="muted">@${esc(owner)} &middot; no account on this instance</p>`;

  const fallback = {
    name: owner,
    username: null,
    picture: null,
  };

  return `    <section class="profile-head">
      ${avatar(profile ?? fallback, "lg")}
      <div>
        <h1 class="profile-name">${esc(ownerName(owner, profile))}</h1>
        ${known}
      </div>
    </section>`;
}

function ownerTabs(owner: string, active: "profile" | "repos"): string {
  return tabs(active, [
    ["profile", "profile", "user", `/${esc(owner)}`],
    ["repos", "repositories", "git-branch", `/${esc(owner)}/${PROFILE_REPOS_PATH}`],
  ]);
}

export function profilePage(opts: {
  owner: string;
  profile: UserRow | null;
  repos: RepoSummary[];
  readme: Readme | null;
  hasProfileRepo: boolean;
  isOwn: boolean;
  user: SessionUser | null;
}): string {
  const name = ownerName(opts.owner, opts.profile);
  const preview = opts.repos.slice(0, PROFILE_PREVIEW);
  const profileHref = `/${esc(opts.owner)}/${esc(PROFILE_REPO)}/`;

  let readmeSection = "";
  if (opts.readme) {
    readmeSection = `    <article class="readme">
${renderMarkdown(opts.readme.text)}
    </article>`;
    if (opts.isOwn) {
      readmeSection += `\n    <p class="muted"><a href="${profileHref}">${esc(PROFILE_REPO)}/${esc(opts.readme.path)}</a></p>`;
    }
  } else if (opts.isOwn && opts.hasProfileRepo) {
    readmeSection = `    <p class="box muted">${icon("file")} <a href="${profileHref}">${esc(PROFILE_REPO)}</a> has no <code>README.md</code> yet. Push one and it shows up here.</p>`;
  } else if (opts.isOwn) {
    readmeSection = `    <form method="post" action="/new" class="box row">
      <input type="hidden" name="name" value="${esc(PROFILE_REPO)}">
      <label class="label with-icon">${icon("file")}profile readme</label>
      <span class="muted">Create <code>${esc(PROFILE_REPO)}</code> and its README.md shows up here.</span>
      <button type="submit">${icon("plus")}create</button>
    </form>`;
  }

  const moreLink =
    opts.repos.length > preview.length
      ? `    <p class="muted"><a href="/${esc(opts.owner)}/${PROFILE_REPOS_PATH}">all ${opts.repos.length} repositories &rarr;</a></p>`
      : "";

  const body = `${ownerHead(opts.owner, opts.profile)}
${ownerTabs(opts.owner, "profile")}
${readmeSection}
    <h2 class="section-title">repositories</h2>
    ${repoTable(preview, { showOwner: false, empty: "nothing here yet" })}
${moreLink}`;

  return layout({
    title: name,
    user: opts.user,
    body,
    description: opts.readme
      ? metaText(plainSummary(opts.readme.text))
      : `${name} (@${opts.owner}) on ${config.title}.`,
    path: `/${opts.owner}`,
    noindex: !opts.repos.some((r) => r.isPublic) && !opts.readme,
  });
}

export function reposPage(opts: {
  owner: string;
  profile: UserRow | null;
  repos: RepoSummary[];
  user: SessionUser | null;
}): string {
  const name = ownerName(opts.owner, opts.profile);

  const body = `${ownerHead(opts.owner, opts.profile)}
${ownerTabs(opts.owner, "repos")}
    <h2 class="section-title">repositories</h2>
    ${repoTable(opts.repos, { showOwner: false, empty: "nothing here yet" })}`;

  return layout({
    title: `${name} repositories`,
    user: opts.user,
    body,
    description: `Repositories owned by ${name} (@${opts.owner}) on ${config.title}.`,
    path: `/${opts.owner}/${PROFILE_REPOS_PATH}`,
    noindex: !opts.repos.some((r) => r.isPublic),
  });
}

function repoNav(owner: string, name: string, active: string, q: string): string {
  const b = base(owner, name);
  return tabs(active, [
    ["summary", "summary", "article", `${b}/${q}`],
    ["log", "log", "git-commit", `${b}/log${q}`],
    ["tree", "tree", "folder", `${b}/tree${q}`],
  ]);
}

export function summaryPage(opts: {
  owner: string;
  name: string;
  isPublic: boolean;
  empty: boolean;
  readme: Readme | null;
  description: string;
  rawDescription: string;
  canPush: boolean;
  collaborators: CollaboratorRow[] | null;
  refs: RefList;
  rev: string;
  user: SessionUser | null;
  links: MirrorLink[];
  mirrorStatuses: Map<string, MirrorStatus>;
  localSha: string | null;
}): string {
  const title = `${opts.owner}/${opts.name}`;
  const b = base(opts.owner, opts.name);
  const q = revQuery(opts.rev, opts.refs.head);
  const pusher = opts.user ? sessionSlug(opts.user) : opts.owner;
  const isOwner = opts.collaborators !== null;

  let pushHint = "";
  if (opts.empty && opts.canPush) {
    pushHint = `    <section class="box">
      <p><strong>This repository is empty.</strong> Push to get started:</p>
      <code>git remote add mirror ${esc(cloneUrl(opts.owner, opts.name))}<br>git push --mirror mirror</code>
      <p class="muted">When prompted, the <strong>username</strong> is <code>${esc(pusher)}</code> and the <strong>password</strong> is a token from <a href="/settings/tokens">settings</a>.</p>
    </section>`;
  } else if (opts.empty) {
    pushHint = `    <p class="box empty">This repository is empty.</p>`;
  }

  let readmeSection = "";
  if (opts.readme) {
    readmeSection = `    <h2 class="section-title">${icon("file-text")}${esc(opts.readme.path)}</h2>
    <article class="readme">
${renderMarkdown(opts.readme.text)}
    </article>`;
  } else if (!opts.empty) {
    readmeSection = `    <h2 class="section-title">${icon("file-text")}readme</h2>
    <p class="empty">No ReadMe was found, commit one to add a summary</p>`;
  }

  const manage = isOwner
    ? `    <h2 class="section-title">${icon("gear")}manage</h2>
    <div class="tabs">
      <form method="post" action="${b}/visibility">
        <input type="hidden" name="public" value="${opts.isPublic ? "" : "on"}">
        <button type="submit">${icon(opts.isPublic ? "lock" : "lock-open")}make ${opts.isPublic ? "private" : "public"}</button>
      </form>
      <form method="post" action="${b}/delete" data-confirm="Delete ${esc(title)}? It moves to Recently Deleted.">
        <button type="submit">${icon("trash")}delete repository</button>
      </form>
    </div>
${collaboratorSection(b, opts.collaborators ?? [])}`
    : "";

  let descriptionForm = "";
  if (opts.canPush) {
    descriptionForm = `    <form method="post" action="${b}/description" class="box row">
      <label class="label with-icon" for="repo-description">${icon("note")}description</label>
      <input id="repo-description" class="grow" type="text" name="description" maxlength="300"
        value="${esc(opts.rawDescription)}" placeholder="what this repository is for">
      <button type="submit">${icon("floppy-disk")}save</button>
    </form>`;
  } else if (opts.rawDescription) {
    descriptionForm = `    <p class="muted">${esc(opts.rawDescription)}</p>`;
  }

  const pushBadge =
    opts.canPush && !isOwner ? `<span class="badge">${icon("upload", 11)}you can push</span>` : "";

  const body = `    <h1 class="repo-title"><a class="muted" href="/${esc(opts.owner)}">${esc(opts.owner)}</a>/${esc(opts.name)}</h1>
    <p class="muted">${visibility(opts.isPublic)}${pushBadge}</p>
${repoNav(opts.owner, opts.name, "summary", q)}
${descriptionForm}
    ${revPicker(opts.refs, opts.rev)}
    <section class="box">
      <span class="label with-icon">${icon("download")}clone</span>
      <code>git clone ${esc(cloneUrl(opts.owner, opts.name))}</code>
    </section>
${pushHint}
${mirrorSection(b, opts.links, opts.mirrorStatuses, opts.localSha, isOwner, opts.canPush)}
${readmeSection}
${manage}`;

  return layout({
    title,
    user: opts.user,
    body,
    description: opts.description,
    path: `/${opts.owner}/${opts.name}`,
    noindex: !opts.isPublic,
  });
}

function kindIcon(kind: MirrorKind): string {
  return icon(kind === "github" ? "github-logo" : "git-branch");
}

function mirrorSection(
  b: string,
  links: MirrorLink[],
  statuses: Map<string, MirrorStatus>,
  localSha: string | null,
  isOwner: boolean,
  canCheck: boolean,
): string {
  if (links.length === 0 && !isOwner) return "";

  const nowSec = Math.floor(Date.now() / 1000);

  const rows = links.map((link) => {
    const view = describeMirror(link, statuses.get(link.kind) ?? null, nowSec);
    const note = view.note ? `\n      <p class="${view.noteCls}">${esc(view.note)}</p>` : "";
    return `      <div class="mirror-row">
        <span class="mirror-kind"><a class="with-icon" href="${esc(link.url)}" rel="nofollow noopener noreferrer">${kindIcon(link.kind)}${esc(mirrorSlug(link.kind, link.url))}</a></span>
        <span class="${view.cls} with-icon">${icon(view.glyph)}${esc(view.label)}</span>
        <span class="mono">${esc(view.sha)}</span>
        <span class="muted">${esc(view.detail)}</span>
      </div>${note}`;
  });

  if (localSha) {
    rows.push(`      <div class="mirror-row">
        <span class="mirror-kind with-icon">${icon("house")}local</span>
        <span class="empty">this repository</span>
        <span class="mono">${esc(localSha.slice(0, 7))}</span>
        <span></span>
      </div>`);
  }

  if (canCheck && links.some((l) => !l.isPrivate)) {
    rows.push(`      <form method="post" action="${b}/mirrors/check">
        <button type="submit">${icon("arrow-clockwise")}check now</button>
      </form>`);
  }

  const list =
    links.length > 0
      ? `    <section class="box">
${rows.join("\n")}
    </section>`
      : `    <p class="empty">No mirrors configured.</p>`;

  const field = (kind: MirrorKind) => {
    const existing = links.find((l) => l.kind === kind);
    return `      <div class="row">
        <label class="label with-icon" for="mirror-${kind}">${kindIcon(kind)}${kind}</label>
        <input id="mirror-${kind}" class="grow" type="text" name="${kind}"
          value="${esc(existing ? mirrorSlug(kind, existing.url) : "")}"
          placeholder="user/repo" pattern="[^\\s/]+/[^\\s/]+/?" autocapitalize="off" spellcheck="false">
        <label><input type="checkbox" name="${kind}_private"${existing?.isPrivate ? " checked" : ""}> private</label>
      </div>`;
  };

  const form = isOwner
    ? `    <form method="post" action="${b}/mirrors" class="box">
${MIRROR_KINDS.map(field).join("\n")}
      <p class="muted">Give the <code>user/repo</code> on ${esc(MIRROR_KINDS.map(mirrorHost).join(" or "))} &mdash; not a full URL.
      Mark a mirror <em>private</em> to skip status checks — they are anonymous, so a private
      mirror would otherwise always look unreachable. Clear a field to remove it.</p>
      <button type="submit">${icon("floppy-disk")}save mirrors</button>
    </form>`
    : "";

  return `    <h2 class="section-title">${icon("hard-drives")}external mirrors</h2>
${list}
${form}`;
}

const MIRROR_LABELS: Record<string, { label: string; glyph: string; cls: string }> = {
  synced: { label: "Up to date", glyph: "check", cls: "good" },
  ahead: { label: "Mirror behind", glyph: "arrow-up", cls: "warn" },
  behind: { label: "Local behind", glyph: "arrow-down", cls: "warn" },
  diverged: { label: "Diverged", glyph: "warning-diamond", cls: "bad" },
  out_of_sync: { label: "Out of sync", glyph: "warning-diamond", cls: "bad" },
  denied: { label: "Private or missing", glyph: "lock", cls: "warn" },
  missing: { label: "Repository missing", glyph: "x", cls: "bad" },
};

const UNKNOWN_STATE = {
  label: "Unavailable",
  glyph: "question",
  cls: "bad",
};

// A verified state older than this is flagged as stale
const STALE_AFTER = 24 * 3600;

function describeMirror(link: MirrorLink, status: MirrorStatus | null, nowSec: number) {
  const idle = {
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
      ...known,
      cls: status.state ? "empty" : "bad",
      sha,
      detail: verifiedAgo !== null ? `last verified ${ago(verifiedAgo)} ago` : "never verified",
      note,
      noteCls: stale || verifiedAgo === null ? "bad" : "warn",
    };
  }

  return {
    ...known,
    sha,
    detail: [status.detail, verifiedAgo !== null ? `checked ${ago(verifiedAgo)} ago` : ""]
      .filter(Boolean)
      .join(" · "),
    note: stale ? `${link.kind}: not verified for ${ago(verifiedAgo!)}` : "",
    noteCls: "bad",
  };
}

function ago(seconds: number): string {
  if (seconds < 90) return `${Math.max(0, Math.round(seconds))}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function collaboratorSection(b: string, collaborators: CollaboratorRow[]): string {
  const action = `${b}/collaborators`;

  const rows = collaborators.map(
    (person) => `      <tr>
        <td>${icon("user", 13)} <a href="/${esc(person.slug)}">${esc(person.slug)}</a></td>
        <td class="mono">${esc(person.level)}</td>
        <td class="mono">${fmtDate(person.added_at)}</td>
        <td>
          <form method="post" action="${action}/remove">
            <input type="hidden" name="slug" value="${esc(person.slug)}">
            <button type="submit">${icon("user-minus")}remove</button>
          </form>
        </td>
      </tr>`,
  );

  return `    <h2 class="section-title">${icon("users")}collaborators</h2>
    <p class="muted">People here can see this repository even while it is
    private. <code>write</code> also lets them push to it.</p>
    <form method="post" action="${action}" class="box row">
      <label class="label with-icon" for="collab-slug">${icon("user")}username</label>
      <input id="collab-slug" type="text" name="slug" placeholder="their handle" pattern="[A-Za-z0-9._-]+" required>
      <select name="level" aria-label="access level">
        <option value="read">read</option>
        <option value="write">write</option>
      </select>
      <button type="submit">${icon("user-plus")}add</button>
    </form>
    ${table(["user", "access", "added", ""], rows, "nobody else has access")}`;
}

export function repoDescription(opts: {
  owner: string;
  name: string;
  description: string;
  readme: Readme | null;
}): string {
  if (opts.description.trim()) return opts.description;
  const fromReadme = opts.readme ? plainSummary(opts.readme.text) : "";
  return fromReadme || `${opts.owner}/${opts.name} — a git repository on ${config.title}.`;
}

export function logPage(opts: {
  owner: string;
  name: string;
  commits: Commit[];
  refs: RefList;
  rev: string;
  user: SessionUser | null;
}): string {
  const title = `${opts.owner}/${opts.name}`;
  const b = base(opts.owner, opts.name);
  const q = revQuery(opts.rev, opts.refs.head);

  const rows = opts.commits.map(
    (cm) => `      <tr>
        <td class="mono">${fmtDate(cm.time)}</td>
        <td>${icon("git-commit", 13)} <a href="${b}/commit/${esc(cm.hash)}${q}">${esc(cm.subject)}</a></td>
        <td class="muted">${esc(cm.author)}</td>
        <td class="mono">${esc(cm.hash.slice(0, 10))}</td>
      </tr>`,
  );

  const body = `    <h1 class="repo-title">${esc(title)} &middot; log</h1>
${repoNav(opts.owner, opts.name, "log", q)}
    ${revPicker(opts.refs, opts.rev)}
    ${table([], rows, "no commits")}`;

  return layout({
    title: `${title} log`,
    user: opts.user,
    body,
    description: `Commit history for ${title} on ${opts.rev}.`,
    path: `/${opts.owner}/${opts.name}/log`,
  });
}

export function treePage(opts: {
  owner: string;
  name: string;
  path: string;
  entries: TreeEntry[];
  refs: RefList;
  rev: string;
  user: SessionUser | null;
}): string {
  const b = base(opts.owner, opts.name);
  const q = revQuery(opts.rev, opts.refs.head);
  const crumb = opts.path ? ` /${esc(opts.path)}` : "";

  const row = (mode: string, glyph: string, href: string, label: string, size: string) =>
    `      <tr>
        <td class="mono">${esc(mode)}</td>
        <td>${icon(glyph, 13)} <a href="${href}">${label}</a></td>
        <td class="mono right">${esc(size)}</td>
      </tr>`;

  const rows = opts.entries.map((e) => {
    const childPath = esc(opts.path ? `${opts.path}/${e.name}` : e.name);
    const isDir = e.type === "tree";
    return row(
      e.mode,
      isDir ? "folder" : "file-text",
      `${b}/${isDir ? "tree" : "blob"}/${childPath}${q}`,
      `${esc(e.name)}${isDir ? "/" : ""}`,
      e.size,
    );
  });

  if (opts.path) {
    const up = esc(opts.path.split("/").slice(0, -1).join("/"));
    rows.unshift(row("", "arrow-up", `${b}/tree/${up}${q}`, "../", ""));
  }

  const body = `    <h1 class="repo-title">${esc(opts.owner)}/${esc(opts.name)} &middot; tree${crumb}</h1>
${repoNav(opts.owner, opts.name, "tree", q)}
    ${revPicker(opts.refs, opts.rev)}
    ${table([], rows, "empty")}`;

  return layout({
    title: `${opts.owner}/${opts.name} tree`,
    user: opts.user,
    body,
    description: `Files in ${opts.owner}/${opts.name}${opts.path ? ` at ${opts.path}` : ""}.`,
    path: `${b}/tree${opts.path ? `/${opts.path}` : ""}`,
  });
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function blobPage(opts: {
  owner: string;
  name: string;
  path: string;
  binary: boolean;
  text: string;
  truncated: boolean;
  bytes: number;
  refs: RefList;
  rev: string;
  user: SessionUser | null;
}): string {
  const b = base(opts.owner, opts.name);
  const size = esc(fmtBytes(opts.bytes));
  const cut = opts.truncated
    ? `<p class="muted">Showing the first part of a ${size} file. Clone the repository to read all of it.</p>`
    : "";
  const content = opts.binary
    ? `<p class="muted">binary file not shown (${size})</p>`
    : `${cut}<pre class="code"><code>${esc(opts.text)}</code></pre>`;
  const q = revQuery(opts.rev, opts.refs.head);
  const upPath = opts.path.split("/").slice(0, -1).join("/");

  const body = `    <h1 class="repo-title">${esc(opts.owner)}/${esc(opts.name)} &middot; ${esc(opts.path)}</h1>
${repoNav(opts.owner, opts.name, "tree", q)}
    <p class="muted"><a class="with-icon" href="${b}/tree/${esc(upPath)}${q}">${icon("arrow-left")}back to ${esc(upPath || "tree")}</a></p>
    ${content}`;

  return layout({
    title: opts.path,
    user: opts.user,
    body,
    description: `${opts.path} in ${opts.owner}/${opts.name}.`,
    path: `${b}/blob/${opts.path}`,
  });
}

export function commitPage(opts: {
  owner: string;
  name: string;
  commit: CommitDetail;
  rev: string;
  user: SessionUser | null;
}): string {
  const cm = opts.commit;
  const q = `?h=${encodeURIComponent(opts.rev)}`;
  const tooBig = cm.diffTruncated
    ? `<p class="muted">This diff is too large to show in full. Clone the repository to read all of it.</p>`
    : "";

  const body = `    <h1 class="page-title">${esc(cm.subject)}</h1>
${repoNav(opts.owner, opts.name, "log", q)}
    <dl class="commit-meta">
      <dt class="with-icon">${icon("git-commit", 13)}commit</dt><dd class="mono">${esc(cm.hash)}</dd>
      <dt class="with-icon">${icon("user", 13)}author</dt><dd>${esc(cm.author)} &lt;${esc(cm.email)}&gt;</dd>
      <dt class="with-icon">${icon("clock", 13)}date</dt><dd>${fmtDate(cm.time)}</dd>
    </dl>
    ${cm.body ? `<pre class="code">${esc(cm.body)}</pre>` : ""}
    ${tooBig}
    <pre class="code"><code>${esc(cm.diff)}</code></pre>`;

  return layout({
    title: cm.subject,
    user: opts.user,
    body,
    description: `${cm.subject} — ${cm.author} in ${opts.owner}/${opts.name}.`,
    path: `${base(opts.owner, opts.name)}/commit/${cm.hash}`,
  });
}

function settingsLayout(opts: {
  active: string;
  title: string;
  description: string;
  user: SessionUser;
  body: string;
}): string {
  const nav = tabs(opts.active, [
    ["account", "account", "user", "/settings"],
    ["tokens", "tokens", "key", "/settings/tokens"],
    ["deleted", "recently deleted", "trash", "/settings/deleted"],
  ]);
  return layout({
    title: opts.title,
    user: opts.user,
    body: `    <h1 class="page-title">settings</h1>
${nav}
${opts.body}`,
    description: opts.description,
    noindex: true,
  });
}

export function tokensPage(opts: {
  tokens: TokenRow[];
  user: SessionUser;
  newToken?: string | null;
}): string {
  const authUser = esc(sessionSlug(opts.user));

  const rows = opts.tokens.map(
    (t) => `      <tr>
        <td>${esc(t.label)}</td>
        <td class="mono">${esc(t.id)}</td>
        <td class="mono">${fmtDate(t.created_at)}</td>
        <td class="mono">${t.last_used ? fmtDate(t.last_used) : "never"}</td>
        <td>
          <form method="post" action="/settings/tokens/${esc(t.id)}/revoke">
            <button type="submit">${icon("x")}revoke</button>
          </form>
        </td>
      </tr>`,
  );

  const created = opts.newToken
    ? `    <section class="box">
      <p><strong>New token — copy it now, it won't be shown again:</strong></p>
      <code>${esc(opts.newToken)}</code>
      <p class="muted">Ready-to-use remote:<br>
      <code>git remote add mirror ${esc(config.baseUrl.replace("://", `://${sessionSlug(opts.user)}:${opts.newToken}@`))}/${authUser}/&lt;repo&gt;.git</code></p>
    </section>`
    : "";

  const body = `    <h2 class="section-title">${icon("key")}access tokens</h2>
    <p class="muted">These tokens act as <code>${authUser}</code>: use that as the git
    <strong>username</strong> and the token as the <strong>password</strong>. They can only push to
    repositories under <code>${authUser}/</code>.</p>
${created}
    <form method="post" action="/settings/tokens" class="box row">
      <label class="label with-icon" for="token-label">${icon("tag")}label</label>
      <input id="token-label" type="text" name="label" placeholder="laptop, backup cron, ...">
      <button type="submit">${icon("plus")}create token</button>
    </form>
    ${table(["label", "id", "created", "last used", ""], rows, "no tokens yet")}`;

  return settingsLayout({
    active: "tokens",
    title: "access tokens",
    description: "Manage git access tokens.",
    user: opts.user,
    body,
  });
}

export function settingsPage(opts: {
  user: SessionUser;
  settings: Settings;
  saved: boolean;
}): string {
  const s = opts.settings;
  const on = (v: boolean) => (v ? " checked" : "");

  const webhookState = s.discordWebhook
    ? `      <p class="muted">configured &middot; <code>${esc(maskWebhook(s.discordWebhook))}</code></p>`
    : `      <p class="empty">not configured — repository events are not announced anywhere.</p>`;

  const webhookError =
    s.discordWebhook && s.webhookError
      ? `      <p class="bad">last delivery failed${s.webhookErrorAt ? ` at ${fmtDate(s.webhookErrorAt)}` : ""}: ${esc(s.webhookError)}</p>`
      : "";

  const clear = s.discordWebhook
    ? `      <form method="post" action="/settings/discord" data-confirm="Remove the Discord webhook? Events will stop being announced.">
        <input type="hidden" name="url" value="">
        <button type="submit">${icon("trash")}remove webhook</button>
      </form>`
    : "";

  const account = accountUrl();
  const accountLink = account
    ? ` — change them on <a href="${esc(account)}">your SSO account page</a>`
    : "";

  const body = `${opts.saved ? `    <p class="good">saved.</p>` : ""}

    <h2 class="section-title">${icon("discord-logo")}discord notifications</h2>
    <p class="muted">Announces repositories being created and deleted, and commits being
    pushed. Only repositories you own are announced, and only to this webhook.</p>
    <section class="box">
${webhookState}
${webhookError}
      <form method="post" action="/settings/discord" class="row">
        <label class="label with-icon" for="discord-url">${icon("link")}webhook</label>
        <input id="discord-url" class="grow" type="url" name="url" autocomplete="off"
          placeholder="https://discord.com/api/webhooks/…">
        <button type="submit">${icon("floppy-disk")}save</button>
      </form>
${clear}
    </section>

    <h2 class="section-title">${icon("sliders")}preferences</h2>
    <form method="post" action="/settings/prefs" class="box">
      <p><label><input type="checkbox" name="default_private"${on(s.defaultPrivate)}>
        New repositories start private</label></p>
      <p><label><input type="checkbox" name="discord_private"${on(s.discordPrivate)}>
        Announce activity on private repositories</label>
        <br><span class="muted">Off by default: commit subjects and repository names
        would otherwise leave a private repo for a Discord channel.</span></p>
      <p><label><input type="checkbox" name="mirror_auto"${on(s.mirrorAuto)}>
        Check mirror status automatically when viewing a repository</label>
        <br><span class="muted">Off means mirrors are only checked when you press
        <em>check now</em>.</span></p>
      <button type="submit">${icon("floppy-disk")}save preferences</button>
    </form>

    <h2 class="section-title">${icon("user")}account</h2>
    <p class="muted">Your name and avatar come from your SSO account and refresh
    automatically, so there is nothing to edit here${accountLink}. Your owner namespace is
    <code>${esc(sessionSlug(opts.user))}</code> and never changes.</p>`;

  return settingsLayout({
    active: "account",
    title: "settings",
    description: "Account settings.",
    user: opts.user,
    body,
  });
}

export function deletedPage(opts: {
  user: SessionUser;
  entries: TrashEntry[];
  retentionDays: number;
}): string {
  const nowSec = Math.floor(Date.now() / 1000);

  const lifeLabel = (deletedAt: number): string => {
    if (opts.retentionDays <= 0) return `<span class="empty">kept until purged</span>`;
    const left = Math.ceil((deletedAt + opts.retentionDays * 86400 - nowSec) / 86400);
    if (left <= 0) return `<span class="bad">purged on next visit</span>`;
    return `<span class="${left <= 3 ? "bad" : "empty"}">${left}d left</span>`;
  };

  const rows = opts.entries.map((e) => {
    let note = "";
    if (e.degraded) {
      note = `<br><span class="warn">recovery metadata unreadable — restorable, but collaborators will need re-adding</span>`;
    } else if (e.grants.length) {
      note = `<br><span class="muted">${e.grants.length} collaborator${e.grants.length === 1 ? "" : "s"} will be restored</span>`;
    }

    return `      <tr>
        <td class="repo-name">${icon("git-branch", 13)} ${esc(e.name)}${note}</td>
        <td class="mono">${fmtDate(e.deletedAt)}</td>
        <td class="muted">${esc(e.deletedBy)}</td>
        <td>${lifeLabel(e.deletedAt)}</td>
        <td>
          <form method="post" action="/settings/deleted/restore">
            <input type="hidden" name="entry" value="${esc(e.entry)}">
            <button type="submit">${icon("arrow-counter-clockwise")}restore</button>
          </form>
        </td>
        <td>
          <form method="post" action="/settings/deleted/purge" data-confirm="Permanently delete ${esc(e.name)}? This destroys the git data and cannot be undone.">
            <input type="hidden" name="entry" value="${esc(e.entry)}">
            <button type="submit">${icon("trash")}delete permanently</button>
          </form>
        </td>
      </tr>`;
  });

  const retention =
    opts.retentionDays > 0
      ? `Deleted repositories are kept for ${opts.retentionDays} days, then purged the next time you open this page.`
      : `Deleted repositories are kept indefinitely — nothing is purged unless you do it here.`;

  const body = `    <h2 class="section-title">${icon("trash")}recently deleted</h2>
    <p class="muted">${esc(retention)} A deleted repository keeps its name reserved, so
    nothing new can take it until it is restored or purged.</p>
    ${table(["repository", "deleted", "by", "retention", "", ""], rows, "nothing deleted")}`;

  return settingsLayout({
    active: "deleted",
    title: "recently deleted",
    description: "Recover deleted repositories.",
    user: opts.user,
    body,
  });
}

export function messagePage(opts: {
  title: string;
  message: string;
  user: SessionUser | null;
}): string {
  const body = `    <h1 class="page-title">${esc(opts.title)}</h1>
    <p class="muted">${esc(opts.message)}</p>`;
  return layout({
    title: opts.title,
    user: opts.user,
    body,
    description: opts.message,
    noindex: true,
  });
}
