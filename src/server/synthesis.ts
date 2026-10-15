import { randomUUID } from "node:crypto";
import { embedText } from "@/server/embeddings";
import { getMemoryStore } from "@/server/memory/store";
import type { InsightRecord, MemoryDocument } from "@/server/memory/types";

/**
 * "Silo-Breaker Synthesis" — the modular, reusable skill.
 *
 * 1. Vectorize the current material.
 * 2. Cross-reference it against the deep persistent vector memory
 *    (everything the user read weeks / months ago).
 * 3. When a connection clears the confidence threshold, ask NVIDIA Nemotron
 *    (via the Nebius Token Factory) to articulate the insight — or fall back
 *    to a deterministic template when no API key is configured.
 * 4. Persist a Proactive Synthesis Alert for the Synthesis Intercom.
 */

export const SYNTHESIS_SKILL = "silo-breaker-synthesis";

/** Minimum cosine similarity for a historical chunk to count as a link. */
const SIMILARITY_THRESHOLD = 0.28;
/** Related documents we surface per synthesis run. */
const MAX_RELATED_DOCS = 3;
const EVIDENCE_PER_DOC = 2;

const CHAT_URL =
  process.env.NEBIUS_CHAT_URL ?? "https://api.tokenfactory.nebius.com/v1/chat/completions";
const CHAT_MODEL = process.env.NEBIUS_CHAT_MODEL ?? "nvidia/Nemotron-3_5-Lightning";

export interface SynthesisOutcome {
  created: InsightRecord[];
  examinedChunks: number;
  topSimilarity: number;
}

function timeAgoLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "earlier today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

async function articulateWithNemotron(args: {
  currentTitle: string;
  currentExcerpt: string;
  relatedTitle: string;
  relatedExcerpt: string;
  relatedAge: string;
}): Promise<{ headline: string; body: string } | null> {
  if (!process.env.NEBIUS_API_KEY) return null;

  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NEBIUS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0.4,
        max_tokens: 500,
        // Nemotron-3.5 emits a "thinking process" preamble by default, which
        // pushes the JSON past max_tokens. Disable reasoning so it answers
        // directly with the JSON payload.
        reasoning_effort: "none",
        messages: [
          {
            role: "system",
            content:
              "You are the Silo-Breaker, a proactive personal AI that reconnects a user's past reading to what they are working on now. " +
              "Reply with STRICT JSON only: {\"headline\": string, \"body\": string}. " +
              "headline: <= 90 chars, bold and direct. body: 1-2 sentences, conversational, " +
              "mention that the older material was read 'the user read X'. Never mention models, APIs or vectors.",
          },
          {
            role: "user",
            content:
              `CURRENT material: "${args.currentTitle}"\n${args.currentExcerpt.slice(0, 900)}\n\n` +
              `PAST material the user read ${args.relatedAge}: "${args.relatedTitle}"\n${args.relatedExcerpt.slice(0, 900)}\n\n` +
              "Explain the connection as a proactive insight.",
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const raw = String(json?.choices?.[0]?.message?.content ?? "");
    // Tolerate ```json fences around the payload.
    const unfenced = raw.replace(/```(?:json)?/g, "").trim();
    const match = unfenced.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn(
        "[synthesis] Nemotron returned no JSON object, using template insight:",
        raw.slice(0, 120),
      );
      return null;
    }
    const parsed = JSON.parse(match[0]) as { headline?: string; body?: string };
    if (!parsed.headline || !parsed.body) return null;
    return { headline: parsed.headline.slice(0, 160), body: parsed.body.slice(0, 600) };
  } catch (err) {
    console.warn(
      "[synthesis] Nemotron call failed, using template insight:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function templateInsight(args: {
  currentTitle: string;
  relatedTitle: string;
  relatedAge: string;
  relatedUrl: string | null;
  similarity: number;
  excerpt: string;
}): { headline: string; body: string } {
  return {
    headline: `${args.relatedTitle} predicted this problem ${args.relatedAge}`,
    body:
      `The problem you're wrestling with now lines up with "${args.relatedTitle}", ` +
      `which you read ${args.relatedAge}. ${args.excerpt.slice(0, 180)}…`,
  };
}

/**
 * Run the Silo-Breaker Synthesis skill for a user's most recent material
 * (or a specific document) and persist any Proactive Synthesis Alerts.
 */
export async function runSynthesis(opts: {
  userId: string;
  documentId?: string;
}): Promise<SynthesisOutcome> {
  const store = getMemoryStore();
  const { userId } = opts;

  const documents = await store.listDocuments(userId);
  if (documents.length < 2) {
    return { created: [], examinedChunks: 0, topSimilarity: 0 };
  }

  const current: MemoryDocument | undefined = opts.documentId
    ? documents.find((d) => d.id === opts.documentId)
    : documents[0];

  if (!current) {
    return { created: [], examinedChunks: 0, topSimilarity: 0 };
  }

  // Vectorize the current material (its leading passage represents intent).
  const currentExcerpt = current.content.slice(0, 1400);
  const query = await embedText(currentExcerpt);

  const matches = await store.searchChunks(userId, query, {
    k: 40,
    excludeDocumentId: current.id,
    minSimilarity: SIMILARITY_THRESHOLD,
  });

  if (matches.length === 0) {
    return { created: [], examinedChunks: 0, topSimilarity: 0 };
  }

  // Group evidence by the historical document it came from.
  const byDocument = new Map<
    string,
    { doc: MemoryDocument; score: number; quotes: string[] }
  >();
  for (const match of matches) {
    const doc = documents.find((d) => d.id === match.chunk.documentId);
    if (!doc) continue;
    const entry = byDocument.get(doc.id) ?? { doc, score: 0, quotes: [] };
    entry.score = Math.max(entry.score, match.similarity);
    if (entry.quotes.length < EVIDENCE_PER_DOC) entry.quotes.push(match.chunk.content);
    byDocument.set(doc.id, entry);
  }

  const ranked = [...byDocument.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RELATED_DOCS);

  const created: InsightRecord[] = [];

  for (const entry of ranked) {
    const age = timeAgoLabel(entry.doc.createdAt);
    const excerpt = entry.quotes.join(" ").slice(0, 700);
    const articulated =
      (await articulateWithNemotron({
        currentTitle: current.title,
        currentExcerpt,
        relatedTitle: entry.doc.title,
        relatedExcerpt: excerpt,
        relatedAge: age,
      })) ??
      templateInsight({
        currentTitle: current.title,
        relatedTitle: entry.doc.title,
        relatedAge: age,
        relatedUrl: entry.doc.url,
        similarity: entry.score,
        excerpt,
      });

    const insight: InsightRecord = {
      id: randomUUID(),
      userId,
      currentDocumentId: current.id,
      relatedDocumentId: entry.doc.id,
      skill: SYNTHESIS_SKILL,
      headline: articulated.headline,
      body: articulated.body,
      score: Number(entry.score.toFixed(4)),
      status: "pending",
      evidence: entry.quotes.map((quote, i) => ({
        quote: quote.slice(0, 280),
        documentTitle: entry.doc.title,
        similarity: i === 0 ? Number(entry.score.toFixed(4)) : undefined,
      })),
      createdAt: new Date().toISOString(),
    };

    await store.putInsight(insight);
    created.push(insight);
  }

  return {
    created,
    examinedChunks: matches.length,
    topSimilarity: ranked[0]?.score ?? 0,
  };
}
