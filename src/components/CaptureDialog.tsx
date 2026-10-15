"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
  onCaptured: () => void;
}

/**
 * Capture dialog — the manual entry point into the ingestion pipeline
 * (chunking → embedding → vector memory). The always-on watcher covers
 * everything else; this is for anything read outside the workspace.
 */
export default function CaptureDialog({ onClose, onCaptured }: Props) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url: url || null, content }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Capture failed (${res.status})`);
      }
      onCaptured();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="intercom-rise w-full max-w-lg rounded-3xl border border-hairline bg-surface p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="label">Ingestion pipeline</p>
            <h2 className="display mt-1 text-2xl">Capture into memory</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted transition hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="label">Title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Why vector clocks beat timestamps"
              className="mt-1.5 w-full rounded-xl border border-hairline bg-background px-4 py-3 text-sm outline-none transition focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="label">Source URL (optional)</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://en.wikipedia.org/wiki/…"
              className="mt-1.5 w-full rounded-xl border border-hairline bg-background px-4 py-3 text-sm outline-none transition focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="label">Content</span>
            <textarea
              required
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the passage, article or notes you want to remember forever…"
              className="mt-1.5 w-full resize-y rounded-xl border border-hairline bg-background px-4 py-3 text-sm outline-none transition focus:border-accent"
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Vectorizing…" : "Vectorize & store"}
        </button>

        <p className="mt-3 text-[11px] text-muted">
          Content is chunked, embedded (Nebius <code className="text-accent">Qwen/Qwen3-Embedding-8B</code>)
          and written to your private graph.
        </p>
      </form>
    </div>
  );
}
