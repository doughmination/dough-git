/* scripts/export-sqlite.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Turns the old Bun-era dough-git.db into SQL for D1:
//   bun scripts/export-sqlite.ts /srv/git/dough-git.db > import.sql
//   bunx wrangler d1 execute dough-git --remote --file import.sql
// Sessions are left behind; everyone signs in again.

import { Database } from "bun:sqlite";

const file = process.argv[2];
if (!file) {
  console.error("usage: bun scripts/export-sqlite.ts <dough-git.db>");
  process.exit(1);
}

const source = new Database(file, { readonly: true });

const TABLES = [
  "users",
  "tokens",
  "collaborators",
  "user_settings",
  "mirror_status",
];

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function exists(table: string): boolean {
  return source.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== null;
}

for (const table of TABLES) {
  if (!exists(table)) continue;
  const rows = source.query(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];

  for (const row of rows) {
    const columns = Object.keys(row).join(", ");
    const values = Object.values(row).map(literal).join(", ");
    console.log(`INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${values});`);
  }
}
