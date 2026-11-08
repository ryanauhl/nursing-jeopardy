"use client";

import { useEffect, useState } from "react";
import { formatMoney, type GameData } from "@/lib/game";
import type { FinalState, Team } from "@/lib/session";

export function FinalJeopardy({
  game,
  teams,
  final,
  onUpdateFinal,
  onScore,
  onClose,
}: {
  game: GameData;
  teams: Team[];
  final: FinalState;
  onUpdateFinal: (mutate: (final: FinalState) => FinalState) => void;
  onScore: (teamId: string, delta: number) => void;
  onClose: () => void;
}) {
  const { stage, wagers, results } = final;

  // Wagers are typed on the same screen everyone is watching, so keep them
  // masked until the reveal.
  const [peek, setPeek] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () =>
        setSecondsLeft((s) => {
          if (s <= 1) {
            setRunning(false);
            return 0;
          }
          return s - 1;
        }),
      1000,
    );
    return () => clearInterval(id);
  }, [running]);

  function capFor(team: Team) {
    return Math.max(team.score, 0);
  }

  const allWagersValid = teams.every((team) => {
    const wager = wagers[team.id] ?? 0;
    return wager >= 0 && wager <= capFor(team);
  });

  function setStage(next: FinalState["stage"]) {
    onUpdateFinal((f) => ({ ...f, stage: next }));
  }

  /**
   * Apply a verdict, undoing any previous one for that team so the host can
   * fix a misclick without the score drifting.
   */
  function judge(team: Team, correct: boolean) {
    const wager = wagers[team.id] ?? 0;
    const previous = results[team.id];
    if (previous === correct) return;

    let delta = correct ? wager : -wager;
    if (previous === true) delta -= wager;
    if (previous === false) delta += wager;

    onScore(team.id, delta);
    onUpdateFinal((f) => ({ ...f, results: { ...f.results, [team.id]: correct } }));
  }

  const standings = [...teams].sort((a, b) => b.score - a.score);
  const topScore = standings[0]?.score ?? 0;

  return (
    <div className="clue-scrim fixed inset-0 z-50 flex flex-col overflow-y-auto">
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <div>
          <p className="display text-sm tracking-[0.4em] text-gold">FINAL JEOPARDY</p>
          <p className="text-xl uppercase tracking-wide text-paper">
            {game.finalCategory || "—"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm border border-paper/30 px-4 py-2 text-sm text-paper/80 transition hover:text-paper"
        >
          Back to board
        </button>
      </header>

      {stage === "wagers" && (
        <section className="mx-auto w-full max-w-xl flex-1 px-6 py-8">
          <h2 className="display text-3xl text-paper">PLACE YOUR WAGERS</h2>
          <p className="mt-2 text-paper/70">
            Each team wagers up to their own score. Entries stay hidden until the
            reveal.
          </p>

          <div className="mt-8 space-y-3">
            {teams.map((team) => {
              const cap = capFor(team);
              const wager = wagers[team.id] ?? 0;
              const invalid = wager > cap;
              return (
                <div
                  key={team.id}
                  className="rounded-sm border border-paper/20 bg-black/25 p-4"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg text-paper">{team.name}</span>
                    <span className="text-sm text-paper/60">
                      max {formatMoney(cap)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type={peek[team.id] ? "number" : "password"}
                      inputMode="numeric"
                      value={wagers[team.id] ?? ""}
                      onChange={(e) =>
                        onUpdateFinal((f) => ({
                          ...f,
                          wagers: { ...f.wagers, [team.id]: Number(e.target.value) || 0 },
                        }))
                      }
                      placeholder="0"
                      disabled={cap === 0}
                      className={`display flex-1 rounded-sm border-2 bg-black/40 px-4 py-3 text-center text-2xl text-gold-bright outline-none disabled:opacity-40 ${
                        invalid ? "border-wrong" : "border-gold/50"
                      }`}
                    />
                    <button
                      onClick={() =>
                        setPeek((p) => ({ ...p, [team.id]: !p[team.id] }))
                      }
                      className="rounded-sm border border-paper/25 px-3 py-3 text-xs uppercase tracking-widest text-paper/70 transition hover:text-paper"
                    >
                      {peek[team.id] ? "Hide" : "Show"}
                    </button>
                  </div>
                  {cap === 0 && (
                    <p className="mt-2 text-sm text-paper/50">
                      Nothing to wager — they can still play for pride.
                    </p>
                  )}
                  {invalid && (
                    <p className="mt-2 text-sm text-wrong">
                      Over their maximum of {formatMoney(cap)}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setStage("clue")}
            disabled={!allWagersValid}
            className="display mt-8 w-full rounded-sm bg-gold py-4 text-2xl tracking-wider text-ink transition hover:bg-gold-bright disabled:opacity-40"
          >
            REVEAL THE CLUE
          </button>
        </section>
      )}

      {(stage === "clue" || stage === "answer") && (
        <section className="flex flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center px-8 py-10">
            <div className="max-w-4xl text-center">
              <p className="display tv-shadow-lg text-4xl uppercase leading-tight text-paper sm:text-6xl">
                {game.finalClue || "No Final Jeopardy clue was written."}
              </p>
              {stage === "answer" && (
                <p className="animate-clue-rise mt-12 border-t-2 border-gold/40 pt-8 text-3xl uppercase tracking-wide text-gold-bright sm:text-5xl">
                  {game.finalAnswer || "—"}
                </p>
              )}
            </div>
          </div>

          <footer className="border-t border-black/30 bg-black/25 px-6 py-5 sm:px-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`display tabular-nums text-4xl ${
                    secondsLeft <= 5 ? "text-wrong" : "text-paper"
                  }`}
                >
                  {secondsLeft}
                </span>
                <button
                  onClick={() => setRunning((r) => !r)}
                  className="rounded-sm border border-paper/30 px-4 py-2 text-xs uppercase tracking-widest text-paper/80 transition hover:border-gold hover:text-gold"
                >
                  {running ? "Pause" : "Start"}
                </button>
                <button
                  onClick={() => {
                    setRunning(false);
                    setSecondsLeft(30);
                  }}
                  className="rounded-sm border border-paper/30 px-4 py-2 text-xs uppercase tracking-widest text-paper/80 transition hover:border-gold hover:text-gold"
                >
                  Reset
                </button>
              </div>

              {stage === "clue" ? (
                <button
                  onClick={() => setStage("answer")}
                  className="display rounded-sm bg-gold px-8 py-3 text-xl tracking-wider text-ink transition hover:bg-gold-bright"
                >
                  REVEAL ANSWER
                </button>
              ) : (
                <button
                  onClick={() => setStage("results")}
                  className="display rounded-sm bg-gold px-8 py-3 text-xl tracking-wider text-ink transition hover:bg-gold-bright"
                >
                  SCORE IT →
                </button>
              )}
            </div>
          </footer>
        </section>
      )}

      {stage === "results" && (
        <section className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
          <h2 className="display text-3xl text-paper">WHO GOT IT RIGHT?</h2>
          <p className="mt-2 text-paper/70">
            Answer: <span className="text-gold-bright">{game.finalAnswer || "—"}</span>
          </p>

          <div className="mt-8 space-y-3">
            {teams.map((team) => {
              const verdict = results[team.id];
              return (
                <div
                  key={team.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-paper/20 bg-black/25 p-4"
                >
                  <div>
                    <p className="text-lg text-paper">{team.name}</p>
                    <p className="text-sm text-paper/60">
                      wagered {formatMoney(wagers[team.id] ?? 0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="display text-2xl text-gold-bright">
                      {formatMoney(team.score)}
                    </span>
                    <button
                      onClick={() => judge(team, true)}
                      className={`size-11 rounded-sm text-xl transition ${
                        verdict === true
                          ? "bg-correct text-ink"
                          : "bg-correct/20 text-correct hover:bg-correct/35"
                      }`}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => judge(team, false)}
                      className={`size-11 rounded-sm text-xl transition ${
                        verdict === false
                          ? "bg-wrong text-ink"
                          : "bg-wrong/20 text-wrong hover:bg-wrong/35"
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-sm border-2 border-gold bg-black/30 p-6 text-center">
            <p className="display text-sm tracking-[0.4em] text-gold">FINAL STANDINGS</p>
            <ol className="mt-4 space-y-2">
              {standings.map((team, index) => (
                <li
                  key={team.id}
                  className={`flex items-center justify-between text-xl ${
                    index === 0 && team.score === topScore
                      ? "text-gold-bright"
                      : "text-paper/80"
                  }`}
                >
                  <span>
                    {index + 1}. {team.name}
                    {index === 0 && team.score === topScore && " 👑"}
                  </span>
                  <span className="display">{formatMoney(team.score)}</span>
                </li>
              ))}
            </ol>
          </div>

          <button
            onClick={onClose}
            className="display mt-8 w-full rounded-sm border border-paper/30 py-3 text-lg tracking-wider text-paper/80 transition hover:text-paper"
          >
            BACK TO BOARD
          </button>
        </section>
      )}
    </div>
  );
}
