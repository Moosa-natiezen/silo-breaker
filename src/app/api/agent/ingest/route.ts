import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { memoryDb } from "@/server/auth";
import { getDb, isNeonConfigured } from "@/server/db";
import { user as userTable } from "@/server/db/schema";
import { ingestDocument } from "@/server/ingest";
import { runSynthesis } from "@/server/synthesis";

/**
 * Agent Ingest API — the entry point used by the always-on background engine
 * (scripts/watch-workspace.ts) that pairs with the user's desktop workspace.
 *
 * Auth: `Authorization: Bearer $SILO_ENGINE_TOKEN` (server-side shared secret;
 * never exposed to the browser). The workspace owner is resolved from
 * SILO_OWNER_EMAIL so watcher files always land in the correct private graph.
 *
 * POST /api/agent/ingest
 *   { title, content, url?, source? }
 */

const ingestSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(200_000),
  url: z.string().url().nullish(),
  source: z.enum(["manual", "watcher", "url", "import"]).optional(),
});

function isAuthorized(request: Request): boolean {
  const expected = process.env.SILO_ENGINE_TOKEN;
  if (!expected) return false; // engine disabled unless explicitly configured

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Resolve the workspace owner's user id (Neon row or local memory table). */
async function resolveOwnerId(): Promise<string | null> {
  const email = process.env.SILO_OWNER_EMAIL?.toLowerCase();
  if (!email) return null;

  if (isNeonConfigured()) {
    const rows = await getDb()
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  const record = (memoryDb.user as Array<{ id: string; email: string }>).find(
    (u) => u.email.toLowerCase() === email,
  );
  return record?.id ?? null;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SILO_ENGINE_TOKEN) {
    return Response.json(
      { error: "Background engine is disabled (SILO_ENGINE_TOKEN not set)." },
      { status: 503 },
    );
  }

  const ownerId = await resolveOwnerId();
  if (!ownerId) {
    return Response.json(
      { error: "SILO_OWNER_EMAIL is not set or does not match a known user." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await ingestDocument({
      userId: ownerId,
      title: parsed.data.title,
      content: parsed.data.content,
      url: parsed.data.url ?? null,
      source: parsed.data.source ?? "watcher",
    });

    // Proactive Synthesis: cross-reference the new material immediately.
    let synthesis: { created: number; topSimilarity: number } | null = null;
    try {
      const outcome = await runSynthesis({
        userId: ownerId,
        documentId: result.document.id,
      });
      synthesis = {
        created: outcome.created.length,
        topSimilarity: outcome.topSimilarity,
      };
    } catch (err) {
      console.warn(
        "[agent] synthesis skipped:",
        err instanceof Error ? err.message : err,
      );
    }

    return Response.json({ ...result, synthesis }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
