import { z } from "zod";
import { requireUser } from "@/server/session";
import { getMemoryStore } from "@/server/memory/store";

const patchSchema = z.object({
  status: z.enum(["pending", "accepted", "dismissed"]),
});

/**
 * PATCH /api/insights/[id] → acknowledge or dismiss a synthesis alert.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const { id } = await params;
  const store = getMemoryStore();
  await store.updateInsightStatus(auth.user.id, id, parsed.data.status);

  return Response.json({ ok: true });
}
