"use client";

import { useMemo, useState } from "react";
import type { DocumentPreview } from "@/lib/types";
import { timeAgo } from "@/lib/types";

interface Props {
  documents: DocumentPreview[];
  onAddDocument: () => void;
}

const SOURCE_LABEL: Record<DocumentPreview["source"], string> = {
  manual: "Typed capture",
  watcher: "Workspace watcher",
  url: "Web import",
  import: "Bulk import",
};

/** Session-start timestamp: keeps render pure while staying accurate enough
 *  for a 8-week reading-rhythm chart. */
const SESSION_NOW = Date.now();

/** Weekly reading rhythm over the last 8 weeks. */
function ReadingRhythm({ documents }: { documents: DocumentPreview[] }) {
  const buckets = useMemo(() => {
    const now = SESSION_NOW;
    const week = 7 * 24 * 60 * 60 * 1000;
    const out = new Array(8).fill(0);
    for (const doc of documents) {
      const age = now - new Date(doc.createdAt).getTime();
      const idx = 7 - Math.floor(age / week);
      if (idx >= 0 && idx < 8) out[idx] += 1;
    }
    return out as number[];
  }, [documents]);

  const max = Math.max(1, ...buckets);

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <p className="label">Spatial reading rhythm</p>
          <p className="display mt-2 text-3xl">
            {documents.length}
            <span className="ml-2 text-base text-muted">documents vectorized</span>
          </p>
        </div>
        <span className="status-orb mt-1" data-active="true" />
      </div>

      <div className="mt-6 flex h-24 items-end gap-2">
        {buckets.map((count, i) => (
          <div key={i} className="group flex-1">
            <div
              className="rounded-md bg-accent/25 transition-all group-hover:bg-accent"
              style={{
                height: `${Math.max(6, (count / max) * 96)}px`,
                opacity: 0.35 + (i / 8) * 0.65,
              }}
              title={`${count} documents`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        <span>8 weeks ago</span>
        <span>today</span>
      </div>
    </div>
  );
}

function DocumentCard({
  doc,
  expanded,
  onToggle,
}: {
  doc: DocumentPreview;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="bento-card group flex h-full w-full flex-col p-5 text-left"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="label truncate">{SOURCE_LABEL[doc.source]}</span>
        <span className="text-[11px] text-muted">{timeAgo(doc.createdAt)}</span>
      </div>

      <h3 className="mt-3 line-clamp-2 text-base font-medium leading-snug text-ink">
        {doc.title}
      </h3>

      <p
        className={`mt-2 text-sm leading-relaxed text-muted ${expanded ? "line-clamp-none" : "line-clamp-3"}`}
      >
        {doc.preview || "No preview available."}
      </p>

      <div className="mt-auto flex items-center justify-between pt-4">
        <div className="flex flex-wrap gap-1.5">
          {(doc.url ? [new URL(doc.url).hostname.replace(/^www\./, "")] : [])
            .concat([])
            .map((host) => (
              <span
                key={host}
                className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-muted"
              >
                {host}
              </span>
            ))}
          <span className="rounded-full border border-accent/30 bg-accent-dim px-2 py-0.5 text-[10px] text-accent opacity-0 transition group-hover:opacity-100">
            connections ↑
          </span>
        </div>
        <span className="text-[11px] text-accent opacity-0 transition group-hover:opacity-100">
          {expanded ? "collapse" : "expand"}
        </span>
      </div>
    </button>
  );
}

export default function KnowledgeCanvas({ documents, onAddDocument }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <section className="bento-card fade-up flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
        <span className="status-orb" data-active="false" />
        <h2 className="display mt-6 text-3xl">Your knowledge graph is empty.</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          The background engine is pairing with your workspace. Start by saving
          something you are reading now — Silo Breaker will remember it for the
          next three months, and surface it the moment it becomes relevant.
        </p>
        <button
          type="button"
          onClick={onAddDocument}
          className="mt-8 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-background transition hover:brightness-110"
        >
          Capture your first document
        </button>
      </section>
    );
  }

  const latest = documents[0];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-6">
      {/* Bento: reading rhythm spans wider */}
      <div className="bento-card fade-up p-6 md:col-span-4">
        <ReadingRhythm documents={documents} />
      </div>

      {/* Bento: current focus */}
      <div className="bento-card fade-up flex flex-col p-6 md:col-span-2" style={{ animationDelay: "60ms" }}>
        <p className="label">Current focus</p>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink">
          {latest.title}
        </p>
        <p className="mt-2 text-[11px] text-muted">vectorized {timeAgo(latest.createdAt)}</p>
        <div className="mt-auto pt-4">
          <span className="rounded-full border border-status/40 bg-status-dim px-2.5 py-1 text-[10px] text-status">
            observer watching
          </span>
        </div>
      </div>

      {/* Document cards */}
      {documents.slice(1).map((doc, i) => (
        <div
          key={doc.id}
          className="fade-up md:col-span-2"
          style={{ animationDelay: `${80 + i * 40}ms` }}
        >
          <DocumentCard
            doc={doc}
            expanded={expandedId === doc.id}
            onToggle={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
          />
        </div>
      ))}
    </section>
  );
}
