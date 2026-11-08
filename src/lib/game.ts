// Shared shapes and board constants used by the API routes, the editor, and
// the game board. Everything about a game's geometry lives here.

export const ROUNDS = [1, 2] as const;
export type Round = (typeof ROUNDS)[number];

export const ROUND_NAMES: Record<Round, string> = {
  1: "Jeopardy",
  2: "Double Jeopardy",
};

/** Dollar values top-to-bottom. Double Jeopardy doubles them, as on the show. */
export const ROUND_VALUES: Record<Round, number[]> = {
  1: [200, 400, 600, 800, 1000],
  2: [400, 800, 1200, 1600, 2000],
};

export const CATEGORIES_PER_ROUND = 5;
export const CLUES_PER_CATEGORY = 5;
export const CLUES_PER_GAME =
  ROUNDS.length * CATEGORIES_PER_ROUND * CLUES_PER_CATEGORY;

export function maxValueForRound(round: Round): number {
  return ROUND_VALUES[round][ROUND_VALUES[round].length - 1];
}

// ---------------------------------------------------------------------------
// Wire types — what the API hands to the client.
// ---------------------------------------------------------------------------

export type ClueData = {
  id: string;
  position: number;
  value: number;
  clue: string;
  answer: string;
  isDailyDouble: boolean;
};

export type CategoryData = {
  id: string;
  name: string;
  round: number;
  position: number;
  clues: ClueData[];
};

export type GameData = {
  id: string;
  title: string;
  finalCategory: string;
  finalClue: string;
  finalAnswer: string;
  createdAt: string;
  updatedAt: string;
  categories: CategoryData[];
};

/** Dashboard list rows — enough to show progress without shipping every clue. */
export type GameSummary = {
  id: string;
  title: string;
  updatedAt: string;
  filledClues: number;
  totalClues: number;
  hasFinal: boolean;
};

// ---------------------------------------------------------------------------
// Creation helpers
// ---------------------------------------------------------------------------

/**
 * A brand-new game is created fully scaffolded: both rounds, 5 categories each,
 * 5 clues each. The board never has to cope with a missing cell — blank clues
 * simply render as unplayable.
 */
export function scaffoldCategories(seed?: {
  categoryNames?: Partial<Record<Round, string[]>>;
}) {
  return ROUNDS.flatMap((round) =>
    Array.from({ length: CATEGORIES_PER_ROUND }, (_, position) => ({
      name: seed?.categoryNames?.[round]?.[position] ?? "",
      round,
      position,
      clues: {
        create: ROUND_VALUES[round].map((value, cluePosition) => ({
          position: cluePosition,
          value,
        })),
      },
    })),
  );
}

/** Sort helper so categories/clues always come back in board order. */
export const categoryOrderBy = [{ round: "asc" as const }, { position: "asc" as const }];
export const clueOrderBy = [{ position: "asc" as const }];

export function categoriesForRound(game: GameData, round: Round): CategoryData[] {
  return game.categories
    .filter((c) => c.round === round)
    .sort((a, b) => a.position - b.position);
}

export function isPlayable(clue: ClueData): boolean {
  return clue.clue.trim().length > 0;
}

export function countFilledClues(game: GameData): number {
  return game.categories.reduce(
    (total, category) => total + category.clues.filter(isPlayable).length,
    0,
  );
}

export function gameHasFinal(game: {
  finalClue: string;
  finalAnswer: string;
}): boolean {
  return game.finalClue.trim().length > 0 && game.finalAnswer.trim().length > 0;
}

/** Money formatting used everywhere: $1,200 / -$400. */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString("en-US")}`;
}
