import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import { nextCookies } from "better-auth/next-js";
import { getDb, isNeonConfigured } from "@/server/db";

/**
 * Better Auth server instance.
 *
 * • DATABASE_URL present → Neon Postgres via Drizzle adapter (production).
 * • otherwise            → in-memory adapter for local development so the
 *                          auth flow works without external services.
 *
 * Required env (see .env.example):
 *   BETTER_AUTH_SECRET  — >= 32 chars
 *   BETTER_AUTH_URL     — e.g. http://localhost:3000
 */

const DEV_SECRET = "silo-breaker-dev-secret-change-me-in-production-0123456789";

/**
 * In-memory tables for the no-DATABASE_URL development mode. Stored on
 * globalThis so the Next.js route-handler bundle and the server-component
 * bundle (separate module graphs in dev) share one store, and exported so
 * the background-engine API can resolve the workspace owner's user id.
 */
const globalStore = globalThis as typeof globalThis & {
  __siloAuthMemoryDb?: MemoryDB;
};

export const memoryDb: MemoryDB = (globalStore.__siloAuthMemoryDb ??= {
  user: [],
  session: [],
  account: [],
  verification: [],
});

const database = isNeonConfigured()
  ? drizzleAdapter(getDb(), { provider: "pg" })
  : memoryAdapter(memoryDb);

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? DEV_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30-day persistent sessions
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24,
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  /**
   * Origins allowed to talk to Better Auth. Includes the Cloud preview
   * hostname so sign-in works from the preview URL, plus any extra origins
   * provided via SILO_TRUSTED_ORIGINS (comma separated).
   */
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    "https://pv-76cbce1db81e-804c445a-8fff-429e-bb7e-5a9eac12a94c.style.dev",
    "https://*.style.dev",
    ...(process.env.SILO_TRUSTED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
  ],
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
