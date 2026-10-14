"use client";

import { useState } from "react";

interface Props {
  user: { name: string; email: string };
  engineActive: boolean;
  pendingInsights: number;
  onSignOut: () => void;
}

/**
 * The Ambient Header — a blurred, translucent glassmorphism strip with the
 * Better Auth profile controls and the pulsing status orb that indicates the
 * background engine state:
 *   • Nemotron Green  → always-on passive observer (idle)
 *   • Nebius Cyan     → actively synthesizing an insight
 */
export default function AmbientHeader({
  user,
  engineActive,
  pendingInsights,
  onSignOut,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials =
    user.name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SB";

  return (
    <header className="glass-strip sticky top-0 z-40">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <span
            className="status-orb"
            data-active={engineActive ? "true" : "false"}
            title={
              engineActive
                ? "Silo-Breaker Synthesis is active"
                : "Background engine is observing"
            }
          />
          <div className="leading-tight">
            <p className="display text-base tracking-tight">
              Silo<span className="text-accent">/</span>Breaker
            </p>
            <p className="text-[11px] text-muted">
              {engineActive ? "Synthesizing connection…" : "Observer active · pairing with workspace"}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span className="rounded-full border border-hairline px-3 py-1 text-[11px] text-muted">
            Persistent memory <span className="text-status">on</span>
          </span>
          {pendingInsights > 0 && (
            <span className="rounded-full border border-accent/40 bg-accent-dim px-3 py-1 text-[11px] text-accent">
              {pendingInsights} pending synthesis
            </span>
          )}
        </div>

        <div className="relative flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-3 rounded-full border border-hairline py-1 pl-1 pr-3 transition hover:border-accent/40"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-dim text-[11px] font-semibold text-accent">
              {initials}
            </span>
            <span className="max-w-[140px] truncate text-xs text-ink">{user.name}</span>
          </button>

          {menuOpen && (
            <div className="intercom-rise absolute right-0 top-12 w-56 rounded-2xl border border-hairline bg-surface p-3 shadow-2xl">
              <p className="px-1 text-xs text-muted">{user.email}</p>
              <div className="my-2 h-px bg-hairline" />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
                className="w-full rounded-lg px-2 py-2 text-left text-xs text-ink transition hover:bg-accent-dim hover:text-accent"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
