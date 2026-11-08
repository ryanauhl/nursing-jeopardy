"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GameData, GameSummary } from "@/lib/game";

function relativeDate(iso: string) {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function GameLibrary({ initialGames }: { initialGames: GameSummary[] }) {
  const router = useRouter();
  const [games, setGames] = useState(initialGames);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    const res = await fetch("/api/games");
    setGames(await res.json());
    router.refresh();
  }

  async function createGame() {
    setBusy("new");
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Untitled Game" }),
    });
    const game: GameData = await res.json();
    router.push(`/games/${game.id}/edit`);
  }

  async function duplicate(id: string) {
    setBusy(id);
    await fetch(`/api/games/${id}/duplicate`, { method: "POST" });
    await refresh();
    setBusy(null);
  }

  async function remove(id: string) {
    setBusy(id);
    await fetch(`/api/games/${id}`, { method: "DELETE" });
    setConfirmingDelete(null);
    await refresh();
    setBusy(null);
  }

  /** Export pulls the full game so the file is a complete, re-importable backup. */
  async function exportGame(id: string, title: string) {
    const game: GameData = await fetch(`/api/games/${id}`).then((r) => r.json());
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(game, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^\w-]+/g, "-").toLowerCase()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importGame(file: File) {
    setBusy("import");
    try {
      const parsed = JSON.parse(await file.text());
      await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ import: parsed }),
      });
      await refresh();
    } catch {
      alert("That file isn't a game export — expected JSON from the Export button.");
    }
    setBusy(null);
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={createGame}
          disabled={busy === "new"}
          className="display rounded-sm bg-gold px-6 py-3 text-lg tracking-wider text-ink transition hover:bg-gold-bright disabled:opacity-50"
        >
          + NEW GAME
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy === "import"}
          className="rounded-sm border border-panel-line px-5 py-3 text-sm font-medium tracking-wide text-muted transition hover:border-gold hover:text-paper disabled:opacity-50"
        >
          Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importGame(file);
            event.target.value = "";
          }}
        />
      </div>

      {games.length === 0 ? (
        <div className="rounded-sm border border-dashed border-panel-line bg-panel/40 px-8 py-16 text-center">
          <p className="display text-2xl text-paper">NO GAMES YET</p>
          <p className="mt-2 text-muted">
            Hit <span className="text-gold">New Game</span> to write your first board.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {games.map((game) => {
            const complete = game.filledClues === game.totalClues;
            const ready = game.filledClues > 0;
            return (
              <li
                key={game.id}
                className="group rounded-sm border border-panel-line bg-panel/60 p-5 transition hover:border-gold/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="display truncate text-2xl tracking-wide text-paper">
                      {game.title.toUpperCase()}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className={complete ? "text-correct" : "text-muted"}>
                        {game.filledClues}/{game.totalClues} clues written
                      </span>
                      <span className={game.hasFinal ? "text-correct" : "text-muted"}>
                        Final Jeopardy {game.hasFinal ? "✓" : "—"}
                      </span>
                      <span className="text-muted/70">
                        edited {relativeDate(game.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/play/${game.id}`}
                      aria-disabled={!ready}
                      onClick={(e) => {
                        if (!ready) e.preventDefault();
                      }}
                      className={`display rounded-sm px-5 py-2.5 text-base tracking-wider transition ${
                        ready
                          ? "bg-board text-paper hover:bg-board-lit"
                          : "pointer-events-none bg-panel text-muted/50"
                      }`}
                    >
                      PLAY
                    </Link>
                    <Link
                      href={`/games/${game.id}/edit`}
                      className="rounded-sm border border-panel-line px-4 py-2.5 text-sm text-muted transition hover:border-gold hover:text-paper"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => duplicate(game.id)}
                      disabled={busy === game.id}
                      className="rounded-sm border border-panel-line px-4 py-2.5 text-sm text-muted transition hover:border-gold hover:text-paper disabled:opacity-50"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => exportGame(game.id, game.title)}
                      className="rounded-sm border border-panel-line px-4 py-2.5 text-sm text-muted transition hover:border-gold hover:text-paper"
                    >
                      Export
                    </button>
                    {confirmingDelete === game.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => remove(game.id)}
                          disabled={busy === game.id}
                          className="rounded-sm bg-wrong px-3 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
                        >
                          Delete for good
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(null)}
                          className="rounded-sm px-3 py-2.5 text-sm text-muted hover:text-paper"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(game.id)}
                        className="rounded-sm border border-transparent px-4 py-2.5 text-sm text-muted/60 transition hover:text-wrong"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {!ready && (
                  <p className="mt-3 text-sm text-muted/70">
                    Write at least one clue before this game can be played.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
