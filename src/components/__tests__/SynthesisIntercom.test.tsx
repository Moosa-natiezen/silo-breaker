// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SynthesisIntercom from "@/components/SynthesisIntercom";
import type { DocumentPreview, InsightView } from "@/lib/types";

const NOW = new Date().toISOString();

const documents: DocumentPreview[] = [
  {
    id: "doc-current",
    userId: "u1",
    title: "Replication layer redesign",
    url: null,
    source: "manual",
    createdAt: NOW,
    preview: "current material",
  },
  {
    id: "doc-related",
    userId: "u1",
    title: "Random Wikipedia article on knowledge graphs",
    url: "https://en.wikipedia.org/wiki/Knowledge_graph",
    source: "url",
    createdAt: NOW,
    preview: "historical material",
  },
];

function makeInsight(overrides: Partial<InsightView> = {}): InsightView {
  return {
    id: "insight-1",
    userId: "u1",
    currentDocumentId: "doc-current",
    relatedDocumentId: "doc-related",
    skill: "silo-breaker-synthesis",
    headline:
      "Hey, this new problem you are trying to solve is actually super similar to that random article you read 4 weeks ago",
    body: "The connection spans three weeks of reading.",
    score: 0.72,
    status: "pending",
    evidence: [{ quote: "entities and relations form an extended map", similarity: 0.72 }],
    createdAt: NOW,
    currentTitle: "Replication layer redesign",
    relatedTitle: "Random Wikipedia article on knowledge graphs",
    ...overrides,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/documents/doc-")) {
      const id = url.split("/").pop();
      return Promise.resolve(
        Response.json({
          document: {
            id,
            title: id === "doc-current" ? "Replication layer redesign" : "Historical article",
            content:
              id === "doc-current"
                ? "CURRENT WORKSPACE CONTENT: concurrent writes need logical clocks."
                : "HISTORICAL CONTEXT CONTENT: knowledge graphs connect entities over time.",
          },
        }),
      );
    }
    if (init?.method === "PATCH") {
      return Promise.resolve(Response.json({ ok: true }));
    }
    return Promise.resolve(Response.json({ insights: [] }));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Synthesis Intercom", () => {
  it("intervenes autonomously when a proactive synthesis alert arrives", async () => {
    render(
      <SynthesisIntercom insights={[makeInsight()]} documents={documents} onChanged={() => {}} />,
    );

    // The panel expands upward by itself — no user click required (Flow 2).
    await waitFor(() =>
      expect(screen.getByText(/super similar to that random article/i)).toBeTruthy(),
    );
    expect(screen.getByText("Synthesis Intercom")).toBeTruthy();
  });

  it("opens the dual-pane view and retrieves historical context on click", async () => {
    const user = userEvent.setup();
    render(
      <SynthesisIntercom insights={[makeInsight()]} documents={documents} onChanged={() => {}} />,
    );

    await waitFor(() =>
      expect(screen.getByText(/super similar to that random article/i)).toBeTruthy(),
    );

    // Open the alert from the list → detail view with the proactive banner.
    await user.click(screen.getByText(/super similar to that random article/i));

    expect(await screen.findByText("Proactive Synthesis Alert")).toBeTruthy();
    expect(await screen.findByText("Current workspace")).toBeTruthy();
    expect(await screen.findByText("Retrieved from memory")).toBeTruthy();

    // Both panes hydrate from the API (left = now, right = from memory).
    expect(await screen.findByText(/CURRENT WORKSPACE CONTENT/)).toBeTruthy();
    expect(await screen.findByText(/HISTORICAL CONTEXT CONTENT/)).toBeTruthy();

    // Evidence fragments are surfaced.
    expect(await screen.findByText(/entities and relations form an extended map/)).toBeTruthy();
  });

  it("acknowledges a connection via PATCH when kept", async () => {
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <SynthesisIntercom
        insights={[makeInsight()]}
        documents={documents}
        onChanged={onChanged}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/super similar to that random article/i)).toBeTruthy(),
    );
    await user.click(screen.getByText(/super similar to that random article/i));
    await user.click(await screen.findByText("Keep this connection"));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        (call) => String(call[0]).includes("/api/insights/insight-1") && call[1]?.method === "PATCH",
      );
      expect(patchCall).toBeTruthy();
      expect(String(patchCall![1]!.body)).toContain('"accepted"');
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it("stays collapsed when there is nothing to synthesize", () => {
    render(<SynthesisIntercom insights={[]} documents={documents} onChanged={() => {}} />);
    expect(screen.queryByText("Proactive Synthesis Alert")).toBeNull();
    expect(screen.queryByText(/super similar to that random article/i)).toBeNull();
    expect(screen.getByLabelText("Open Synthesis Intercom")).toBeTruthy();
  });
});
