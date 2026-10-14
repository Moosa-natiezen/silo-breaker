import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { memoryAdapter } from "better-auth/adapters/memory";
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

const database = isNeonConfigured()
  ? drizzleAdapter(getDb(), { provider: "pg" })
  : memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
    });

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
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
