import { z } from "zod";
import { requireUser } from "@/server/session";
import { getMemoryStore } from "@/server/memory/store";
import { deriveTitle, ingestDocument } from "@/server/ingest";

/**
 * Documents API — the ingestion entry point.
 *
 * GET  /api/documents        → list the user's vectorized documents
 * POST /api/documents        → chunk + embed + store (manual capture or URL)
 */

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  url: z.string().url().nullish(),
  content: z.string().max(200_000).optional(),
  source: z.enum(["manual", "watcher", "url", "import"]).optional(),
});

/** Strip an HTML document down to readable text. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchUrlPage(
  url: string,
): Promise<{ text: string; title: string | null }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "SiloBreaker/1.0 (+personal knowledge ingest)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Could not fetch ${url} (${res.status})`);
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i);
  return {
    text: htmlToText(html).slice(0, 200_000),
    title: titleMatch ? htmlToText(titleMatch[1]).slice(0, 200) : null,
  };
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const store = getMemoryStore();
  const [documents, stats] = await Promise.all([
    store.listDocuments(auth.user.id),
    store.stats(auth.user.id),
  ]);

  return Response.json({ documents, stats });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { title, url, content, source } = parsed.data;

  try {
    let text = content?.trim() ?? "";
    let fetchedTitle: string | null = null;
    if (!text && url) {
      const page = await fetchUrlPage(url);
      text = page.text;
      fetchedTitle = page.title;
    }
    if (!text) {
      return Response.json(
        { error: "Provide `content`, or a `url` that can be fetched." },
        { status: 400 },
      );
    }

    const result = await ingestDocument({
      userId: auth.user.id,
      title: title ?? fetchedTitle ?? deriveTitle(text, url),
      content: text,
      url: url ?? null,
      source: source ?? (url && !content ? "url" : "manual"),
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
