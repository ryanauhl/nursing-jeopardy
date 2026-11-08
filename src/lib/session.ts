"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Round } from "@/lib/game";

// The live game lives in the browser: teams, scores, which tiles are spent.
// Content stays on the server. A refresh mid-game must lose nothing, so every
// change writes through to localStorage immediately.

export type Team = { id: string; name: string; score: number };

export type FinalStage = "wagers" | "clue" | "answer" | "results";

export type FinalState = {
  stage: FinalStage;
  wagers: Record<string, number>;
  results: Record<string, boolean | null>;
};

export type Session = {
  teams: Team[];
  usedClueIds: string[];
  round: Round;
  final: FinalState;
};

export const emptyFinal: FinalState = { stage: "wagers", wagers: {}, results: {} };

function storageKey(gameId: string) {
  return `jeopardy:session:${gameId}`;
}

function parse(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!Array.isArray(parsed.teams)) return null;
    return {
      teams: parsed.teams,
      usedClueIds: Array.isArray(parsed.usedClueIds) ? parsed.usedClueIds : [],
      round: parsed.round === 2 ? 2 : 1,
      final: { ...emptyFinal, ...(parsed.final ?? {}) },
    };
  } catch {
    // A corrupt entry should never block the party — start fresh instead.
    return null;
  }
}

/*
  A tiny external store over localStorage. useSyncExternalStore is the right
  tool here: the server can't see storage, so it renders `loaded: false` and
  the real session arrives on the first client snapshot. That distinction
  matters — "not checked yet" must not look like "no game in progress", or the
  board would flash the team-setup screen on every refresh.
*/
type Snapshot = { session: Session | null; loaded: boolean };

const SERVER_SNAPSHOT: Snapshot = { session: null, loaded: false };

const snapshots = new Map<string, { raw: string | null; snapshot: Snapshot }>();
const listeners = new Map<string, Set<() => void>>();

function getSnapshot(gameId: string): Snapshot {
  const raw = window.localStorage.getItem(storageKey(gameId));
  const cached = snapshots.get(gameId);
  // Identity must stay stable between reads or React will loop.
  if (cached && cached.raw === raw) return cached.snapshot;
  const snapshot: Snapshot = { session: parse(raw), loaded: true };
  snapshots.set(gameId, { raw, snapshot });
  return snapshot;
}

function subscribe(gameId: string, listener: () => void) {
  let set = listeners.get(gameId);
  if (!set) {
    set = new Set();
    listeners.set(gameId, set);
  }
  set.add(listener);
  // Keep a second tab on the same machine in step rather than silently diverging.
  window.addEventListener("storage", listener);
  return () => {
    set.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function write(gameId: string, next: Session | null) {
  if (next) {
    window.localStorage.setItem(storageKey(gameId), JSON.stringify(next));
  } else {
    window.localStorage.removeItem(storageKey(gameId));
  }
  listeners.get(gameId)?.forEach((listener) => listener());
}

export function useSession(gameId: string) {
  const { session, loaded } = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(gameId, listener), [gameId]),
    useCallback(() => getSnapshot(gameId), [gameId]),
    () => SERVER_SNAPSHOT,
  );

  /** Apply a change to the existing session; no-ops before the game starts. */
  const update = useCallback(
    (mutate: (current: Session) => Session) => {
      const current = getSnapshot(gameId).session;
      if (!current) return;
      write(gameId, mutate(current));
    },
    [gameId],
  );

  const start = useCallback(
    (names: string[]) => {
      write(gameId, {
        teams: names.map((name, index) => ({
          id: `t${index}-${name.toLowerCase().replace(/\W+/g, "") || index}`,
          name,
          score: 0,
        })),
        usedClueIds: [],
        round: 1,
        final: emptyFinal,
      });
    },
    [gameId],
  );

  const reset = useCallback(() => write(gameId, null), [gameId]);

  const adjustScore = useCallback(
    (teamId: string, delta: number) =>
      update((current) => ({
        ...current,
        teams: current.teams.map((team) =>
          team.id === teamId ? { ...team, score: team.score + delta } : team,
        ),
      })),
    [update],
  );

  const setScore = useCallback(
    (teamId: string, score: number) =>
      update((current) => ({
        ...current,
        teams: current.teams.map((team) =>
          team.id === teamId ? { ...team, score } : team,
        ),
      })),
    [update],
  );

  const markUsed = useCallback(
    (clueId: string) =>
      update((current) =>
        current.usedClueIds.includes(clueId)
          ? current
          : { ...current, usedClueIds: [...current.usedClueIds, clueId] },
      ),
    [update],
  );

  const setRound = useCallback(
    (round: Round) => update((current) => ({ ...current, round })),
    [update],
  );

  const updateFinal = useCallback(
    (mutate: (final: FinalState) => FinalState) =>
      update((current) => ({ ...current, final: mutate(current.final) })),
    [update],
  );

  return {
    session,
    loaded,
    start,
    reset,
    adjustScore,
    setScore,
    markUsed,
    setRound,
    updateFinal,
  };
}
