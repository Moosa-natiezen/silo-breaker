import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { getMemoryStore } from "@/server/memory/store";
import Dashboard from "@/components/Dashboard";

/**
 * Knowledge Canvas (main view). Server component: resolves the session,
 * loads the user's lifelong knowledge graph and hydrates the dashboard.
 * Wrapped in Suspense because session/memory reads are per-request dynamic
 * data (Next.js cacheComponents).
 */
export default function Home() {
  return (
    <Suspense fallback={<CanvasFallback />}>
      <Canvas />
    </Suspense>
  );
}

function CanvasFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <span className="status-orb" data-active="false" />
    </div>
  );
}

async function Canvas() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const store = getMemoryStore();
  const userId = session.user.id;
  const [documents, insights, stats] = await Promise.all([
    store.listDocuments(userId),
    store.listInsights(userId, { limit: 25 }),
    store.stats(userId),
  ]);

  const titleById = new Map(documents.map((d) => [d.id, d.title]));

  return (
    <Dashboard
      user={{
        name: session.user.name,
        email: session.user.email,
      }}
      initialDocuments={documents.map(({ content, ...doc }) => ({
        ...doc,
        preview: content.slice(0, 220),
      }))}
      initialInsights={insights.map((i) => ({
        ...i,
        currentTitle: i.currentDocumentId
          ? (titleById.get(i.currentDocumentId) ?? null)
          : null,
        relatedTitle: i.relatedDocumentId
          ? (titleById.get(i.relatedDocumentId) ?? null)
          : null,
      }))}
      stats={stats}
      memoryKind={store.kind}
    />
  );
}
