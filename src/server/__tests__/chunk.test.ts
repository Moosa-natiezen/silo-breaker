import { describe, expect, it } from "vitest";
import { chunkText } from "@/server/ingest";

const PARAGRAPH =
  "Vector clocks are data structures that capture causal ordering between " +
  "events in a distributed system. Each process keeps a counter and merges " +
  "maxima whenever it exchanges messages with another process.";

describe("chunkText", () => {
  it("returns nothing for empty or whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\t  ")).toEqual([]);
  });

  it("keeps short documents as a single chunk", () => {
    const chunks = chunkText("A short note about CRDT merge semantics.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("CRDT");
  });

  it("splits long documents into bounded chunks", () => {
    const text = Array.from({ length: 60 }, (_, i) => `Paragraph ${i}: ${PARAGRAPH}`).join(
      "\n\n",
    );
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1600);
      expect(chunk.length).toBeGreaterThan(0);
    }
    // Nothing is silently dropped: every paragraph appears somewhere.
    expect(chunks.join("\n")).toContain("Paragraph 0:");
    expect(chunks.join("\n")).toContain("Paragraph 59:");
  });

  it("carries overlap between consecutive chunks", () => {
    const text = Array.from({ length: 20 }, (_, i) => `Section ${i} ${PARAGRAPH}`).join(
      "\n\n",
    );
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);

    // The next chunk starts inside the previous one (sliding window overlap).
    expect(chunks[0]).toContain(chunks[1].slice(0, 25));
  });
});
