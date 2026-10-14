import { mkdirSync, readFileSync, existsSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cosineSimilarity } from "@/server/embeddings";
import type {
  ChunkMatch,
  InsightRecord,
  MemoryChunk,
  MemoryDocument,
  MemoryStore,
} from "./types";

interface PersistedState {
  documents: MemoryDocument[];
  chunks: MemoryChunk[];
  insights: InsightRecord[];
}

/**
 * File-backed memory store used when DATABASE_URL is not configured.
 * Everything stays on the developer's machine — the hyper-private default.
 */
export class LocalVectorStore implements MemoryStore {
  readonly kind = "local" as const;
  private readonly file: string;
  private documents = new Map<string, MemoryDocument>();
  private chunks = new Map<string, MemoryChunk>();
  private insights = new Map<string, InsightRecord>();
  private loaded = false;
  private mtime = -1;

  constructor(fileName = "local-memory.json") {
    const dir = join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, fileName);
  }

  /**
   * The Next.js server-component bundle and the route-handler bundle each
   * instantiate this store, and the background engine writes from another
   * module graph again — so re-read the file whenever its mtime changes.
   * Without this, one instance could serve a stale (or empty) graph.
   */
  private ensureFresh() {
    let mtime = 0;
    try {
      mtime = existsSync(this.file) ? statSync(this.file).mtimeMs : 0;
    } catch {
      mtime = 0;
    }
    if (!this.loaded || mtime !== this.mtime) {
      this.load();
      this.mtime = mtime;
    }
  }

  private load() {
    this.loaded = true;
    this.documents.clear();
    this.chunks.clear();
    this.insights.clear();
    if (!existsSync(this.file)) return;
    try {
      const raw = JSON.parse(readFileSync(this.file, "utf8")) as PersistedState;
      for (const d of raw.documents ?? []) this.documents.set(d.id, d);
      for (const c of raw.chunks ?? []) this.chunks.set(c.id, c);
      for (const i of raw.insights ?? []) this.insights.set(i.id, i);
    } catch (err) {
      console.warn("[local-store] Could not parse persisted state:", err);
    }
  }

  private flush() {
    const state: PersistedState = {
      documents: [...this.documents.values()],
      chunks: [...this.chunks.values()],
      insights: [...this.insights.values()],
    };
    writeFileSync(this.file, JSON.stringify(state), "utf8");
    try {
      this.mtime = statSync(this.file).mtimeMs;
    } catch {
      this.mtime = -1;
    }
  }

  async putDocument(doc: MemoryDocument): Promise<void> {
    this.ensureFresh();
    this.documents.set(doc.id, doc);
    this.flush();
  }

  async listDocuments(userId: string): Promise<MemoryDocument[]> {
    this.ensureFresh();
    return [...this.documents.values()]
      .filter((d) => d.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getDocument(userId: string, id: string): Promise<MemoryDocument | null> {
    this.ensureFresh();
    const doc = this.documents.get(id);
    return doc && doc.userId === userId ? doc : null;
  }

  async putChunks(chunks: MemoryChunk[]): Promise<void> {
    this.ensureFresh();
    for (const chunk of chunks) this.chunks.set(chunk.id, chunk);
    this.flush();
  }

  async searchChunks(
    userId: string,
    embedding: number[],
    opts: { k?: number; excludeDocumentId?: string; minSimilarity?: number } = {},
  ): Promise<ChunkMatch[]> {
    this.ensureFresh();
    const { k = 8, excludeDocumentId, minSimilarity = -1 } = opts;
    const matches: ChunkMatch[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.userId !== userId) continue;
      if (excludeDocumentId && chunk.documentId === excludeDocumentId) continue;
      const similarity = cosineSimilarity(embedding, chunk.embedding);
      if (similarity >= minSimilarity) matches.push({ chunk, similarity });
    }
    return matches.sort((a, b) => b.similarity - a.similarity).slice(0, k);
  }

  async putInsight(insight: InsightRecord): Promise<void> {
    this.ensureFresh();
    this.insights.set(insight.id, insight);
    this.flush();
  }

  async listInsights(
    userId: string,
    opts: { status?: InsightRecord["status"]; limit?: number } = {},
  ): Promise<InsightRecord[]> {
    this.ensureFresh();
    const { status, limit = 50 } = opts;
    return [...this.insights.values()]
      .filter((i) => i.userId === userId && (!status || i.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async updateInsightStatus(
    userId: string,
    id: string,
    status: InsightRecord["status"],
  ): Promise<void> {
    this.ensureFresh();
    const insight = this.insights.get(id);
    if (!insight || insight.userId !== userId) return;
    this.insights.set(id, { ...insight, status });
    this.flush();
  }

  async stats(userId: string): Promise<{ documents: number; chunks: number; insights: number }> {
    this.ensureFresh();
    const documents = [...this.documents.values()].filter((d) => d.userId === userId).length;
    const chunks = [...this.chunks.values()].filter((c) => c.userId === userId).length;
    const insights = [...this.insights.values()].filter((i) => i.userId === userId).length;
    return { documents, chunks, insights };
  }
}
