"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney, maxValueForRound, type ClueData, type Round } from "@/lib/game";
import type { Team } from "@/lib/session";

const DEFAULT_SECONDS = 30;

type Phase = "daily-double" | "clue" | "answer";

export function ClueOverlay({
  clue,
  categoryName,
  round,
  teams,
  onScore,
  onClose,
}: {
  clue: ClueData;
  categoryName: string;
  round: Round;
  teams: Team[];
  onScore: (teamId: string, delta: number) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(
    clue.isDailyDouble ? "daily-double" : "clue",
  );
  const [wagerTeam, setWagerTeam] = useState<string>(teams[0]?.id ?? "");
  const [wagerText, setWagerText] = useState("");
  const [awarded, setAwarded] = useState<Record<string, number>>({});

  // Stable so the clue card's keyboard listener isn't rebound every render.
  const reveal = useCallback(() => setPhase("answer"), []);

  // On a Daily Double the stake replaces the tile value.
  const wager = Number(wagerText) || 0;
  const atStake = clue.isDailyDouble ? wager : clue.value;

  const wagerCap = (() => {
    const team = teams.find((t) => t.id === wagerTeam);
    return Math.max(team?.score ?? 0, maxValueForRound(round));
  })();

  function score(teamId: string, sign: 1 | -1) {
    const delta = atStake * sign;
    onScore(teamId, delta);
    setAwarded((current) => ({ ...current, [teamId]: (current[teamId] ?? 0) + delta }));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {phase === "daily-double" ? (
        <DailyDoublePanel
          teams={teams}
          wagerTeam={wagerTeam}
          setWagerTeam={setWagerTeam}
          wagerText={wagerText}
          setWagerText={setWagerText}
          cap={wagerCap}
          onCancel={onClose}
          onConfirm={() => setPhase("clue")}
        />
      ) : (
        <ClueCard
          clue={clue}
          categoryName={categoryName}
          atStake={atStake}
          phase={phase}
          teams={teams}
          awarded={awarded}
          wagerTeamName={teams.find((t) => t.id === wagerTeam)?.name}
          isDailyDouble={clue.isDailyDouble}
          onReveal={reveal}
          onScore={score}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function DailyDoublePanel({
  teams,
  wagerTeam,
  setWagerTeam,
  wagerText,
  setWagerText,
  cap,
  onCancel,
  onConfirm,
}: {
  teams: Team[];
  wagerTeam: string;
  setWagerTeam: (id: string) => void;
  wagerText: string;
  setWagerText: (value: string) => void;
  cap: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const wager = Number(wagerText) || 0;
  const valid = wager >= 5 && wager <= cap && wagerTeam !== "";

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-[#c8102e] via-[#7d0b1d] to-[#2b0308] px-6">
      <p className="display animate-dd-slam tv-shadow-lg text-center text-6xl leading-none text-gold-bright sm:text-8xl">
        DAILY
        <br />
        DOUBLE!
      </p>

      <div className="mt-12 w-full max-w-md">
        <label className="mb-2 block text-xs uppercase tracking-widest text-white/70">
          Who found it?
        </label>
        <div className="grid gap-2">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => setWagerTeam(team.id)}
              className={`flex items-center justify-between rounded-sm border px-4 py-3 text-left transition ${
                wagerTeam === team.id
                  ? "border-gold-bright bg-black/40 text-gold-bright"
                  : "border-white/25 text-white/80 hover:border-white/60"
              }`}
            >
              <span className="text-lg">{team.name}</span>
              <span className="display text-lg">{formatMoney(team.score)}</span>
            </button>
          ))}
        </div>

        <label className="mb-2 mt-6 block text-xs uppercase tracking-widest text-white/70">
          Wager (max {formatMoney(cap)})
        </label>
        <input
          type="number"
          autoFocus
          value={wagerText}
          onChange={(e) => setWagerText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && valid && onConfirm()}
          min={5}
          max={cap}
          placeholder="0"
          className="display w-full rounded-sm border-2 border-gold-bright bg-black/40 px-4 py-4 text-center text-4xl text-gold-bright outline-none"
        />
        {wagerText !== "" && !valid && (
          <p className="mt-2 text-center text-sm text-white">
            Enter between {formatMoney(5)} and {formatMoney(cap)}.
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-sm border border-white/30 py-3 text-white/70 transition hover:text-white"
          >
            Back to board
          </button>
          <button
            onClick={onConfirm}
            disabled={!valid}
            className="display flex-[2] rounded-sm bg-gold-bright py-3 text-xl tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
          >
            SHOW THE CLUE
          </button>
        </div>
      </div>
    </div>
  );
}

function ClueCard({
  clue,
  categoryName,
  atStake,
  phase,
  teams,
  awarded,
  wagerTeamName,
  isDailyDouble,
  onReveal,
  onScore,
  onClose,
}: {
  clue: ClueData;
  categoryName: string;
  atStake: number;
  phase: Phase;
  teams: Team[];
  awarded: Record<string, number>;
  wagerTeamName?: string;
  isDailyDouble: boolean;
  onReveal: () => void;
  onScore: (teamId: string, sign: 1 | -1) => void;
  onClose: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);
  const [running, setRunning] = useState(false);
  const revealed = phase === "answer";

  const toggleTimer = useCallback(() => setRunning((r) => !r), []);
  const resetTimer = useCallback(() => {
    setRunning(false);
    setSecondsLeft(DEFAULT_SECONDS);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Host shortcuts: Space runs the clock, Esc bails out, Enter reveals.
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        toggleTimer();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Enter" && !revealed) {
        event.preventDefault();
        onReveal();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleTimer, onClose, onReveal, revealed]);

  const low = secondsLeft <= 5 && secondsLeft > 0;
  const expired = secondsLeft === 0;

  return (
    <div className="clue-scrim animate-clue-rise flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <div className="min-w-0">
          <p className="truncate text-sm uppercase tracking-[0.3em] text-paper/70">
            {categoryName || "—"}
          </p>
          <p className="display tv-shadow text-3xl text-gold-bright">
            {formatMoney(atStake)}
            {isDailyDouble && (
              <span className="ml-3 align-middle text-base tracking-widest text-paper/80">
                DAILY DOUBLE · {wagerTeamName}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`display tabular-nums text-5xl ${
              expired ? "text-wrong" : low ? "text-wrong animate-pulse-red" : "text-paper"
            }`}
          >
            {secondsLeft}
          </span>
          <div className="flex flex-col gap-1">
            <button
              onClick={toggleTimer}
              className="rounded-sm border border-paper/30 px-3 py-1 text-xs uppercase tracking-widest text-paper/80 transition hover:border-gold hover:text-gold"
            >
              {running ? "Pause" : "Start"}
            </button>
            <button
              onClick={resetTimer}
              className="rounded-sm border border-paper/30 px-3 py-1 text-xs uppercase tracking-widest text-paper/80 transition hover:border-gold hover:text-gold"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-8 py-6">
        <div className="max-w-5xl text-center">
          <p className="display tv-shadow-lg text-4xl uppercase leading-tight text-paper sm:text-6xl lg:text-7xl">
            {clue.clue}
          </p>
          {revealed && (
            <p className="animate-clue-rise mt-12 border-t-2 border-gold/40 pt-8 text-3xl uppercase tracking-wide text-gold-bright sm:text-5xl">
              {clue.answer || "—"}
            </p>
          )}
        </div>
      </div>

      <footer className="border-t border-black/30 bg-black/25 px-6 py-5 sm:px-10">
        {!revealed ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-paper/60">
              Space = timer · Enter = reveal · Esc = back
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="rounded-sm border border-paper/30 px-5 py-3 text-paper/80 transition hover:text-paper"
              >
                Back to board
              </button>
              <button
                onClick={onReveal}
                className="display rounded-sm bg-gold px-8 py-3 text-xl tracking-wider text-ink transition hover:bg-gold-bright"
              >
                REVEAL ANSWER
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-paper/60">
              Award {formatMoney(atStake)}
            </p>
            <div className="flex flex-wrap items-stretch gap-3">
              {teams.map((team) => {
                const change = awarded[team.id];
                return (
                  <div
                    key={team.id}
                    className="flex items-center gap-2 rounded-sm border border-paper/20 bg-black/30 px-3 py-2"
                  >
                    <div className="mr-1">
                      <p className="max-w-[10rem] truncate text-sm text-paper">
                        {team.name}
                      </p>
                      <p className="display text-lg text-gold-bright">
                        {formatMoney(team.score)}
                        {change ? (
                          <span
                            className={`ml-2 text-sm ${
                              change > 0 ? "text-correct" : "text-wrong"
                            }`}
                          >
                            {change > 0 ? "+" : ""}
                            {formatMoney(change)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <button
                      onClick={() => onScore(team.id, 1)}
                      aria-label={`${team.name} correct`}
                      className="size-10 rounded-sm bg-correct/20 text-xl text-correct transition hover:bg-correct/35"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => onScore(team.id, -1)}
                      aria-label={`${team.name} incorrect`}
                      className="size-10 rounded-sm bg-wrong/20 text-xl text-wrong transition hover:bg-wrong/35"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              <button
                onClick={onClose}
                className="display ml-auto rounded-sm bg-gold px-8 text-xl tracking-wider text-ink transition hover:bg-gold-bright"
              >
                NEXT CLUE →
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
