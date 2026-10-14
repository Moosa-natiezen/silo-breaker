import type { InsightRecord, MemoryDocument } from "@/server/memory/types";

/** Document as sent to the client (content trimmed to a preview). */
export interface DocumentPreview {
  id: string;
  userId: string;
  title: string;
  url: string | null;
  source: MemoryDocument["source"];
  createdAt: string;
  preview: string;
}

/** Insight enriched with the titles of both connected documents. */
export interface InsightView extends InsightRecord {
  currentTitle: string | null;
  relatedTitle: string | null;
}

export interface GraphStats {
  documents: number;
  chunks: number;
  insights: number;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
