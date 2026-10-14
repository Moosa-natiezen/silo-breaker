import { isNeonConfigured } from "@/server/db";
import { LocalVectorStore } from "./local-store";
import { NeonVectorStore } from "./neon-store";
import type { MemoryStore } from "./types";

export * from "./types";

let store: MemoryStore | null = null;

/**
 * Returns the configured memory store:
 *   • DATABASE_URL present  → Neon Postgres + pgvector
 *   • otherwise             → local JSON file (data/local-memory.json)
 */
export function getMemoryStore(): MemoryStore {
  if (!store) {
    store = isNeonConfigured() ? new NeonVectorStore() : new LocalVectorStore();
    if (process.env.NODE_ENV !== "production") {
      console.log(`[memory] Using ${store.kind} vector store.`);
    }
  }
  return store;
}

export function isNeonMemory(): boolean {
  return isNeonConfigured();
}
