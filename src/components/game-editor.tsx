"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  categoriesForRound,
  formatMoney,
  isPlayable,
  ROUNDS,
  ROUND_NAMES,
  type GameData,
  type Round,
} from "@/lib/game";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function GameEditor({ initialGame }: { initialGame: GameData }) {
  const [game, setGame] = useState(initialGame);
  const [round, setRound] = useState<Round>(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Only push what actually changed. The host may be typing fast the night
  // before the party; rewriting all 50 clues on every keystroke is wasteful.
  const dirtyCategories = useRef(new Set<string>());
  const dirtyClues = useRef(new Set<string>());
  const dirtyGameFields = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The debounced save fires outside render, so it needs the newest game
  // without re-creating the callback on every keystroke.
  const latest = useRef(game);
  useEffect(() => {
    latest.current = game;
  }, [game]);

  const save = useCallback(async () => {
    if (
      !dirtyGameFields.current &&
      dirtyCategories.current.size === 0 &&
      dirtyClues.current.size === 0
    ) {
      return;
    }

    const current = latest.current;
    const categoryIds = [...dirtyCategories.current];
    const clueIds = [...dirtyClues.current];
    const includeGameFields = dirtyGameFields.current;

    // Clear before awaiting so edits made during the request aren't dropped.
    dirtyCategories.current.clear();
    dirtyClues.current.clear();
    dirtyGameFields.current = false;
    setSaveState("saving");

    const allClues = current.categories.flatMap((c) => c.clues);
    const payload = {
      ...(includeGameFields
        ? {
            title: current.title,
            finalCategory: current.finalCategory,
            finalClue: current.finalClue,
            finalAnswer: current.finalAnswer,
          }
        : {}),
      categories: categoryIds.flatMap((id) => {
        const category = current.categories.find((c) => c.id === id);
        return category ? [{ id, name: category.name }] : [];
      }),
      clues: clueIds.flatMap((id) => {
        const clue = allClues.find((c) => c.id === id);
        return clue
          ? [
              {
                id,
                clue: clue.clue,
                answer: clue.answer,
                isDailyDouble: clue.isDailyDouble,
              },
            ]
          : [];
      }),
    };

    try {
      const res = await fetch(`/api/games/${current.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaveState((s) => (s === "saving" ? "saved" : s));
    } catch {
      // Put the work back on the queue so the next save retries it.
      categoryIds.forEach((id) => dirtyCategories.current.add(id));
      clueIds.forEach((id) => dirtyClues.current.add(id));
      if (includeGameFields) dirtyGameFields.current = true;
      setSaveState("error");
    }
  }, []);

  const queueSave = useCallback(() => {
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 800);
  }, [save]);

  // Never let a close eat unsaved edits.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        dirtyGameFields.current ||
        dirtyCategories.current.size > 0 ||
        dirtyClues.current.size > 0
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function updateGameField(patch: Partial<GameData>) {
    setGame((g) => ({ ...g, ...patch }));
    dirtyGameFields.current = true;
    queueSave();
  }

  function updateCategory(categoryId: string, name: string) {
    setGame((g) => ({
      ...g,
      categories: g.categories.map((c) => (c.id === categoryId ? { ...c, name } : c)),
    }));
    dirtyCategories.current.add(categoryId);
    queueSave();
  }

  function updateClue(
    clueId: string,
    patch: { clue?: string; answer?: string; isDailyDouble?: boolean },
  ) {
    setGame((g) => ({
      ...g,
      categories: g.categories.map((category) => ({
        ...category,
        clues: category.clues.map((clue) =>
          clue.id === clueId ? { ...clue, ...patch } : clue,
        ),
      })),
    }));
    dirtyClues.current.add(clueId);
    queueSave();
  }

  const categories = categoriesForRound(game, round);
  const allClues = game.categories.flatMap((c) => c.clues);
  const selectedClue = allClues.find((c) => c.id === selected) ?? null;
  const selectedCategory = game.categories.find((c) =>
    c.clues.some((clue) => clue.id === selected),
  );
  const filled = allClues.filter(isPlayable).length;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 pb-24 pt-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted transition hover:text-paper"
          >
            ← Dashboard
          </Link>
          <SaveBadge state={saveState} onRetry={save} />
        </div>
        <Link
          href={`/play/${game.id}`}
          className="display rounded-sm bg-board px-6 py-2.5 text-base tracking-wider text-paper transition hover:bg-board-lit"
        >
          PLAY THIS GAME →
        </Link>
      </div>

      <input
        value={game.title}
        onChange={(e) => updateGameField({ title: e.target.value })}
        placeholder="Game title"
        className="display w-full border-b border-panel-line bg-transparent pb-3 text-4xl tracking-wide text-paper outline-none transition placeholder:text-muted/40 focus:border-gold"
      />
      <p className="mt-3 text-sm text-muted">
        {filled}/{allClues.length} clues written · click any tile to edit it
      </p>

      <div className="mt-8 flex gap-2">
        {ROUNDS.map((r) => (
          <button
            key={r}
            onClick={() => setRound(r)}
            className={`display rounded-sm px-5 py-2.5 text-base tracking-wider transition ${
              round === r
                ? "bg-gold text-ink"
                : "border border-panel-line text-muted hover:text-paper"
            }`}
          >
            {ROUND_NAMES[r].toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid grid-cols-5 gap-1.5">
          {categories.map((category) => (
            <input
              key={category.id}
              value={category.name}
              onChange={(e) => updateCategory(category.id, e.target.value)}
              placeholder="CATEGORY"
              className="tile-face display rounded-sm px-2 py-4 text-center text-sm uppercase tracking-wide text-paper outline-none transition placeholder:text-paper/30 focus:ring-2 focus:ring-gold"
            />
          ))}

          {[0, 1, 2, 3, 4].map((row) =>
            categories.map((category) => {
              const clue = category.clues[row];
              if (!clue) return null;
              const written = isPlayable(clue);
              const active = selected === clue.id;
              return (
                <button
                  key={clue.id}
                  onClick={() => setSelected(clue.id)}
                  className={`tile-face relative flex min-h-24 flex-col items-center justify-center rounded-sm px-2 py-4 transition ${
                    active ? "ring-2 ring-gold" : "hover:brightness-125"
                  }`}
                >
                  <span
                    className={`display tv-shadow text-2xl ${
                      written ? "text-gold-bright" : "text-paper/25"
                    }`}
                  >
                    {formatMoney(clue.value)}
                  </span>
                  {clue.isDailyDouble && (
                    <span className="absolute right-1.5 top-1.5 rounded-sm bg-gold px-1.5 py-0.5 text-[10px] font-bold text-ink">
                      DD
                    </span>
                  )}
                  {!written && (
                    <span className="mt-1 text-[10px] uppercase tracking-widest text-paper/40">
                      empty
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          {selectedClue && selectedCategory ? (
            <div className="rounded-sm border border-panel-line bg-panel/60 p-5">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="display text-lg tracking-wide text-gold">
                  {formatMoney(selectedClue.value)}
                </span>
                <span className="max-w-[60%] truncate text-xs uppercase tracking-widest text-muted">
                  {selectedCategory.name || "Untitled category"}
                </span>
              </div>

              <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted">
                Clue (what players see)
              </label>
              <textarea
                value={selectedClue.clue}
                onChange={(e) => updateClue(selectedClue.id, { clue: e.target.value })}
                rows={4}
                placeholder="This is the largest organ in the human body."
                className="w-full resize-y rounded-sm border border-panel-line bg-ink/60 p-3 text-paper outline-none transition placeholder:text-muted/40 focus:border-gold"
              />

              <label className="mb-1.5 mt-4 block text-xs uppercase tracking-widest text-muted">
                Correct response
              </label>
              <textarea
                value={selectedClue.answer}
                onChange={(e) => updateClue(selectedClue.id, { answer: e.target.value })}
                rows={2}
                placeholder="The skin"
                className="w-full resize-y rounded-sm border border-panel-line bg-ink/60 p-3 text-paper outline-none transition placeholder:text-muted/40 focus:border-gold"
              />

              <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-paper">
                <input
                  type="checkbox"
                  checked={selectedClue.isDailyDouble}
                  onChange={(e) =>
                    updateClue(selectedClue.id, { isDailyDouble: e.target.checked })
                  }
                  className="size-4 accent-[var(--value-gold)]"
                />
                Daily Double
              </label>

              <button
                onClick={() => setSelected(null)}
                className="mt-5 w-full rounded-sm border border-panel-line py-2 text-sm text-muted transition hover:text-paper"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="rounded-sm border border-dashed border-panel-line bg-panel/30 p-8 text-center text-sm text-muted">
              Select a tile to write its clue.
            </div>
          )}

          <div className="mt-6 rounded-sm border border-panel-line bg-panel/60 p-5">
            <h2 className="display mb-4 text-lg tracking-wide text-gold">
              FINAL JEOPARDY
            </h2>
            <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted">
              Category
            </label>
            <input
              value={game.finalCategory}
              onChange={(e) => updateGameField({ finalCategory: e.target.value })}
              placeholder="WORLD HISTORY"
              className="w-full rounded-sm border border-panel-line bg-ink/60 p-3 text-paper outline-none transition placeholder:text-muted/40 focus:border-gold"
            />
            <label className="mb-1.5 mt-4 block text-xs uppercase tracking-widest text-muted">
              Clue
            </label>
            <textarea
              value={game.finalClue}
              onChange={(e) => updateGameField({ finalClue: e.target.value })}
              rows={3}
              className="w-full resize-y rounded-sm border border-panel-line bg-ink/60 p-3 text-paper outline-none transition focus:border-gold"
            />
            <label className="mb-1.5 mt-4 block text-xs uppercase tracking-widest text-muted">
              Correct response
            </label>
            <input
              value={game.finalAnswer}
              onChange={(e) => updateGameField({ finalAnswer: e.target.value })}
              className="w-full rounded-sm border border-panel-line bg-ink/60 p-3 text-paper outline-none transition focus:border-gold"
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error") {
    return (
      <button onClick={onRetry} className="text-sm text-wrong underline">
        Couldn&apos;t save — retry
      </button>
    );
  }
  const label = {
    idle: "",
    dirty: "Unsaved changes…",
    saving: "Saving…",
    saved: "Saved ✓",
  }[state];
  const tone = state === "saved" ? "text-correct" : "text-muted";
  return <span className={`text-sm ${tone}`}>{label}</span>;
}
