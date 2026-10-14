/**
 * Embedding layer.
 *
 * Primary path: Nebius Token Factory embeddings API (BAAI/bge-en-icl, 1536 dims)
 *   POST https://api.tokenfactory.nebius.com/v1/embeddings
 *
 * Offline fallback: deterministic hashed bag-of-tokens embedding with the same
 * dimensionality, so the knowledge graph keeps working without an API key
 * (useful for local development and CI). Similarity is meaningful for text
 * that shares vocabulary, which is enough to exercise the synthesis engine.
 */

export const EMBEDDING_DIM = 1536;
export const EMBEDDINGS_URL =
  process.env.NEBIUS_EMBEDDINGS_URL ??
  "https://api.tokenfactory.nebius.com/v1/embeddings";
export const EMBEDDING_MODEL =
  process.env.NEBIUS_EMBEDDING_MODEL ?? "BAAI/bge-en-icl";

type NebiusEmbeddingResponse = {
  data?: Array<{ index: number; embedding: number[] }>;
  error?: { message?: string };
};

export function hasNebiusKey(): boolean {
  return Boolean(process.env.NEBIUS_API_KEY);
}

/** Normalize any vector to unit length (cosine similarity friendly). */
export function normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm);
}

/** Cosine similarity between two unit or non-unit vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Deterministic local embedding: signed feature hashing over lowercase tokens
 * and character trigrams, L2-normalized. Same input ⇒ same vector, on every
 * machine, with no network access.
 */
export function hashEmbed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const push = (feature: string, weight = 1) => {
    const h = fnv1a(feature);
    const idx = h % EMBEDDING_DIM;
    const sign = (h >>> 15) % 2 === 0 ? 1 : -1;
    vec[idx] += sign * weight;
    // Second tap (double hashing) reduces collision impact.
    const idx2 = (h ^ 0x9e3779b9) % EMBEDDING_DIM;
    vec[idx2] -= sign * weight * 0.5;
  };

  for (const token of tokens) {
    push(token, 1);
    push(`w:${token}`, 0.5);
    for (let i = 0; i + 3 <= token.length; i++) {
      push(`t:${token.slice(i, i + 3)}`, 0.15);
    }
  }
  // Document-length shaping so short/long texts stay comparable.
  push(`len:${Math.min(tokens.length, 400)}`, 0.05);

  return normalize(vec);
}

async function embedViaNebius(texts: string[]): Promise<number[][]> {
  const res = await fetch(EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NEBIUS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Nebius embeddings API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as NebiusEmbeddingResponse;
  const data = json.data ?? [];
  if (data.length !== texts.length) {
    throw new Error("Nebius embeddings API returned an unexpected payload shape.");
  }
  return data
    .sort((a, b) => a.index - b.index)
    .map((d) => normalize(d.embedding));
}

/**
 * Embed a batch of texts. Uses the Nebius Token Factory API when
 * NEBIUS_API_KEY is present, otherwise the deterministic local fallback.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (hasNebiusKey()) {
    try {
      return await embedViaNebius(texts);
    } catch (err) {
      console.warn(
        "[embeddings] Nebius call failed, falling back to local embeddings:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  return texts.map((t) => hashEmbed(t));
}

/** Embed a single text. */
export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}
