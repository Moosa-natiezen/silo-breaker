/**
 * MemoryStore — the deep persistent vector memory abstraction.
 *
 * Two implementations:
 *   • NeonVectorStore  : Neon Postgres + pgvector (production target)
 *   • LocalVectorStore : JSON-file backed, cosine similarity in-process
 *                        (development / hackathon demo without DATABASE_URL)
 *
 * Selection is automatic via DATABASE_URL.
 */

export type DocumentSource = "manual" | "watcher" | "url" | "import";

export interface MemoryDocument {
  id: string;
  userId: string;
  title: string;
  url: string | null;
  source: DocumentSource;
  content: string;
  createdAt: string; // ISO timestamp
}

export interface MemoryChunk {
  id: string;
  documentId: string;
  userId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  createdAt: string;
}

export interface ChunkMatch {
  chunk: MemoryChunk;
  similarity: number;
}

export interface InsightRecord {
  id: string;
  userId: string;
  currentDocumentId: string | null;
  relatedDocumentId: string | null;
  skill: string;
  headline: string;
  body: string;
  score: number;
  status: "pending" | "accepted" | "dismissed";
  evidence: Array<{
    quote: string;
    documentTitle?: string;
    similarity?: number;
  }>;
  createdAt: string;
}

export interface MemoryStore {
  readonly kind: "neon" | "local";

  putDocument(doc: MemoryDocument): Promise<void>;
  listDocuments(userId: string): Promise<MemoryDocument[]>;
  getDocument(userId: string, id: string): Promise<MemoryDocument | null>;

  putChunks(chunks: MemoryChunk[]): Promise<void>;
  searchChunks(
    userId: string,
    embedding: number[],
    opts?: { k?: number; excludeDocumentId?: string; minSimilarity?: number },
  ): Promise<ChunkMatch[]>;

  putInsight(insight: InsightRecord): Promise<void>;
  listInsights(
    userId: string,
    opts?: { status?: InsightRecord["status"]; limit?: number },
  ): Promise<InsightRecord[]>;
  updateInsightStatus(
    userId: string,
    id: string,
    status: InsightRecord["status"],
  ): Promise<void>;

  stats(userId: string): Promise<{ documents: number; chunks: number; insights: number }>;
}
