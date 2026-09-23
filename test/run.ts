/* test/run.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Each test file is a plain script that exits non-zero on failure,
// so run them one by one in their own process.
const files = [...new Bun.Glob("test/*.test.mjs").scanSync()].sort();
const failed: string[] = [];

for (const file of files) {
  console.log(`\n=== ${file}`);
  const run = Bun.spawnSync(["bun", file], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (run.exitCode !== 0) failed.push(file);
}

console.log(failed.length ? `\n✖ failed: ${failed.join(", ")}` : `\n✔ all ${files.length} files passed`);
process.exit(failed.length ? 1 : 0);
