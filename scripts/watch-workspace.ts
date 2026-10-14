import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, relative, extname } from "node:path";

/**
 * Always-On Background Engine ("passive observer")
 * =================================================
 * Pairs with the user's desktop workspace: watches SILO_WATCH_DIR, and every
 * time a reading file appears or changes it pushes the content into the
 * Silo Breaker ingestion pipeline over HTTP, which chunks + embeds it and
 * immediately runs the Silo-Breaker Synthesis skill.
 *
 *   SILO_WATCH_DIR      folder to observe        (default: ./samples/workspace)
 *   SILO_APP_URL        the app's origin         (default: http://localhost:3000)
 *   SILO_ENGINE_TOKEN   shared secret (required)
 *   SILO_POLL_SECONDS   scan interval            (default: 15)
 *
 * Run with:  npm run engine
 */

const WATCH_DIR = process.env.SILO_WATCH_DIR ?? join(process.cwd(), "samples", "workspace");
const APP_URL = (process.env.SILO_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.SILO_ENGINE_TOKEN;
const POLL_SECONDS = Number(process.env.SILO_POLL_SECONDS ?? 15);
const OWNER_EMAIL = process.env.SILO_OWNER_EMAIL;

const WATCHED_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".rst",
  ".markdown",
  ".org",
  ".log",
  ".csv",
  ".json",
]);

interface WatchedFile {
  hash: string;
  ingestedAt: string;
}

type WatchState = Record<string, WatchedFile>;

const STATE_DIR = join(process.cwd(), "data");
const STATE_FILE = join(STATE_DIR, "watch-state.json");

function loadState(): WatchState {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as WatchState;
  } catch {
    return {};
  }
}

function saveState(state: WatchState) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function sha1(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

/** Recursively list watchable files under the workspace directory. */
function scan(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      out.push(...scan(full));
    } else if (WATCHED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function titleFor(path: string): string {
  const rel = relative(WATCH_DIR, path);
  const firstLine = readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim().replace(/^#+\s*/, ""))
    .find((l) => l.length > 0);
  return firstLine && firstLine.length <= 120 ? firstLine : rel;
}

async function push(path: string, content: string): Promise<boolean> {
  const res = await fetch(`${APP_URL}/api/agent/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      title: titleFor(path),
      content,
      source: "watcher",
      // Watched files carry no canonical URL; the workspace path is the source.
      url: null,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[engine] ingest failed for ${path}: ${res.status} ${text.slice(0, 200)}`);
    return false;
  }
  const body = (await res.json()) as {
    chunkCount?: number;
    synthesis?: { created: number } | null;
  };
  const synthesisNote = body.synthesis
    ? ` · synthesis: ${body.synthesis.created} new alert(s)`
    : "";
  console.log(
    `[engine] ✓ ${relative(WATCH_DIR, path)} → ${body.chunkCount ?? "?"} chunk(s)${synthesisNote}`,
  );
  return true;
}

async function tick(state: WatchState): Promise<number> {
  const files = scan(WATCH_DIR);
  let ingested = 0;

  for (const path of files) {
    let content: string;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const hash = sha1(content);
    if (state[path]?.hash === hash) continue;
    if (content.trim().length === 0) continue;

    const ok = await push(path, content);
    if (ok) {
      state[path] = { hash, ingestedAt: new Date().toISOString() };
      saveState(state);
      ingested += 1;
    }
  }
  return ingested;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!TOKEN) {
    console.error(
      "[engine] SILO_ENGINE_TOKEN is required — set it in .env to enable the background engine.",
    );
    process.exit(1);
  }
  if (!OWNER_EMAIL) {
    console.error(
      "[engine] SILO_OWNER_EMAIL is required so ingested files land in the right private graph.",
    );
    process.exit(1);
  }

  console.log("────────────────────────────────────────────────────────");
  console.log("  Silo Breaker · always-on background engine");
  console.log(`  watching : ${WATCH_DIR}`);
  console.log(`  app      : ${APP_URL}`);
  console.log(`  interval : ${POLL_SECONDS}s`);
  console.log("  mode     : passive observer (no manual notes required)");
  console.log("────────────────────────────────────────────────────────");

  const state = loadState();
  let stopping = false;

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    console.log("\n[engine] pausing observer…");
    saveState(state);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Initial sweep, then continuous observation.
  await tick(state);

  while (!stopping) {
    await sleep(POLL_SECONDS * 1000);
    if (stopping) break;
    try {
      await tick(state);
    } catch (err) {
      console.error("[engine] scan error:", err instanceof Error ? err.message : err);
    }
  }
}

main().catch((err) => {
  console.error("[engine] fatal:", err);
  process.exit(1);
});
