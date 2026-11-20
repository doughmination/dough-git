/* src/lib/server/markdown.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */


export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MAX_LABEL = 400;
const MAX_URL_PARTS = 500;
const MAX_ATTRS = 400;
const MAX_COMMENT = 1000;
const MAX_NEST = 24;
const MAX_RENDER_CHARS = 256 * 1024;

type Stash = string[];

function park(s: Stash, html: string): string {
  s.push(html);
  return `\x00${s.length - 1}\x00`;
}

function unpark(text: string, s: Stash): string {
  let out = text;
  for (let pass = 0; pass < 5 && out.includes("\x00"); pass++) {
    out = out.replace(/\x00(\d+)\x00/g, (_m, n) => s[Number(n)] ?? "");
  }
  return out;
}

const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i;

function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (ABSOLUTE.test(url)) return /^(?:https?|mailto):/i.test(url) ? url : null;
  if (/^[/\\]{2}/.test(url)) return null;
  return url;
}

function linkAttrs(href: string): string {
  return ABSOLUTE.test(href) ? ` rel="nofollow noopener noreferrer"` : "";
}

const VOID_HTML = new Set(["br", "hr", "img", "source", "wbr"]);

const HTML_ATTRS: Record<string, readonly string[]> = {
  a: ["href", "title"],
  img: ["src", "alt", "title", "width", "height", "align"],
  picture: [],
  source: ["src", "srcset", "media", "type"],
  div: ["align"],
  p: ["align", "pride"],
  span: ["pride"],
  center: [],
  h1: ["align"],
  h2: ["align"],
  h3: ["align"],
  h4: ["align"],
  h5: ["align"],
  h6: ["align"],
  table: ["align"],
  thead: [],
  tbody: [],
  tfoot: [],
  tr: [],
  th: ["align", "colspan", "rowspan"],
  td: ["align", "colspan", "rowspan"],
  ul: [],
  ol: ["start"],
  li: [],
  dl: [],
  dt: [],
  dd: [],
  blockquote: ["cite"],
  pre: [],
  code: [],
  kbd: [],
  samp: [],
  b: [],
  strong: [],
  i: [],
  em: [],
  u: [],
  s: [],
  del: [],
  ins: [],
  mark: [],
  sub: [],
  sup: [],
  small: [],
  br: [],
  hr: [],
  wbr: [],
  details: ["open"],
  summary: [],
  figure: [],
  figcaption: [],
};

const RAW_TEXT = /^\s{0,3}<(script|style|textarea)(?=[\s/>])/i;

const RAW_TEXT_INLINE = new RegExp(
  `&lt;(script|style|textarea)(?:(?!&gt;)[\\s\\S]){0,${MAX_ATTRS}}?&gt;` +
    `(?:(?!&lt;/)[\\s\\S]){0,${MAX_RENDER_CHARS}}?&lt;/\\1\\s*&gt;`,
  "gi",
);

const PRIDE_FLAGS = new Set([
  "gay",
  "lesbian",
  "bisexual",
  "transgender",
  "pansexual",
  "asexual",
  "aromantic",
  "nonbinary",
  "queer",
]);

const PRIDE_ALIAS: Record<string, string> = {
  trans: "transgender",
  bi: "bisexual",
  pan: "pansexual",
  ace: "asexual",
  aro: "aromantic",
  enby: "nonbinary",
  nb: "nonbinary",
  mlm: "gay",
  wlw: "lesbian",
};

function prideFlag(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  const named = PRIDE_ALIAS[key] ?? key;
  return PRIDE_FLAGS.has(named) ? named : null;
}

const ALIGN_VALUE = /^(?:left|center|right|justify)$/i;
const DIMENSION_VALUE = /^\d{1,4}(?:%|px)?$/i;
const COUNT_VALUE = /^\d{1,4}$/;
const MEDIA_VALUE = /^[a-zA-Z0-9 ()\-:,.]{1,100}$/;
const MIME_VALUE = /^[a-zA-Z0-9.+-]{1,40}\/[a-zA-Z0-9.+-]{1,40}$/;

