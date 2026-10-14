"use client";

import { useEffect, useState } from "react";

/**
 * Flow 1, step 3: the transitional animation shown after first login that
 * introduces the user to their (empty) knowledge graph.
 */
export default function OnboardingOverlay({ onDismiss }: { onDismiss: () => void }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 700);
    const t2 = setTimeout(() => setPhase(2), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/85 backdrop-blur-md"
      onClick={onDismiss}
    >
      <div
        className="intercom-rise mx-6 max-w-lg rounded-3xl border border-hairline bg-surface p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-6 flex items-center justify-center gap-3">
          <span className="status-orb" data-active={phase >= 1 ? "true" : "false"} />
          <span className="label">Background engine online</span>
        </div>

        <h2 className="display text-3xl">
          {phase >= 1 ? "Your graph is listening." : "Pairing with your workspace…"}
        </h2>

        <p className="mt-4 text-sm leading-relaxed text-muted">
          {phase >= 2
            ? "This is your lifelong knowledge canvas. Everything you capture is vectorized into private memory — and the Silo-Breaker skill will reconnect it to new material the moment a link appears."
            : "Analyzing spatial reading rhythms and document relationships…"}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {["Deep persistent vector memory", "Modular reusable skills", "Proactive synthesis"].map(
            (chip, i) => (
              <span
                key={chip}
                className={`rounded-full border px-3 py-1 text-[11px] transition-all duration-500 ${
                  phase * 1 > i
                    ? "border-accent/40 bg-accent-dim text-accent opacity-100"
                    : "border-hairline text-muted opacity-40"
                }`}
              >
                {chip}
              </span>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-8 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background transition hover:brightness-110"
        >
          Enter the canvas
        </button>
      </div>
    </div>
  );
}
