/* test/preload.ts
 * LICENCED DASL-1.0 (c) Clove Twilight
 */

// Stands in for the Worker runtime: `cloudflare:workers` with D1 over bun:sqlite,
// waitUntil that tests can settle, and the git agent called in-process

import { plugin } from "bun";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(import.meta.dir, "..", "migrations");
const AGENT = "http://git-agent.test";

let sqlite: Database | null = null;

// Opened on first use, so a test can set MINIGIT_DB_PATH before importing anything
function open(): Database {
  if (sqlite) return sqlite;
  sqlite = new Database(process.env.MINIGIT_DB_PATH || ":memory:", { strict: true });
  for (const file of readdirSync(MIGRATIONS).sort()) {
    if (file.endsWith(".sql")) sqlite.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  return sqlite;
}

type Value = string | number | bigint | boolean | null | Uint8Array;

class Statement {
  constructor(
    readonly sql: string,
    readonly params: Value[] = [],
  ) {}

  bind(...params: Value[]): Statement {
    return new Statement(this.sql, params);
  }

  runNow() {
    const result = open().query(this.sql).run(...this.params);
    return {
      success: true,
      meta: {
        changes: result.changes,
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }

  async first<T>(): Promise<T | null> {
    return (open().query(this.sql).get(...this.params) as T | undefined) ?? null;
  }

  async all<T>() {
    return {
      success: true,
      results: open().query(this.sql).all(...this.params) as T[],
      meta: {},
    };
  }

  async run() {
    return this.runNow();
  }
}

const d1 = {
  prepare: (sql: string) => new Statement(sql),

  // D1 runs a batch as one transaction
  async batch(statements: Statement[]) {
    return open().transaction(() => statements.map((s) => s.runNow()))();
  },
};

const pending: Promise<unknown>[] = [];

/** Waits for everything handed to waitUntil so far, including what that work queued */
async function settle(): Promise<void> {
  while (pending.length) await Promise.allSettled(pending.splice(0));
}
(globalThis as Record<string, unknown>).settle = settle;

const env = new Proxy({} as Record<string, unknown>, {
  get(_, name: string) {
    if (name === "DB") return d1;
    if (name === "GIT_AGENT_URL") return AGENT;
    return process.env[name];
  },
});

plugin({
  name: "worker-runtime",
  setup(build) {
    build.module("cloudflare:workers", () => ({
      loader: "object",
      exports: {
        env,
        waitUntil: (promise: Promise<unknown>) => void pending.push(promise),
      },
    }));
    build.module("$app/env", () => ({
      loader: "object",
      exports: {
        building: false,
        dev: true,
      },
    }));
  },
});

// The Worker's git client fetches the agent; answer in-process instead of over a socket
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  if (!request.url.startsWith(AGENT)) return realFetch(request);
  const { handle } = await import("../container/server.ts");
  return handle(request);
}) as typeof fetch;
