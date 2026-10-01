/* test/icons.test.mjs
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { icon } from "../src/icons.ts";

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
}

const names = [
  "git-branch",
  "git-commit-horizontal",
  "git-merge",
  "folder",
  "folder-plus",
  "file",
  "file-text",
  "newspaper",
  "sticky-note",
  "tag",
  "lock",
  "lock-open",
  "user",
  "users",
  "user-plus",
  "user-minus",
  "key",
  "settings",
  "sliders-horizontal",
  "log-in",
  "log-out",
  "house",
  "link",
  "message-circle",
  "globe",
  "hard-drive",
  "download",
  "upload",
  "refresh-cw",
  "rotate-ccw",
  "save",
  "trash-2",
  "plus",
  "x",
  "check",
  "clock",
  "hourglass",
  "triangle-alert",
  "octagon-alert",
  "circle-help",
  "info",
  "lightbulb",
  "flag",
  "snowflake",
  "wind",
  "arrow-up",
  "arrow-down",
  "arrow-left",
  "arrow-right",
];

for (const name of names) {
  const svg = icon(name);
  check(`${name} renders one svg`, (svg.match(/<svg /g) ?? []).length === 1);
  check(`${name} has a drawable shape`, /<(path|circle|rect|line|polyline|polygon|ellipse) /.test(svg));
}

check(
  "default size is 16",
  icon("folder").includes('width="16"') && icon("folder").includes('height="16"'),
);
check(
  "an explicit size is honoured",
  icon("lock", 24).includes('width="24"'),
);
check(
  "the 24x24 grid is carried through",
  names.every((name) => icon(name).includes('viewBox="0 0 24 24"')),
);
check(
  "icons carry the .icon class for styling",
  icon("user").includes('class="icon"'),
);
check(
  "icons are decorative to screen readers",
  icon("user").includes('aria-hidden="true"'),
);
check(
  "colour is inherited, not hard-coded",
  icon("git-branch").includes('stroke="currentColor"') && !/#[0-9a-f]{3,6}/i.test(icon("git-branch")),
);
check(
  "stroke width is 2.25px at the default size",
  icon("folder").includes('stroke-width="3.375"'),
);
check(
  "stroke width stays 2.25px at other sizes",
  icon("folder", 24).includes('stroke-width="2.25"') && icon("folder", 12).includes('stroke-width="4.5"'),
);

let threw = false;
try {
  icon("definitely-not-an-icon");
} catch {
  threw = true;
}
check("an unknown name throws rather than rendering nothing", threw);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
