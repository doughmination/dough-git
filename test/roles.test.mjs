/* test/roles.test.mjs
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "dough-roles-"));
process.env.MINIGIT_REPOS_ROOT = root;
process.env.MINIGIT_DB_PATH = join(root, "test.db");
process.env.MINIGIT_SITE_OWNER = "clove";

const {
  siteRole,
  addMod,
  removeMod,
  listMods,
  listModLog,
} = await import("../src/lib/server/roles.ts");

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
}

check("the configured slug is the site owner", await siteRole("clove") === "owner");
check("a stranger has no role", await siteRole("sam") === null);
check("signed-out viewers have no role", await siteRole(null) === null);

check("the owner can't be added as a mod", await addMod("clove", "clove") === false);
check("a malformed handle is refused", await addMod("clove", "not a handle") === false);
check("an empty handle is refused", await addMod("clove", "  ") === false);

check("adding a mod succeeds", await addMod("clove", "Ari") === true);
check("the handle is stored lowercased", await siteRole("ari") === "mod");
check("adding twice is harmless", await addMod("clove", "ari") === true && (await listMods()).length === 1);

check("removing a mod succeeds", await removeMod("clove", "ari") === true);
check("a removed mod has no role", await siteRole("ari") === null);
check("removing someone who isn't a mod changes nothing", await removeMod("clove", "ari") === false);

const log = await listModLog();
check("the log holds one add and one remove", log.length === 2);
check("the log is newest first", log[0].action === "removed mod" && log[1].action === "added mod");
check("the log records who and whom", log[1].actor === "clove" && log[1].target === "ari");

rmSync(root, { recursive: true, force: true });
if (failures) Deno.exit(1);
