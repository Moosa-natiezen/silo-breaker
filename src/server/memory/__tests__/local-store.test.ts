import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { hashEmbed } from "@/server/embeddings";
import { LocalVectorStore } from "@/server/memory/local-store";
import type { InsightRecord, MemoryChunk, MemoryDocument } from "@/server/memory/types";

const FILE = `test-memory-${process.pid}.json`;
const PATH = join(process.cwd(), "data", FILE);

const USER_A = "user-aaa";
const USER_B = "user-bbb";

function doc(id: string, userId: string, title: string, content: string): MemoryDocument {
  return {
    id,
    userId,
    title,
    url: null,
    source: "manual",
    content,
    createdAt: new Date().toISOString(),
  };
}

function chunk(
  id: string,
  documentId: string,
  userId: string,
  content: string,
): MemoryChunk {
  return {
    id,
    documentId,
    userId,
    chunkIndex: 0,
    content,
    embedding: hashEmbed(content),
    createdAt: new Date().toISOString(),
  };
}

const store = new LocalVectorStore(FILE);

beforeEach(async () => {
  // Clean slate per test file run.
  await store.putDocument(doc("doc-a1", USER_A, "Vector clocks", "vector clocks causal order"));
  await store.putDocument(doc("doc-b1", USER_B, "Bread baking", "hydration and sourdough"));
  await store.putChunks([
    chunk("chunk-a1", "doc-a1", USER_A, "vector clocks capture causal order between events"),
    chunk("chunk-b1", "doc-b1", USER_B, "sourdough hydration depends on flour protein"),
  ]);
});

afterAll(() => {
  if (existsSync(PATH)) unlinkSync(PATH);
});

describe("LocalVectorStore", () => {
  it("lists documents scoped to the owner", async () => {
    const forA = await store.listDocuments(USER_A);
    expect(forA.map((d) => d.id)).toEqual(["doc-a1"]);
    expect(await store.listDocuments(USER_B)).toHaveLength(1);
    expect(await store.getDocument(USER_A, "doc-b1")).toBeNull();
  });

  it("returns nearest chunks, never crossing user boundaries", async () => {
    const matches = await store.searchChunks(USER_A, hashEmbed("causal order in distributed systems"));
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].chunk.id).toBe("chunk-a1");
    expect(matches.every((m) => m.chunk.userId === USER_A)).toBe(true);
  });

  it("excludes the document the query came from", async () => {
    const matches = await store.searchChunks(USER_A, hashEmbed("causal order"), {
      excludeDocumentId: "doc-a1",
    });
    expect(matches).toHaveLength(0);
  });

  it("updates insight status only for the owner", async () => {
    const insight: InsightRecord = {
      id: "insight-1",
      userId: USER_A,
      currentDocumentId: "doc-a1",
      relatedDocumentId: null,
      skill: "silo-breaker-synthesis",
      headline: "Connected!",
      body: "body",
      score: 0.9,
      status: "pending",
      evidence: [],
      createdAt: new Date().toISOString(),
    };
    await store.putInsight(insight);

    await store.updateInsightStatus(USER_B, "insight-1", "dismissed");
    expect((await store.listInsights(USER_A))[0].status).toBe("pending");

    await store.updateInsightStatus(USER_A, "insight-1", "accepted");
    expect((await store.listInsights(USER_A))[0].status).toBe("accepted");
  });

  it("reports per-user stats", async () => {
    const stats = await store.stats(USER_A);
    // 1 document, 1 chunk and the insight created by the test above.
    expect(stats).toEqual({ documents: 1, chunks: 1, insights: 1 });
  });
});
