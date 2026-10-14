"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";

/* ---------------------------------------------------------------------------
   Ambient background: drifting data nodes connected by pulsing links.
--------------------------------------------------------------------------- */

const NODES = [
  { x: 8, y: 18, s: 7, dx: "38px", dy: "-42px", dur: "15s", delay: "0s" },
  { x: 22, y: 64, s: 10, dx: "-30px", dy: "46px", dur: "18s", delay: "-4s" },
  { x: 37, y: 30, s: 5, dx: "52px", dy: "28px", dur: "13s", delay: "-2s" },
  { x: 54, y: 76, s: 8, dx: "-44px", dy: "-34px", dur: "16s", delay: "-6s" },
  { x: 68, y: 22, s: 12, dx: "26px", dy: "50px", dur: "20s", delay: "-3s" },
  { x: 82, y: 58, s: 6, dx: "-56px", dy: "-26px", dur: "14s", delay: "-8s" },
  { x: 91, y: 34, s: 9, dx: "-34px", dy: "42px", dur: "17s", delay: "-1s" },
  { x: 15, y: 88, s: 6, dx: "40px", dy: "-30px", dur: "19s", delay: "-5s" },
  { x: 46, y: 8, s: 6, dx: "-24px", dy: "38px", dur: "15s", delay: "-7s" },
  { x: 74, y: 90, s: 7, dx: "34px", dy: "-46px", dur: "21s", delay: "-9s" },
];

const LINKS = [
  { x1: 8, y1: 18, x2: 37, y2: 30, dur: "6s", delay: "0s" },
  { x1: 37, y1: 30, x2: 68, y2: 22, dur: "7s", delay: "-2s" },
  { x1: 22, y1: 64, x2: 54, y2: 76, dur: "5.5s", delay: "-1s" },
  { x1: 54, y1: 76, x2: 82, y2: 58, dur: "6.5s", delay: "-3s" },
  { x1: 68, y1: 22, x2: 91, y2: 34, dur: "7.5s", delay: "-4s" },
  { x1: 15, y1: 88, x2: 46, y2: 8, dur: "8s", delay: "-2.5s" },
  { x1: 46, y1: 8, x2: 82, y2: 58, dur: "6.8s", delay: "-5s" },
];

function AmbientGraph() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <radialGradient id="node-glow">
          <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00F0FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      {LINKS.map((l, i) => (
        <line
          key={`l-${i}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="rgba(0,240,255,0.22)"
          strokeWidth="0.18"
          vectorEffect="non-scaling-stroke"
          className="link-pulse"
          style={{ ["--dur" as string]: l.dur, ["--delay" as string]: l.delay }}
        />
      ))}
      {NODES.map((n, i) => (
        <g key={`n-${i}`} className="data-node" style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
          <circle cx={n.x} cy={n.y} r={n.s} fill="url(#node-glow)" />
          <circle
            cx={n.x}
            cy={n.y}
            r={Math.max(1.2, n.s / 3.2)}
            fill={i % 3 === 0 ? "#76B900" : "#00F0FF"}
            opacity="0.85"
          />
          <circle
            cx={n.x}
            cy={n.y}
            r={n.s}
            fill="none"
            stroke="rgba(243,244,246,0.16)"
            strokeWidth="0.12"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  );
}

const TRUST_POINTS = [
  {
    title: "Hyper-private by architecture",
    body: "Your lifelong knowledge graph lives in your own Neon Database. No training on your data, ever.",
  },
  {
    title: "Always-on, passive observer",
    body: "The background engine pairs with your desktop workspace and vectorizes reading material silently — no manual notes.",
  },
  {
    title: "Silo-Breaker Synthesis",
    body: "NVIDIA Nemotron cross-references what you read today against material from weeks ago, and intervenes with the connection.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const title = useMemo(
    () => (mode === "sign-in" ? "Welcome back." : "Create your private mind."),
    [mode],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ name: name || "Researcher", email, password });

      if (result.error) {
        setError(result.error.message ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(mode === "sign-up" ? "/?onboard=1" : "/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="absolute inset-0">
        <AmbientGraph />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_10%,#0A0A0A_78%)]" />
      </div>

      <header className="relative z-10 glass-strip">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="status-orb" data-active="true" />
            <span className="display text-lg tracking-tight">
              Silo<span className="text-accent">/</span>Breaker
            </span>
          </div>
          <span className="label hidden sm:block">Personal AI · Lifelong Knowledge Graph</span>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 lg:grid-cols-2 lg:gap-16">
        {/* Left: value proposition */}
        <section className="fade-up">
          <p className="label mb-5">The Brain Connector</p>
          <h1 className="display text-5xl leading-[1.02] sm:text-6xl">
            Break the silo between{" "}
            <span className="italic text-accent">what you read</span> and{" "}
            <span className="italic">what you need</span>.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted">
            Months of chaotic internet exploration, collapsed into one continuous,
            private context engine. Silo Breaker remembers every article, paper and
            snippet — and reconnects it the moment it becomes useful.
          </p>

          <ul className="mt-8 space-y-4">
            {TRUST_POINTS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-status shadow-[0_0_10px_rgba(118,185,0,0.7)]" />
                <div>
                  <p className="text-sm font-medium text-ink">{p.title}</p>
                  <p className="text-sm leading-relaxed text-muted">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-2">
            {["Better Auth", "Neon + pgvector", "Nebius Token Factory", "NVIDIA Nemotron"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full border border-hairline px-3 py-1 text-[11px] tracking-wide text-muted"
                >
                  {t}
                </span>
              ),
            )}
          </div>
        </section>

        {/* Right: auth card */}
        <section className="bento-card fade-up relative w-full max-w-md justify-self-center p-8"
          style={{ animationDelay: "120ms" }}>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="display text-2xl">{title}</h2>
            <span className="label">Secure</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "sign-up" && (
              <label className="block">
                <span className="label">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="mt-1.5 w-full rounded-xl border border-hairline bg-background px-4 py-3 text-sm text-ink placeholder:text-muted/60 outline-none transition focus:border-accent"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="block">
              <span className="label">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@research.lab"
                className="mt-1.5 w-full rounded-xl border border-hairline bg-background px-4 py-3 text-sm text-ink placeholder:text-muted/60 outline-none transition focus:border-accent"
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="label">Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-xl border border-hairline bg-background px-4 py-3 text-sm text-ink placeholder:text-muted/60 outline-none transition focus:border-accent"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              />
            </label>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="glow-sweep w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-60"
            >
              {pending
                ? "Connecting…"
                : mode === "sign-in"
                  ? "Enter the knowledge graph"
                  : "Create private account"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs text-muted">
            <span>{mode === "sign-in" ? "New here?" : "Already connected?"}</span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              }}
              className="text-accent underline-offset-4 hover:underline"
            >
              {mode === "sign-in" ? "Create an account" : "Sign in instead"}
            </button>
          </div>

          <p className="mt-6 border-t border-hairline pt-4 text-[11px] leading-relaxed text-muted">
            Encrypted sessions via Better Auth. Your graph is never shared with
            third parties and is never used to train models.
          </p>
        </section>
      </main>
    </div>
  );
}
