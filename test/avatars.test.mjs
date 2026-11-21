/* test/avatars.test.mjs
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "dough-avatars-"));
process.env.MINIGIT_REPOS_ROOT = root;
process.env.MINIGIT_DB_PATH = join(root, "test.db");
process.env.MINIGIT_AVATARS_DIR = join(root, "avatars");
process.env.MINIGIT_BASE_URL = "https://git.example";

const {
  sniffImage,
  saveAvatar,
  readAvatar,
  removeAvatar,
  AVATAR_MAX_BYTES,
} = await import("../src/lib/server/avatars.ts");
const { rememberUser, findUserBySlug } = await import("../src/lib/server/users.ts");

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
}

const bytes = (...values) => new Uint8Array([...values, 0, 0, 0, 0, 0, 0, 0, 0]);
const text = (value) => new TextEncoder().encode(value);

const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0);
const gif = text("GIF89a......");
const webp = text("RIFF\0\0\0\0WEBPVP8 ");

check("png is recognised", sniffImage(png) === "image/png");
check("jpeg is recognised", sniffImage(jpeg) === "image/jpeg");
check("gif is recognised", sniffImage(gif) === "image/gif");
check("old gif87a is recognised", sniffImage(text("GIF87a......")) === "image/gif");
check("webp is recognised", sniffImage(webp) === "image/webp");
check("svg is refused", sniffImage(text("<svg xmlns='http://www.w3.org/2000/svg'/>")) === null);
check("html is refused", sniffImage(text("<!doctype html><script>")) === null);
check("a riff that isn't webp is refused", sniffImage(text("RIFF\0\0\0\0WAVEfmt ")) === null);
check("empty is refused", sniffImage(new Uint8Array()) === null);

const user = {
  sub: "sub-ari",
  username: "ari",
  name: "Ari",
  picture: "https://sso.example/ari.png",
  issuer: "test",
};
await rememberUser(user);

check("a non-image upload is refused", await saveAvatar("ari", text("hello")) === false);
check("an oversized upload is refused", await saveAvatar("ari", new Uint8Array(AVATAR_MAX_BYTES + 1).fill(0xff)) === false);
check("a gif upload is stored", await saveAvatar("ari", gif) === true);

const stored = await findUserBySlug("ari");
check("the picture points at this instance", stored.picture.startsWith("https://git.example/avatars/ari?v="));
check("the stored file reads back as a gif", (await readAvatar("ari"))?.type === "image/gif");

const again = await rememberUser(user);
check("signing in again keeps the upload", again.picture === stored.picture);
check("and so does the database", (await findUserBySlug("ari")).picture === stored.picture);

await removeAvatar("ari");
check("removing clears the file", await readAvatar("ari") === null);
await rememberUser(user);
check("the sso picture returns on the next sign-in", (await findUserBySlug("ari")).picture === user.picture);

rmSync(root, { recursive: true, force: true });
if (failures) Deno.exit(1);
