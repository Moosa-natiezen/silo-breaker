import { requireUser } from "@/server/session";
import { getMemoryStore } from "@/server/memory/store";

/** GET /api/documents/[id] → full document content (owner-scoped). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const store = getMemoryStore();
  const document = await store.getDocument(auth.user.id, id);

  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }
  return Response.json({ document });
}