const HTML_TAG = new RegExp(
  `&lt;(/?)([a-zA-Z][a-zA-Z0-9]{0,14})` +
    `((?:\\s(?:(?!&gt;)[\\s\\S]){0,${MAX_ATTRS}}?)?)\\s*/?&gt;`,
  "g",
);

const HTML_ATTR = new RegExp(
  `([a-zA-Z][a-zA-Z0-9-]{0,19})` +
    `(?:\\s*=\\s*(?:&quot;((?:(?!&quot;)[\\s\\S]){0,${MAX_LABEL}})&quot;` +
    `|'([^']{0,${MAX_LABEL}})'` +
    `|([^\\s&]{1,${MAX_LABEL}})))?`,
  "g",
);

function srcsetValue(raw: string): string | null {
  const parts = raw.split(",").map((c) => c.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > 16) return null;
  const rebuilt: string[] = [];
  for (const part of parts) {
    const [url, ...rest] = part.split(/\s+/);
    const safe = url ? safeUrl(url) : null;
    if (!safe) return null;
    if (rest.length > 1) return null;
    if (rest.length === 1 && !/^\d{1,4}(?:w|x)$/.test(rest[0]!)) return null;
    rebuilt.push(rest.length ? `${safe} ${rest[0]}` : safe);
  }
  return rebuilt.join(", ");
}

function attrValue(name: string, raw: string | undefined): string | null {
  switch (name) {
    case "href":
    case "src":
    case "cite":
      return raw === undefined ? null : safeUrl(raw);
    case "srcset":
      return raw === undefined ? null : srcsetValue(raw);
    case "align":
      return raw !== undefined && ALIGN_VALUE.test(raw) ? raw.toLowerCase() : null;
    case "width":
    case "height":
      return raw !== undefined && DIMENSION_VALUE.test(raw) ? raw : null;
    case "colspan":
    case "rowspan":
    case "start":
      return raw !== undefined && COUNT_VALUE.test(raw) ? raw : null;
    case "media":
      return raw !== undefined && MEDIA_VALUE.test(raw) ? raw : null;
    case "type":
      return raw !== undefined && MIME_VALUE.test(raw) ? raw : null;
    case "alt":
    case "title":
      return raw ?? "";
    case "pride":
      return raw === undefined ? null : prideFlag(raw);
    case "open":
      return "";
    default:
      return null;
  }
}

function rebuildTag(closing: string, rawName: string, rawAttrs: string): string {
  const name = rawName.toLowerCase();
  const allowed = HTML_ATTRS[name];
  if (!allowed) return "";
  if (closing) return VOID_HTML.has(name) ? "" : `\x01</${name}>\x02`;

  let out = `<${name}`;
  let href = "";
  const seen = new Set<string>();
  HTML_ATTR.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HTML_ATTR.exec(rawAttrs)) !== null) {
    if (m[0] === "") {
      HTML_ATTR.lastIndex++;
      continue;
    }
    const attr = m[1]!.toLowerCase();
    if (!allowed.includes(attr) || seen.has(attr)) continue;
    const value = attrValue(attr, m[2] ?? m[3] ?? m[4]);
    if (value === null) continue;
    seen.add(attr);
    if (attr === "href") href = value;
    if (attr === "pride") out += ` class="md-pride md-pride-${value}"`;
    else out += attr === "open" ? " open" : ` ${attr}="${value}"`;
  }

  if (name === "a" && href) out += linkAttrs(href);
  if (name === "img") out += ' loading="lazy"';

  return `\x01${out}>\x02`;
}

function balanceHtml(html: string): string {
  const open: string[] = [];
  let out = "";
  let i = 0;

  while (i < html.length) {
    const start = html.indexOf("\x01", i);
    if (start === -1) {
      out += html.slice(i);
      break;
    }
    const end = html.indexOf("\x02", start);
    if (end === -1) {
      out += html.slice(i);
      break;
    }

    out += html.slice(i, start);
    const tag = html.slice(start + 1, end);
    i = end + 1;

    const name = /^<\/?([a-z0-9]+)/.exec(tag)?.[1] ?? "";
    if (VOID_HTML.has(name)) {
      out += tag;
      continue;
    }
    if (!tag.startsWith("</")) {
      open.push(name);
      out += tag;
      continue;
    }

    const depth = open.lastIndexOf(name);
    if (depth === -1) continue;
    for (let d = open.length - 1; d > depth; d--) out += `</${open[d]}>`;
    out += tag;
    open.length = depth;
  }

  while (open.length > 0) out += `</${open.pop()}>`;
  return out;
}

