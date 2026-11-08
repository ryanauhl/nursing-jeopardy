"use client";

import { useState } from "react";
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
import { useSession } from "@/lib/session";
import { TeamSetup } from "@/components/team-setup";
import { ClueOverlay } from "@/components/clue-overlay";
import { FinalJeopardy } from "@/components/final-jeopardy";

export function GameBoard({ game }: { game: GameData }) {
  const {
    session,
    loaded,
    start,
    reset,
    adjustScore,
    setScore,
    markUsed,
    setRound,
    updateFinal,
  } = useSession(game.id);

  const [activeClueId, setActiveClueId] = useState<string | null>(null);
  const [showFinal, setShowFinal] = useState(false);
  const [editingScores, setEditingScores] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  // The session only exists client-side, so render nothing until it's read.
  if (!loaded) return null;
  if (!session) return <TeamSetup gameTitle={game.title} onStart={start} />;

  const round = session.round;
  const categories = categoriesForRound(game, round);
  const activeClue = game.categories
    .flatMap((c) => c.clues)
    .find((c) => c.id === activeClueId);
  const activeCategory = game.categories.find((c) =>
    c.clues.some((clue) => clue.id === activeClueId),
  );

  const roundClues = categories.flatMap((c) => c.clues).filter(isPlayable);
  const remaining = roundClues.filter(
    (c) => !session.usedClueIds.includes(c.id),
  ).length;

  function closeClue() {
    if (activeClueId) markUsed(activeClueId);
    setActiveClueId(null);
  }

  return (
    // A fixed-height column: the board fills whatever the header and
    // scoreboard leave behind, and the page itself never scrolls.
    <main className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-muted transition hover:text-paper">
            ← Dashboard
          </Link>
          <span className="display text-lg tracking-wide text-gold">
            {ROUND_NAMES[round].toUpperCase()}
          </span>
          <span className="text-sm text-muted">{remaining} clues left</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ROUNDS.filter((r) => r !== round).map((r) => (
            <button
              key={r}
              onClick={() => setRound(r)}
              className="display rounded-sm bg-board px-4 py-2 text-sm tracking-wider text-paper transition hover:bg-board-lit"
            >
              {ROUND_NAMES[r].toUpperCase()} →
            </button>
          ))}
          <button
            onClick={() => setShowFinal(true)}
            className="display rounded-sm bg-gold px-4 py-2 text-sm tracking-wider text-ink transition hover:bg-gold-bright"
          >
            FINAL JEOPARDY
          </button>
          <button
            onClick={() => setEditingScores((v) => !v)}
            className="rounded-sm border border-panel-line px-3 py-2 text-sm text-muted transition hover:text-paper"
          >
            {editingScores ? "Done" : "Edit scores"}
          </button>
          {confirmingReset ? (
            <span className="flex items-center gap-1">
              <button
                onClick={() => {
                  reset();
                  setConfirmingReset(false);
                }}
                className="rounded-sm bg-wrong px-3 py-2 text-sm font-semibold text-ink"
              >
                Reset everything
              </button>
              <button
                onClick={() => setConfirmingReset(false)}
                className="px-2 py-2 text-sm text-muted hover:text-paper"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmingReset(true)}
              className="rounded-sm border border-transparent px-3 py-2 text-sm text-muted/60 transition hover:text-wrong"
            >
              Reset
            </button>
          )}
        </div>
      </header>

      {/* min-h-0 lets this column shrink around the grid instead of overflowing. */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-2 pb-2 sm:px-3">
        <div className="grid shrink-0 grid-cols-5 gap-1.5">
          {categories.map((category) => (
            <div
              key={category.id}
              className="tile-face flex min-h-16 items-center justify-center rounded-sm px-2 py-3"
            >
              <h2 className="display tv-shadow text-center text-[clamp(0.7rem,1.35vw,1.35rem)] uppercase leading-tight text-paper">
                {category.name || "—"}
              </h2>
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-5 grid-rows-5 gap-1.5">
          {[0, 1, 2, 3, 4].map((row) =>
            categories.map((category) => {
              const clue = category.clues[row];
              if (!clue) return null;
              const used = session.usedClueIds.includes(clue.id);
              const playable = isPlayable(clue) && !used;

              return (
                <button
                  key={clue.id}
                  onClick={() => playable && setActiveClueId(clue.id)}
                  disabled={!playable}
                  className={`animate-tile-pop flex items-center justify-center overflow-hidden rounded-sm transition ${
                    playable
                      ? "tile-face cursor-pointer hover:brightness-125 active:scale-[0.98]"
                      : "cursor-default bg-ink-soft/60"
                  }`}
                  style={{ animationDelay: `${row * 40}ms` }}
                >
                  {playable && (
                    <span className="display tv-shadow-lg text-[clamp(1.25rem,3.4vw,3.75rem)] text-gold-bright">
                      {formatMoney(clue.value)}
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-panel-line bg-panel/40 px-3 py-3">
        <div className="flex flex-wrap gap-2">
          {session.teams.map((team) => (
            <div
              key={team.id}
              className="flex min-w-40 flex-1 items-center justify-between gap-3 rounded-sm border border-panel-line bg-ink/60 px-4 py-3"
            >
              <span className="truncate text-sm uppercase tracking-wide text-muted">
                {team.name}
              </span>
              {editingScores ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => adjustScore(team.id, -100)}
                    className="size-7 rounded-sm bg-wrong/20 text-wrong"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={team.score}
                    onChange={(e) => setScore(team.id, Number(e.target.value) || 0)}
                    className="display w-24 rounded-sm border border-panel-line bg-ink px-2 py-1 text-center text-lg text-gold-bright outline-none"
                  />
                  <button
                    onClick={() => adjustScore(team.id, 100)}
                    className="size-7 rounded-sm bg-correct/20 text-correct"
                  >
                    +
                  </button>
                </div>
              ) : (
                <span
                  className={`display text-2xl ${
                    team.score < 0 ? "text-wrong" : "text-gold-bright"
                  }`}
                >
                  {formatMoney(team.score)}
                </span>
              )}
            </div>
          ))}
        </div>
      </footer>

      {activeClue && activeCategory && (
        <ClueOverlay
          key={activeClue.id}
          clue={activeClue}
          categoryName={activeCategory.name}
          round={round as Round}
          teams={session.teams}
          onScore={adjustScore}
          onClose={closeClue}
        />
      )}

      {showFinal && (
        <FinalJeopardy
          game={game}
          teams={session.teams}
          final={session.final}
          onUpdateFinal={updateFinal}
          onScore={adjustScore}
          onClose={() => setShowFinal(false)}
        />
      )}
    </main>
  );
}
