import { requireUser } from "@/server/session";
import { runSynthesis } from "@/server/synthesis";

/**
 * Synthesis API.
 *
 * GET  /api/synthesis → list Proactive Synthesis Alerts
 * POST /api/synthesis → run the Silo-Breaker skill on demand
 *                      body: { documentId?: string }
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { getMemoryStore } = await import("@/server/memory/store");
  const store = getMemoryStore();
  const insights = await store.listInsights(auth.user.id, { limit: 50 });
  return Response.json({ insights });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const documentId =
    typeof body?.documentId === "string" ? body.documentId : undefined;

  try {
    const outcome = await runSynthesis({
      userId: auth.user.id,
      documentId,
    });
    return Response.json(outcome);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Synthesis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
