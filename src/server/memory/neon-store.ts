import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { chunks, documents, insights } from "@/server/db/schema";
import type {
  ChunkMatch,
  InsightRecord,
  MemoryChunk,
  MemoryDocument,
  MemoryStore,
} from "./types";

function iso(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

/**
 * Neon Postgres + pgvector implementation of MemoryStore.
 * Cosine distance via pgvector's vector_cosine_ops index.
 */
export class NeonVectorStore implements MemoryStore {
  readonly kind = "neon" as const;

  async putDocument(doc: MemoryDocument): Promise<void> {
    const db = getDb();
    await db
      .insert(documents)
      .values({
        id: doc.id,
        userId: doc.userId,
        title: doc.title,
        url: doc.url,
        source: doc.source,
        content: doc.content,
        createdAt: new Date(doc.createdAt),
      })
      .onConflictDoUpdate({
        target: documents.id,
        set: { title: doc.title, content: doc.content },
      });
  }

  async listDocuments(userId: string): Promise<MemoryDocument[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      url: r.url,
      source: r.source as MemoryDocument["source"],
      content: r.content,
      createdAt: iso(r.createdAt),
    }));
  }

  async getDocument(userId: string, id: string): Promise<MemoryDocument | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      userId: r.userId,
      title: r.title,
      url: r.url,
      source: r.source as MemoryDocument["source"],
      content: r.content,
      createdAt: iso(r.createdAt),
    };
  }

  async putChunks(newChunks: MemoryChunk[]): Promise<void> {
    if (newChunks.length === 0) return;
    const db = getDb();
    await db
      .insert(chunks)
      .values(
        newChunks.map((c) => ({
          id: c.id,
          documentId: c.documentId,
          userId: c.userId,
          chunkIndex: c.chunkIndex,
          content: c.content,
          embedding: c.embedding,
          createdAt: new Date(c.createdAt),
        })),
      )
      .onConflictDoNothing({ target: chunks.id });
  }

  async searchChunks(
    userId: string,
    embedding: number[],
    opts: { k?: number; excludeDocumentId?: string; minSimilarity?: number } = {},
  ): Promise<ChunkMatch[]> {
    const { k = 8, excludeDocumentId, minSimilarity = -1 } = opts;
    const db = getDb();
    const distance = sql<number>`(${chunks.embedding} <=> ${JSON.stringify(embedding)}::vector)`;

    const rows = await db
      .select({
        id: chunks.id,
        documentId: chunks.documentId,
        userId: chunks.userId,
        chunkIndex: chunks.chunkIndex,
        content: chunks.content,
        createdAt: chunks.createdAt,
        similarity: sql<number>`(1 - ${distance})`,
      })
      .from(chunks)
      .where(
        and(
          eq(chunks.userId, userId),
          excludeDocumentId
            ? sql`${chunks.documentId} <> ${excludeDocumentId}`
            : sql`true`,
        ),
      )
      .orderBy(distance)
      .limit(k);

    return rows
      .map((r) => ({
        chunk: {
          id: r.id,
          documentId: r.documentId,
          userId: r.userId,
          chunkIndex: r.chunkIndex,
          content: r.content,
          embedding: [],
          createdAt: iso(r.createdAt),
        } satisfies MemoryChunk,
        similarity: Number(r.similarity),
      }))
      .filter((m) => m.similarity >= minSimilarity);
  }

  async putInsight(insight: InsightRecord): Promise<void> {
    const db = getDb();
    await db
      .insert(insights)
      .values({
        id: insight.id,
        userId: insight.userId,
        currentDocumentId: insight.currentDocumentId,
        relatedDocumentId: insight.relatedDocumentId,
        skill: insight.skill,
        headline: insight.headline,
        body: insight.body,
        score: insight.score,
        status: insight.status,
        evidence: insight.evidence,
        createdAt: new Date(insight.createdAt),
      })
      .onConflictDoUpdate({
        target: insights.id,
        set: { status: insight.status },
      });
  }

  async listInsights(
    userId: string,
    opts: { status?: InsightRecord["status"]; limit?: number } = {},
  ): Promise<InsightRecord[]> {
    const { status, limit = 50 } = opts;
    const db = getDb();
    const rows = await db
      .select()
      .from(insights)
      .where(
        and(
          eq(insights.userId, userId),
          status ? eq(insights.status, status) : sql`true`,
        ),
      )
      .orderBy(desc(insights.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      currentDocumentId: r.currentDocumentId,
      relatedDocumentId: r.relatedDocumentId,
      skill: r.skill,
      headline: r.headline,
      body: r.body,
      score: Number(r.score),
      status: r.status as InsightRecord["status"],
      evidence: (r.evidence ?? []) as InsightRecord["evidence"],
      createdAt: iso(r.createdAt),
    }));
  }

  async updateInsightStatus(
    userId: string,
    id: string,
    status: InsightRecord["status"],
  ): Promise<void> {
    const db = getDb();
    await db
      .update(insights)
      .set({ status })
      .where(and(eq(insights.id, id), eq(insights.userId, userId)));
  }

  async stats(
    userId: string,
  ): Promise<{ documents: number; chunks: number; insights: number }> {
    const db = getDb();
    const [docCount] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.userId, userId));
    const [chunkCount] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(chunks)
      .where(eq(chunks.userId, userId));
    const [insightCount] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(insights)
      .where(eq(insights.userId, userId));
    return {
      documents: docCount?.value ?? 0,
      chunks: chunkCount?.value ?? 0,
      insights: insightCount?.value ?? 0,
    };
  }
}

export function newId(): string {
  return randomUUID();
}
