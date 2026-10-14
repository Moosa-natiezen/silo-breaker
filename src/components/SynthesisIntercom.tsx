"use client";

import { useEffect, useRef, useState } from "react";
import type { DocumentPreview, InsightView } from "@/lib/types";
import { timeAgo } from "@/lib/types";

interface Props {
  insights: InsightView[];
  documents: DocumentPreview[];
  onChanged: () => void;
}

type View =
  | { mode: "collapsed" }
  | { mode: "list" }
  | { mode: "detail"; id: string };

interface DocBody {
  title: string;
  content: string;
}

/**
 * The Synthesis Intercom — the primary AI intervention layer.
 *
 * Collapsed: a sleek, glowing icon in the bottom-right corner.
 * Autonomous intervention: expands upward when a Proactive Synthesis Alert
 * lands. Clicking the alert opens the dual-pane view — current workspace on
 * the left, dynamically retrieved historical context on the right — which is
 * the literal "silo broken" moment.
 */
export default function SynthesisIntercom({ insights, documents, onChanged }: Props) {
  const [view, setView] = useState<View>({ mode: "collapsed" });
  const [bodies, setBodies] = useState<Record<string, DocBody>>({});
  const previousPending = useRef(0);

  const pending = insights.filter((i) => i.status === "pending");
  const pendingCount = pending.length;

  // Autonomous intervention: expand the panel when the engine finds a link.
  useEffect(() => {
    if (pending.length > previousPending.current && view.mode === "collapsed") {
      setView({ mode: "list" });
    }
    previousPending.current = pending.length;
  }, [pending.length, view.mode]);

  const activeId = view.mode === "detail" ? view.id : null;
  const active = insights.find((i) => i.id === activeId) ?? null;

  // Load full bodies for the dual-pane view.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const ids = [active.currentDocumentId, active.relatedDocumentId].filter(
      (id): id is string => Boolean(id),
    );
    for (const id of ids) {
      if (bodies[id]) continue;
      fetch(`/api/documents/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data?.document) {
            setBodies((prev) => ({
              ...prev,
              [id]: { title: data.document.title, content: data.document.content },
            }));
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [active, bodies]);

  async function setStatus(id: string, status: "accepted" | "dismissed") {
    try {
      await fetch(`/api/insights/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onChanged();
    } finally {
      setView({ mode: "list" });
    }
  }

  const currentDoc = active?.currentDocumentId
    ? bodies[active.currentDocumentId]
    : undefined;
  const relatedDoc = active?.relatedDocumentId
    ? bodies[active.relatedDocumentId]
    : undefined;

  return (
    <>
      {/* Floating action control */}
      <button
        type="button"
        aria-label="Open Synthesis Intercom"
        onClick={() =>
          setView((v) => (v.mode === "collapsed" ? { mode: "list" } : { mode: "collapsed" }))
        }
        className={`fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full border transition-all ${
          pendingCount > 0
            ? "glow-sweep border-accent bg-accent text-background"
            : "glass-strip border-hairline bg-surface text-accent"
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.2 3.2A.6.6 0 0 1 5 18.7V16a2 2 0 0 1-1-1.7V6.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="10" r="1.1" fill="currentColor" />
          <circle cx="12.5" cy="10" r="1.1" fill="currentColor" />
          <circle cx="16" cy="10" r="1.1" fill="currentColor" />
        </svg>
        {pendingCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-background text-[10px] font-bold text-accent">
            {pendingCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {view.mode !== "collapsed" && (
        <div className="intercom-rise fixed bottom-24 right-6 z-40 flex max-h-[72vh] w-[min(94vw,720px)] flex-col overflow-hidden rounded-3xl border border-hairline bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="status-orb" data-active={pendingCount > 0 ? "true" : "false"} />
              <div>
                <p className="text-sm font-medium text-ink">Synthesis Intercom</p>
                <p className="text-[11px] text-muted">
                  {pendingCount > 0
                    ? `${pendingCount} connection${pendingCount > 1 ? "s" : ""} waiting to break a silo`
                    : "Observer idle · scanning persistent memory"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {view.mode === "detail" && (
                <button
                  type="button"
                  onClick={() => setView({ mode: "list" })}
                  className="text-xs text-muted transition hover:text-ink"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={() => setView({ mode: "collapsed" })}
                className="text-muted transition hover:text-ink"
                aria-label="Close intercom"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="overflow-y-auto">
            {/* ---------------- List view ---------------- */}
            {view.mode === "list" && (
              <div className="space-y-3 p-4">
                {insights.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm leading-relaxed text-muted">
                    Nothing yet. Keep reading — the moment two disconnected
                    pieces of your history rhyme, an alert appears right here.
                  </p>
                )}

                {insights.map((insight) => (
                  <button
                    key={insight.id}
                    type="button"
                    onClick={() => setView({ mode: "detail", id: insight.id })}
                    className={`w-full rounded-2xl border p-4 text-left transition hover:border-accent/50 ${
                      insight.status === "pending"
                        ? "border-accent/30 bg-accent-dim/40"
                        : "border-hairline bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="label">{insight.skill}</span>
                      <span className="text-[11px] text-accent">
                        {Math.round(insight.score * 100)}% match
                      </span>
                    </div>
                    <p className="mt-2 text-[15px] font-medium leading-snug text-ink">
                      {insight.headline}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      {insight.body}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
                      <span>{timeAgo(insight.createdAt)}</span>
                      <span className={insight.status === "pending" ? "text-accent" : "text-status"}>
                        {insight.status === "pending" ? "tap to open dual pane →" : insight.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ---------------- Dual-pane detail view ---------------- */}
            {view.mode === "detail" && active && (
              <div className="p-4">
                <div className="rounded-2xl border border-accent/30 bg-accent-dim/50 p-4">
                  <p className="label">Proactive Synthesis Alert</p>
                  <p className="display mt-2 text-xl leading-snug text-ink">
                    “{active.headline}”
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{active.body}</p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {/* Left: current workspace */}
                  <section className="rounded-2xl border border-hairline bg-background p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="label">Current workspace</p>
                      <span className="text-[10px] text-accent">now</span>
                    </div>
                    <p className="text-sm font-medium text-ink">
                      {currentDoc?.title ?? active.currentTitle ?? "Current material"}
                    </p>
                    <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted">
                      {currentDoc?.content ?? "Loading current material…"}
                    </p>
                  </section>

                  {/* Right: retrieved historical context */}
                  <section className="rounded-2xl border border-status/30 bg-status-dim/30 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="label">Retrieved from memory</p>
                      <span className="text-[10px] text-status">
                        {active.relatedDocumentId &&
                        documents.some((d) => d.id === active.relatedDocumentId)
                          ? `read ${timeAgo(
                              documents.find((d) => d.id === active.relatedDocumentId)!
                                .createdAt,
                            )}`
                          : "from persistent memory"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-ink">
                      {relatedDoc?.title ?? active.relatedTitle ?? "Historical material"}
                    </p>
                    <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted">
                      {relatedDoc?.content ?? "Loading historical context…"}
                    </p>
                  </section>
                </div>

                {/* Evidence quotes */}
                {active.evidence.length > 0 && (
                  <div className="mt-4">
                    <p className="label mb-2">Matching fragments</p>
                    <div className="space-y-2">
                      {active.evidence.map((ev, i) => (
                        <blockquote
                          key={i}
                          className="rounded-xl border-l-2 border-accent bg-background px-3 py-2 text-xs leading-relaxed text-muted"
                        >
                          “{ev.quote}”
                          {typeof ev.similarity === "number" && (
                            <span className="ml-2 text-[10px] text-accent">
                              {Math.round(ev.similarity * 100)}%
                            </span>
                          )}
                        </blockquote>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus(active.id, "accepted")}
                    className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:brightness-110"
                  >
                    Keep this connection
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus(active.id, "dismissed")}
                    className="flex-1 rounded-xl border border-hairline px-4 py-2.5 text-sm text-muted transition hover:border-red-400/40 hover:text-red-300"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
