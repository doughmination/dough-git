/* src/lib/server/db.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// SQLite on disk, behind the small D1-shaped API the rest of the server was written against.
// Migrations in migrations/ apply on first open, each one once

import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "./config.ts";

const MIGRATIONS = "migrations";

type Value = string | number | bigint | boolean | null | undefined | Uint8Array;

let sqlite: DatabaseSync | null = null;

// Opened on first use, so a test can set MINIGIT_DB_PATH before anything touches it
function open(): DatabaseSync {
  if (sqlite) return sqlite;

  if (config.dbPath !== ":memory:") mkdirSync(dirname(config.dbPath), { recursive: true });
  sqlite = new DatabaseSync(config.dbPath);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);");

  const applied = new Set(
    sqlite
      .prepare("SELECT name FROM _migrations")
      .all()
      .map((row) => String(row.name)),
  );
  const pending = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql") && !applied.has(file))
    .sort();

  for (const file of pending) {
    transaction(sqlite, () => {
      sqlite!.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
      sqlite!.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(file, now());
    });
    console.log(`[db] applied ${file}`);
  }
  return sqlite;
}

function transaction<T>(database: DatabaseSync, work: () => T): T {
  database.exec("BEGIN");
  try {
    const result = work();
    database.exec("COMMIT");
    return result;
  } catch (err) {
    database.exec("ROLLBACK");
    throw err;
  }
}

// SQLite has no booleans, and node:sqlite refuses undefined; D1 turned both into these
function toSql(value: Value): SQLInputValue {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === undefined) return null;
  return value;
}

export interface RunResult {
  success: true;
  meta: {
    changes: number;
    last_row_id: number;
  };
}

export class Statement {
  constructor(
    readonly sql: string,
    readonly params: Value[] = [],
  ) {}

  bind(...params: Value[]): Statement {
    return new Statement(this.sql, params);
  }

  runNow(): RunResult {
    const result = open()
      .prepare(this.sql)
      .run(...this.params.map(toSql));
    return {
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }

  async first<T>(): Promise<T | null> {
    const row = open()
      .prepare(this.sql)
      .get(...this.params.map(toSql));
    return (row as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ success: true; results: T[] }> {
    const results = open()
      .prepare(this.sql)
      .all(...this.params.map(toSql));
    return {
      success: true,
      results: results as T[],
    };
  }

  async run(): Promise<RunResult> {
    return this.runNow();
  }
}

const database = {
  prepare: (sql: string) => new Statement(sql),

  // Like D1, a batch runs as one transaction
  async batch(statements: Statement[]): Promise<RunResult[]> {
    const handle = open();
    return transaction(handle, () => statements.map((statement) => statement.runNow()));
  },
};

export function db(): typeof database {
  return database;
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}
