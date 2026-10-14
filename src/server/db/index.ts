import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Neon (serverless Postgres) connection. Lazily initialized so that the app
 * can boot without a DATABASE_URL — in that case the local file-backed vector
 * store is used instead (see src/server/memory/store.ts).
 */

export type Db = NeonHttpDatabase<typeof schema>;

let cached: Db | null = null;

export function isNeonConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): Db {
  if (!isNeonConfigured()) {
    throw new Error(
      "DATABASE_URL is not set — Neon Database is not configured for this runtime.",
    );
  }
  if (!cached) {
    const client = neon(process.env.DATABASE_URL!);
    cached = drizzle({ client, schema });
  }
  return cached;
}
