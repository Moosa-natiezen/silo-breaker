"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { signOut } from "@/lib/auth-client";
import type { DocumentPreview, GraphStats, InsightView } from "@/lib/types";
import AmbientHeader from "@/components/AmbientHeader";
import CaptureDialog from "@/components/CaptureDialog";
import KnowledgeCanvas from "@/components/KnowledgeCanvas";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import SynthesisIntercom from "@/components/SynthesisIntercom";

interface Props {
  user: { name: string; email: string };
  initialDocuments: DocumentPreview[];
  initialInsights: InsightView[];
  stats: GraphStats;
  memoryKind: "neon" | "local";
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bento-card p-4">
      <p className="label">{label}</p>
      <p
        className={`display mt-1.5 text-2xl ${accent ? "text-accent" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}

function DashboardInner({
  user,
  initialDocuments,
  initialInsights,
  stats,
  memoryKind,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(
    () => searchParams.get("onboard") === "1",
  );
  const documents = initialDocuments;
  const insights = initialInsights;

  const pending = insights.filter((i) => i.status === "pending").length;
  const engineActive = pending > 0;

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AmbientHeader
        user={user}
        engineActive={engineActive}
        pendingInsights={pending}
        onSignOut={handleSignOut}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="fade-up mb-8">
          <p className="label">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">
            Welcome back, {user.name.split(" ")[0]}.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Your observer never stopped reading. Below is the current state of your
            lifelong knowledge graph — every node is private to you.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Documents" value={String(stats.documents)} />
          <StatTile label="Vector chunks" value={String(stats.chunks)} accent />
          <StatTile label="Synthesis alerts" value={String(stats.insights)} />
          <StatTile
            label="Memory backend"
            value={memoryKind === "neon" ? "Neon" : "Local"}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <KnowledgeCanvas
              documents={documents}
              onAddDocument={() => setCaptureOpen(true)}
            />
          </div>

          {/* Synthesis feed */}
          <aside className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="label">Silo-Breaker Synthesis</p>
              <span className="text-[11px] text-muted">{pending} pending</span>
            </div>

            {insights.length === 0 ? (
              <div className="bento-card p-5">
                <p className="text-sm leading-relaxed text-muted">
                  No connections surfaced yet. As your graph grows, Nemotron will
                  cross-reference new material against everything you read weeks
                  ago — and interrupt here when a silo breaks.
                </p>
              </div>
            ) : (
              insights.slice(0, 6).map((insight) => (
                <article key={insight.id} className="bento-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="label">{insight.skill}</span>
                    <span className="text-[11px] text-muted">
                      {Math.round(insight.score * 100)}% match
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-medium leading-snug text-ink">
                    {insight.headline}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {insight.body}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        insight.status === "pending"
                          ? "bg-accent-dim text-accent"
                          : "bg-status-dim text-status"
                      }`}
                    >
                      {insight.status}
                    </span>
                    <span className="text-[10px] text-muted">
                      {new Date(insight.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </article>
              ))
            )}

            <button
              type="button"
              onClick={() => setCaptureOpen(true)}
              className="w-full rounded-xl border border-dashed border-hairline px-4 py-3 text-xs text-muted transition hover:border-accent/50 hover:text-accent"
            >
              + Capture a document
            </button>
          </aside>
        </div>
      </main>

      <footer className="border-t border-hairline px-6 py-5 text-center text-[11px] text-muted">
        Silo Breaker · hyper-private personal AI · Nebius AI Cloud × NVIDIA Nemotron ×
        Neon Database × Better Auth
      </footer>

      <SynthesisIntercom
        insights={insights}
        documents={documents}
        onChanged={() => router.refresh()}
      />

      {captureOpen && (
        <CaptureDialog
          onClose={() => setCaptureOpen(false)}
          onCaptured={() => router.refresh()}
        />
      )}
      {onboarding && <OnboardingOverlay onDismiss={() => setOnboarding(false)} />}
    </div>
  );
}

export default function Dashboard(props: Props) {
  return (
    <Suspense fallback={null}>
      <DashboardInner {...props} />
    </Suspense>
  );
}
