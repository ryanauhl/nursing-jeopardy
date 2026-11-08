"use client";

import { useState } from "react";
import Link from "next/link";

export function TeamSetup({
  gameTitle,
  onStart,
}: {
  gameTitle: string;
  onStart: (names: string[]) => void;
}) {
  const [names, setNames] = useState(["", "", ""]);

  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  const canStart = cleaned.length >= 1;

  function submit() {
    // Blank rows are just unused slots — drop them rather than creating
    // phantom teams the host then has to delete.
    if (!canStart) return;
    onStart(cleaned);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-8 text-sm text-muted transition hover:text-paper">
        ← Dashboard
      </Link>

      <p className="display text-sm tracking-[0.4em] text-gold">NOW PLAYING</p>
      <h1 className="display tv-shadow-lg mt-2 text-4xl leading-tight text-paper">
        {gameTitle.toUpperCase()}
      </h1>

      <h2 className="mt-10 text-xs uppercase tracking-widest text-muted">
        Who&apos;s playing?
      </h2>

      <div className="mt-3 space-y-2">
        {names.map((name, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={name}
              autoFocus={index === 0}
              onChange={(e) =>
                setNames((current) =>
                  current.map((n, i) => (i === index ? e.target.value : n)),
                )
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={`Team ${index + 1}`}
              className="flex-1 rounded-sm border border-panel-line bg-panel/60 px-4 py-3 text-lg text-paper outline-none transition placeholder:text-muted/40 focus:border-gold"
            />
            {names.length > 1 && (
              <button
                onClick={() =>
                  setNames((current) => current.filter((_, i) => i !== index))
                }
                aria-label={`Remove team ${index + 1}`}
                className="rounded-sm px-3 py-3 text-muted transition hover:text-wrong"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => setNames((current) => [...current, ""])}
        className="mt-3 self-start text-sm text-muted transition hover:text-gold"
      >
        + Add another team
      </button>

      <button
        onClick={submit}
        disabled={!canStart}
        className="display mt-10 rounded-sm bg-gold py-4 text-2xl tracking-wider text-ink transition hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-40"
      >
        START GAME
      </button>
      {!canStart && (
        <p className="mt-3 text-center text-sm text-muted">
          Add at least one team to begin.
        </p>
      )}
    </main>
  );
}
