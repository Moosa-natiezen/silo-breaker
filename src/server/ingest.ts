import { randomUUID } from "node:crypto";
import { embedTexts } from "@/server/embeddings";
import { getMemoryStore } from "@/server/memory/store";
import type { DocumentSource, MemoryChunk, MemoryDocument } from "@/server/memory/types";

/**
 * Continuous ingestion pipeline:
 *   raw content → chunk (sliding window with overlap) → embed → vector memory
 *
 * Used by the HTTP capture endpoint, the URL importer and the always-on
 * workspace watcher (scripts/watch-workspace.ts).
 */

const CHUNK_SIZE = 1200; // characters per chunk
const CHUNK_OVERLAP = 200; // characters of context carried into the next chunk
const MIN_CHUNK_SIZE = 80; // drop trailing crumbs

/** Split text into overlapping chunks on paragraph/sentence boundaries. */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);

    if (end < normalized.length) {
      // Prefer a paragraph break, then a sentence break, then a word break.
      const window = normalized.slice(start, end);
      const paraBreak = window.lastIndexOf("\n\n");
      const sentenceBreak = Math.max(
        window.lastIndexOf(". "),
        window.lastIndexOf("? "),
        window.lastIndexOf("! "),
        window.lastIndexOf("。\n"),
      );
      const wordBreak = window.lastIndexOf(" ");
      const cut = paraBreak > CHUNK_SIZE * 0.4
        ? paraBreak
        : sentenceBreak > CHUNK_SIZE * 0.4
          ? sentenceBreak
          : wordBreak > CHUNK_SIZE * 0.4
            ? wordBreak
            : CHUNK_SIZE;
      end = start + cut + 1;
    }

    const piece = normalized.slice(start, end).trim();
    if (piece.length >= MIN_CHUNK_SIZE || chunks.length === 0) {
      if (piece) chunks.push(piece);
    }

    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

export interface IngestInput {
  userId: string;
  title: string;
  content: string;
  url?: string | null;
  source?: DocumentSource;
}

export interface IngestResult {
  document: MemoryDocument;
  chunkCount: number;
}

/** Chunk, embed and persist a document into the deep persistent vector memory. */
export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const store = getMemoryStore();
  const now = new Date().toISOString();

  const document: MemoryDocument = {
    id: randomUUID(),
    userId: input.userId,
    title: input.title.trim() || "Untitled capture",
    url: input.url ?? null,
    source: input.source ?? "manual",
    content: input.content,
    createdAt: now,
  };

  const pieces = chunkText(input.content);
  if (pieces.length === 0) {
    throw new Error("Document has no content to vectorize.");
  }

  const vectors = await embedTexts(pieces);
  const chunks: MemoryChunk[] = pieces.map((piece, i) => ({
    id: randomUUID(),
    documentId: document.id,
    userId: input.userId,
    chunkIndex: i,
    content: piece,
    embedding: vectors[i],
    createdAt: now,
  }));

  await store.putDocument(document);
  await store.putChunks(chunks);

  return { document, chunkCount: chunks.length };
}

/**
 * Best-effort title extraction for raw URLs / HTML bodies.
 */
export function deriveTitle(content: string, url?: string | null): string {
  const firstLine = content
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (firstLine && firstLine.length <= 90) return firstLine;
  if (firstLine) return `${firstLine.slice(0, 87)}…`;
  if (url) {
    try {
      return new URL(url).pathname.split("/").filter(Boolean).join(" / ") || url;
    } catch {
      return url;
    }
  }
  return "Untitled capture";
}
