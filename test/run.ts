/* test/run.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Each test file is a plain script that exits non-zero on failure,
// so run them one by one in their own process.
const files = [...Deno.readDirSync("test")]
  .map((entry) => entry.name)
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => `test/${name}`);
const failed: string[] = [];

for (const file of files) {
  console.log(`\n=== ${file}`);
  const run = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-all", file],
    stdout: "inherit",
    stderr: "inherit",
  }).outputSync();
  if (!run.success) failed.push(file);
}

console.log(failed.length ? `\n✖ failed: ${failed.join(", ")}` : `\n✔ all ${files.length} files passed`);
Deno.exit(failed.length ? 1 : 0);