function emphasis(t: string): string {
  return t
    .replace(/\*\*\*(\S[\s\S]*?\S|\S)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(\S[\s\S]*?\S|\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w\\])__(\S[\s\S]*?\S|\S)__(?!\w)/g, "$1<strong>$2</strong>")
    .replace(/(^|[^*\w\\])\*(\S[\s\S]*?\S|\S)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w\\])_(\S[\s\S]*?\S|\S)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~(\S[\s\S]*?\S|\S)~~/g, "<del>$1</del>");
}

function LINK_RE(bang: string): RegExp {
  return new RegExp(
    `${bang}\\[([^\\]]{0,${MAX_LABEL}})\\]` +
      `\\(\\s*((?:[^()\\s]|\\([^()\\s]*\\)){1,${MAX_URL_PARTS}})` +
      `(?:\\s+&quot;(.{0,${MAX_LABEL}}?)&quot;)?\\s*\\)`,
    "g",
  );
}

function inline(src: string): string {
  const s: Stash = [];
  let text = escapeHtml(src.replace(/\x00/g, ""));

  text = text.replace(/(`+)([\s\S]+?)\1/g, (_m, _ticks, code: string) =>
    park(s, `<code>${code.trim()}</code>`),
  );

  text = text.replace(new RegExp(`&lt;!--[\\s\\S]{0,${MAX_COMMENT}}?--&gt;`, "g"), "");
  text = text.replace(RAW_TEXT_INLINE, "");

  HTML_TAG.lastIndex = 0;
  text = text.replace(HTML_TAG, (_m, closing: string, name: string, attrs: string) => {
    const tag = rebuildTag(closing, name, attrs);
    return tag ? park(s, tag) : "";
  });

  text = text.replace(
    LINK_RE("!"),
    (_m, alt: string, url: string, title?: string) => {
      const src = safeUrl(url);
      if (!src) return alt;
      const t = title ? ` title="${title}"` : "";
      return park(s, `<img src="${src}" alt="${alt}"${t} loading="lazy">`);
    },
  );

  text = text.replace(
    LINK_RE(""),
    (_m, label: string, url: string, title?: string) => {
      const inner = emphasis(label);
      const href = safeUrl(url);
      if (!href) return inner;
      const t = title ? ` title="${title}"` : "";
      return park(s, `<a href="${href}"${t}${linkAttrs(href)}>${inner}</a>`);
    },
  );

  text = text.replace(
    new RegExp(`&lt;((?:https?://|mailto:)\\S{1,${MAX_URL_PARTS}}?)&gt;`, "g"),
    (_m, url: string) => park(s, `<a href="${url}"${linkAttrs(url)}>${url}</a>`),
  );

  text = text.replace(
    /(^|[\s(])(https?:\/\/[^\s<>()]*[^\s<>().,:!?'"])/g,
    (_m, pre: string, url: string) =>
      pre + park(s, `<a href="${url}"${linkAttrs(url)}>${url}</a>`),
  );

  return unpark(emphasis(text), s);
}

function paragraph(lines: string[]): string {
  return lines
    .map((line, i) => {
      const hard = i < lines.length - 1 && /(?: {2,}|\\)$/.test(line);
      return inline(line.replace(/(?: +|\\)$/, "")) + (hard ? "<br>" : "");
    })
    .join("\n");
}

const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const ATX = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*(\S*).*$/;
const RULE = /^\s{0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const QUOTE = /^\s{0,3}>/;

const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|FROZEN|ASIDE)\]\s*$/i;

// Material outline icon bodies (24×24), the same set as the rest of the UI. Inlined
// because this renders to an HTML string, outside the Svelte components
const ALERT_ICON: Record<string, string> = {
  // ic:outline-info
  note: '<path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8"/>',
  // ic:outline-lightbulb
  tip: '<path fill="currentColor" d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74c0-3.86-3.14-7-7-7m2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A5 5 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1"/>',
  // ic:outline-flag
  important: '<path fill="currentColor" d="m12.36 6l.4 2H18v6h-3.36l-.4-2H7V6zM14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/>',
  // ic:outline-warning
  warning: '<path fill="currentColor" d="M1 21h22L12 2zm12-3h-2v-2h2zm0-4h-2v-4h2z"/>',
  // ic:outline-report
  caution: '<path fill="currentColor" d="M15.73 3H8.27L3 8.27v7.46L8.27 21h7.46L21 15.73V8.27zM19 14.9L14.9 19H9.1L5 14.9V9.1L9.1 5h5.8L19 9.1z"/><circle cx="12" cy="16" r="1" fill="currentColor"/><path fill="currentColor" d="M11 7h2v7h-2z"/>',
  // ic:outline-ac-unit
  frozen: '<path fill="currentColor" d="M22 11h-4.17l3.24-3.24l-1.41-1.42L15 11h-2V9l4.66-4.66l-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93L6.34 4.34L11 9v2H9L4.34 6.34L2.93 7.76L6.17 11H2v2h4.17l-3.24 3.24l1.41 1.42L9 13h2v2l-4.66 4.66l1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24l1.42-1.41L13 15v-2h2l4.66 4.66l1.41-1.42L17.83 13H22z"/>',
  // ic:outline-air
  aside: '<path fill="currentColor" d="M14.5 17c0 1.65-1.35 3-3 3s-3-1.35-3-3h2c0 .55.45 1 1 1s1-.45 1-1s-.45-1-1-1H2v-2h9.5c1.65 0 3 1.35 3 3M19 6.5C19 4.57 17.43 3 15.5 3S12 4.57 12 6.5h2c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S16.33 8 15.5 8H2v2h13.5c1.93 0 3.5-1.57 3.5-3.5m-.5 4.5H2v2h16.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5v2c1.93 0 3.5-1.57 3.5-3.5S20.43 11 18.5 11"/>',
};

function alertBlock(kind: string, body: string[], depth: number): string {
  const key = kind.toLowerCase();
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  const icon = ALERT_ICON[key] ?? ALERT_ICON.note;
  const glyph = `<svg class="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
  const inner = blocks(body, depth + 1);
  const title = `<p class="md-alert-title">${glyph}${label}</p>`;
  return `<div class="md-alert md-alert-${key}">\n${title}\n${inner}\n</div>`;
}

function at(lines: string[], i: number): string {
  return lines[i] ?? "";
}

function indentOf(line: string): number {
  return /^\s*/.exec(line)?.[0].length ?? 0;
}

const BLOCK_HTML = new Set([
  "div", "p", "center", "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "ul", "ol", "li", "dl", "dt", "dd",
  "blockquote", "pre", "details", "summary",
  "figure", "figcaption", "picture", "source", "hr",
]);

const BLOCK_HTML_START = /^\s{0,3}<(\/?)([a-zA-Z][a-zA-Z0-9]{0,14})(?=[\s/>])/;

function isHtmlOnly(line: string): boolean {
  const m = BLOCK_HTML_START.exec(line);
  return m !== null && BLOCK_HTML.has(m[2]!.toLowerCase());
}

function isBlockStart(line: string): boolean {
  return (
    FENCE.test(line) ||
    RULE.test(line) ||
    ATX.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line) ||
    RAW_TEXT.test(line) ||
    isHtmlOnly(line) ||
    line.trimStart().startsWith("<!--")
  );
}

function isDelimiterRow(line: string): boolean {
  return /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-*:?\s*\|?\s*$/.test(line);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function alignOf(cell: string): string {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return ` data-align="center"`;
  if (right) return ` data-align="right"`;
  return "";
}

function table(lines: string[], start: number): [string, number] {
  const heads = splitRow(at(lines, start));
  const aligns = splitRow(at(lines, start + 1)).map(alignOf);
  let i = start + 2;
  const rows: string[] = [];
  while (i < lines.length && at(lines, i).includes("|") && at(lines, i).trim()) {
    const cells = splitRow(at(lines, i));
    rows.push(
      `<tr>${heads
        .map(
          (_h, n) => `<td${aligns[n] ?? ""}>${inline(cells[n] ?? "")}</td>`,
        )
        .join("")}</tr>`,
    );
    i++;
  }
  const head = heads
    .map((h, n) => `<th${aligns[n] ?? ""}>${inline(h)}</th>`)
    .join("");
  return [
    `<table><thead><tr>${head}</tr></thead><tbody>${rows.join("")}</tbody></table>`,
    i,
  ];
}

function list(lines: string[], start: number, depth: number): [string, number] {
  const first = LIST_ITEM.exec(at(lines, start));
  if (!first) return ["", start + 1];
  const bullet = first[2] ?? "-";
  const baseIndent = (first[1] ?? "").length;
  const ordered = /\d/.test(bullet);
  const items: string[][] = [];
  let item: string[] | null = null;
  let i = start;

  const flush = () => {
    if (item) items.push(item);
    item = null;
  };

  while (i < lines.length) {
    const line = at(lines, i);

    if (!line.trim()) {
      const next = at(lines, i + 1);
      if (!next.trim()) break;
      if (!LIST_ITEM.test(next) && indentOf(next) <= baseIndent) break;
      if (item) item.push("");
      i++;
      continue;
    }

    const marker = LIST_ITEM.exec(line);
    const indent = indentOf(line);

    if (marker && indent <= baseIndent + 1) {
      flush();
      item = [marker[3] ?? ""];
      i++;
      continue;
    }
    if (indent > baseIndent && item) {
      item.push(line.slice(Math.min(indent, baseIndent + 2)));
      i++;
      continue;
    }
    break;
  }
  flush();

  const html = items
    .map((raw) => {
      const task = /^\[([ xX])\]\s+([\s\S]*)$/.exec(raw[0] ?? "");
      const body = task ? [task[2] ?? "", ...raw.slice(1)] : raw;
      const checkbox = task
        ? `<input type="checkbox" disabled${task[1] === " " ? "" : " checked"}> `
        : "";
      const rendered = blocks(body, depth + 1).replace(/^<p>([\s\S]*?)<\/p>(?=\n<|$)/, "$1");
      return `<li>${checkbox}${rendered}</li>`;
    })
    .join("\n");

  const tag = ordered ? "ol" : "ul";
  const startAttr =
    ordered && bullet.slice(0, -1) !== "1"
      ? ` start="${Number(bullet.slice(0, -1))}"`
      : "";
  return [`<${tag}${startAttr}>\n${html}\n</${tag}>`, i];
}

function blocks(lines: string[], depth = 0): string {
  if (depth > MAX_NEST) {
    const text = lines.filter((l) => l.trim()).join("\n");
    return text ? `<p>${paragraph(text.split("\n"))}</p>` : "";
  }

  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = at(lines, i);

    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const ticks = fence[1] ?? "```";
      const close = new RegExp(`^\\s{0,3}\\${ticks[0]}{${ticks.length},}\\s*$`);
      const buf: string[] = [];
      i++;
      while (i < lines.length && !close.test(at(lines, i))) buf.push(at(lines, i++));
      i++;
      out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    if (line.trimStart().startsWith("<!--")) {
      while (i < lines.length && !at(lines, i).includes("-->")) i++;
      i++;
      continue;
    }

    if (RULE.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    const atx = ATX.exec(line);
    if (atx) {
      const level = (atx[1] ?? "#").length;
      out.push(`<h${level}>${inline(atx[2] ?? "")}</h${level}>`);
      i++;
      continue;
    }

    const under = at(lines, i + 1);
    if (!isBlockStart(line)) {
      if (/^\s{0,3}=+\s*$/.test(under)) {
        out.push(`<h1>${inline(line.trim())}</h1>`);
        i += 2;
        continue;
      }
      if (/^\s{0,3}-+\s*$/.test(under)) {
        out.push(`<h2>${inline(line.trim())}</h2>`);
        i += 2;
        continue;
      }
    }

    if (QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE.test(at(lines, i))) {
        buf.push(at(lines, i).replace(/^\s{0,3}>\s?/, ""));
        i++;
      }

      const marker = ALERT.exec(buf[0] ?? "");
      if (marker) {
        out.push(alertBlock(marker[1] ?? "", buf.slice(1), depth));
        continue;
      }

      out.push(`<blockquote>\n${blocks(buf, depth + 1)}\n</blockquote>`);
      continue;
    }

    if (line.includes("|") && isDelimiterRow(under)) {
      const [html, next] = table(lines, i);
      out.push(html);
      i = next;
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const [html, next] = list(lines, i, depth);
      out.push(html);
      i = next;
      continue;
    }

    if (/^ {4}\S/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && (/^ {4}/.test(at(lines, i)) || !at(lines, i).trim())) {
        if (!at(lines, i).trim() && !/^ {4}/.test(at(lines, i + 1))) break;
        buf.push(at(lines, i).slice(4));
        i++;
      }
      out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    const rawText = RAW_TEXT.exec(line);
    if (rawText && !line.toLowerCase().includes(`</${rawText[1]!.toLowerCase()}`)) {
      const closer = `</${rawText[1]!.toLowerCase()}`;
      i++;
      while (i < lines.length && !at(lines, i).toLowerCase().includes(closer)) i++;
      i++;
      continue;
    }

    if (isHtmlOnly(line)) {
      const buf: string[] = [];
      while (i < lines.length && at(lines, i).trim()) {
        buf.push(inline(at(lines, i).trim()));
        i++;
      }
      const html = buf.join("\n");
      if (html.trim()) out.push(html);
      continue;
    }

    const buf: string[] = [];
    while (i < lines.length && at(lines, i).trim() && !isBlockStart(at(lines, i))) {
      buf.push(at(lines, i));
      i++;
    }
    if (buf.length === 0) {
      buf.push(line);
      i++;
    }
    out.push(`<p>${paragraph(buf)}</p>`);
  }

  return out.join("\n");
}

export function renderMarkdown(src: string): string {
  const oversize = src.length > MAX_RENDER_CHARS;
  const lines = (oversize ? src.slice(0, MAX_RENDER_CHARS) : src)
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .split("\n");

  if (oversize) lines.pop();

  const html = balanceHtml(blocks(lines));
  return oversize
    ? `${html}\n<p><em>This document was truncated for display.</em></p>`
    : html;
}

function flatten(s: string): string {
  const paren = `(?:[^()]|\\([^()]*\\)){0,${MAX_URL_PARTS}}`;
  const label = `[^\\]]{0,${MAX_LABEL}}`;
  return s
    .replace(new RegExp(`!\\[${label}\\]\\(${paren}\\)`, "g"), " ")
    .replace(new RegExp(`\\[(${label})\\]\\(${paren}\\)`, "g"), "$1")
    .replace(/<[^<>]*>/g, " ")
    .replace(/[*_`~]/g, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function plainSummary(src: string, max = 180): string {
  const text = src
    .slice(0, MAX_RENDER_CHARS)
    .replace(/\r\n?/g, "\n")
    .replace(/```[\s\S]*?(?:```|$)/g, "\n\n")
    .replace(new RegExp(`<!--[\\s\\S]{0,${MAX_COMMENT}}?-->`, "g"), " ");

  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split("\n").filter((l) => l.trim());
    const first = lines[0];
    if (first === undefined) continue;
    if (
      ATX.test(first) ||
      RULE.test(first) ||
      QUOTE.test(first) ||
      LIST_ITEM.test(first) ||
      isHtmlOnly(first) ||
      /^\s{0,3}(?:=+|-+)\s*$/.test(lines[1] ?? "") ||
      isDelimiterRow(lines[1] ?? "")
    ) {
      continue;
    }
    const flat = flatten(lines.join(" "));
    if (!flat) continue;
    return flat.length <= max
      ? flat
      : flat.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  }
  return "";
}
