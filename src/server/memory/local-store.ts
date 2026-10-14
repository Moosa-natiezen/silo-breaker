import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
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

  constructor(fileName = "local-memory.json") {
    const dir = join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, fileName);
  }

  private load() {
    if (this.loaded) return;
    this.loaded = true;
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
  }

  async putDocument(doc: MemoryDocument): Promise<void> {
    this.load();
    this.documents.set(doc.id, doc);
    this.flush();
  }

  async listDocuments(userId: string): Promise<MemoryDocument[]> {
    this.load();
    return [...this.documents.values()]
      .filter((d) => d.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getDocument(userId: string, id: string): Promise<MemoryDocument | null> {
    this.load();
    const doc = this.documents.get(id);
    return doc && doc.userId === userId ? doc : null;
  }

  async putChunks(chunks: MemoryChunk[]): Promise<void> {
    this.load();
    for (const chunk of chunks) this.chunks.set(chunk.id, chunk);
    this.flush();
  }

  async searchChunks(
    userId: string,
    embedding: number[],
    opts: { k?: number; excludeDocumentId?: string; minSimilarity?: number } = {},
  ): Promise<ChunkMatch[]> {
    this.load();
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
    this.load();
    this.insights.set(insight.id, insight);
    this.flush();
  }

  async listInsights(
    userId: string,
    opts: { status?: InsightRecord["status"]; limit?: number } = {},
  ): Promise<InsightRecord[]> {
    this.load();
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
    this.load();
    const insight = this.insights.get(id);
    if (!insight || insight.userId !== userId) return;
    this.insights.set(id, { ...insight, status });
    this.flush();
  }

  async stats(userId: string): Promise<{ documents: number; chunks: number; insights: number }> {
    this.load();
    const documents = [...this.documents.values()].filter((d) => d.userId === userId).length;
    const chunks = [...this.chunks.values()].filter((c) => c.userId === userId).length;
    const insights = [...this.insights.values()].filter((i) => i.userId === userId).length;
    return { documents, chunks, insights };
  }
}
