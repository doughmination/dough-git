/* test/access.test.mjs
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "dough-access-"));
process.env.MINIGIT_REPOS_ROOT = root;
process.env.MINIGIT_DB_PATH = join(root, "test.db");

const {
  accessFor,
  canRead,
  canWrite,
  setCollaborator,
  removeCollaborator,
  listCollaborators,
  collaboratorLevel,
  dropRepoAccess,
  sharedWith,
} = await import("../src/lib/server/access.ts");

const { safeRef, safeObjectId } = await import("../src/lib/server/git.ts");

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
}

const repo = { owner: "alex", name: "notes" };

async function access(viewer, isPublic) {
  return await accessFor({ ref: repo, isPublic, viewer });
}

check("the owner has write on their own private repo", await access("alex", false) === "write");
check("a stranger sees nothing of a private repo", await access("sam", false) === "none");
check("an anonymous visitor sees nothing of a private repo", await access(null, false) === "none");

check("anyone may read a public repo", await access(null, true) === "read");
check("a stranger may read but not write a public repo", await access("sam", true) === "read");
check("the owner still has write on a public repo", await access("alex", true) === "write");

await setCollaborator(repo, "sam", "read");

check("a read collaborator can see a private repo", await access("sam", false) === "read");
check("a read collaborator still cannot push", !await canWrite({ ref: repo, isPublic: false, viewer: "sam" }));
check(
  "the grant is recorded at the level given",
  await collaboratorLevel(repo, "sam") === "read",
);

await setCollaborator(repo, "jo", "write");

check("a write collaborator can push", await access("jo", false) === "write");
check(
  "a write collaborator on a public repo still has write",
  await access("jo", true) === "write",
);

await setCollaborator(repo, "sam", "write");
check("re-adding a collaborator changes their level", await collaboratorLevel(repo, "sam") === "write");
check("re-adding does not duplicate the row", (await listCollaborators(repo)).length === 2);

const otherRepo = { owner: "alex", name: "secrets" };
check(
  "a grant on one repo does not carry to another",
  await access("jo", false) === "write" &&
    await accessFor({ ref: otherRepo, isPublic: false, viewer: "jo" }) === "none",
);

check("inviting the owner is refused", await setCollaborator(repo, "alex", "read") === false);
check(
  "the owner keeps write regardless",
  await access("alex", false) === "write" && (await listCollaborators(repo)).length === 2,
);

const jos = await sharedWith("jo");
check(
  "a collaborator can find the repos shared with them",
  jos.length === 1 && jos[0].owner === "alex" && jos[0].name === "notes",
);
check("somebody with no grants has nothing shared", (await sharedWith("nobody")).length === 0);

check("removing a collaborator reports success", await removeCollaborator(repo, "sam") === true);
check("a removed collaborator loses access", await access("sam", false) === "none");
check("removing a non-collaborator reports failure", await removeCollaborator(repo, "sam") === false);

await dropRepoAccess(repo);
check("deleting a repo drops its grants", (await listCollaborators(repo)).length === 0);
check("and the former collaborator has no access", await access("jo", false) === "none");

check("a normal repo path is accepted", safeRef("alex", "notes.git") !== null);
check("a traversal in the owner is refused", safeRef("..", "notes") === null);
check("a traversal in the name is refused", safeRef("alex", "../../etc") === null);
check("a bare dot segment is refused", safeRef(".", "notes") === null);
check("a hidden segment is refused", safeRef("alex", ".ssh") === null);
check("a slash in a segment is refused", safeRef("alex/evil", "notes") === null);

check("a real object id is accepted", safeObjectId("a94a8fe5cc") === "a94a8fe5cc");
check("an option-shaped sha is refused", safeObjectId("--output=/tmp/pwned") === null);
check("a dash-leading sha is refused", safeObjectId("-abc123") === null);
check("a non-hex sha is refused", safeObjectId("HEAD") === null);
check("an over-long sha is refused", safeObjectId("a".repeat(65)) === null);

rmSync(root, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
