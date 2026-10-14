import { describe, expect, it } from "vitest";
import {
  EMBEDDING_DIM,
  cosineSimilarity,
  embedText,
  hashEmbed,
  normalize,
} from "@/server/embeddings";

describe("hashEmbed", () => {
  it("produces fixed-size, unit-length vectors", () => {
    const vec = hashEmbed("conflict-free replicated data types converge without coordination");
    expect(vec).toHaveLength(EMBEDDING_DIM);
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("is deterministic for identical input", () => {
    const a = hashEmbed("the same sentence twice");
    const b = hashEmbed("the same sentence twice");
    expect(a).toEqual(b);
  });

  it("scores related text above unrelated text", () => {
    const current = hashEmbed(
      "Detecting concurrent writes with vector clocks and logical time in replication.",
    );
    const related = hashEmbed(
      "Vector clocks let replicas decide whether events are ordered or concurrent.",
    );
    const unrelated = hashEmbed(
      "Sourdough hydration percentages depend on flour protein and ambient humidity.",
    );

    expect(cosineSimilarity(current, related)).toBeGreaterThan(
      cosineSimilarity(current, unrelated),
    );
  });
});

describe("normalize / cosineSimilarity", () => {
  it("normalizes to unit length", () => {
    const v = normalize([3, 4]);
    expect(v[0]).toBeCloseTo(0.6, 6);
    expect(v[1]).toBeCloseTo(0.8, 6);
  });

  it("returns 1 for identical vectors and 0 for orthogonal ones", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 6);
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe("embedText", () => {
  it("returns a 1536-dim vector without an API key (offline fallback)", async () => {
    const vec = await embedText("personal knowledge graph");
    expect(vec).toHaveLength(EMBEDDING_DIM);
  });
});
