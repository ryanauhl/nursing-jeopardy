import { prisma } from "@/lib/db";
import {
  categoryOrderBy,
  clueOrderBy,
  countFilledClues,
  CLUES_PER_GAME,
  gameHasFinal,
  scaffoldCategories,
  type GameData,
  type GameSummary,
} from "@/lib/game";
import { SEED_GAMES, toImportPayload } from "@/lib/seed-games";

const gameInclude = {
  categories: {
    orderBy: categoryOrderBy,
    include: { clues: { orderBy: clueOrderBy } },
  },
} as const;

type RawGame = Awaited<
  ReturnType<typeof prisma.game.findFirstOrThrow<{ include: typeof gameInclude }>>
>;

function serialize(game: RawGame): GameData {
  return {
    id: game.id,
    title: game.title,
    finalCategory: game.finalCategory,
    finalClue: game.finalClue,
    finalAnswer: game.finalAnswer,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    categories: game.categories.map((category) => ({
      id: category.id,
      name: category.name,
      round: category.round,
      position: category.position,
      clues: category.clues.map((clue) => ({
        id: clue.id,
        position: clue.position,
        value: clue.value,
        clue: clue.clue,
        answer: clue.answer,
        isDailyDouble: clue.isDailyDouble,
      })),
    })),
  };
}

/**
 * Put the bundled games in place the first time a deployment starts, so a
 * fresh container opens with something playable instead of an empty library.
 * Only ever fires on a completely empty database — once the user has games of
 * their own (or has deleted ours), it stays out of the way. Set
 * SEED_ON_EMPTY=false to opt out.
 */
export async function ensureSeedGames(): Promise<void> {
  if (process.env.SEED_ON_EMPTY === "false") return;
  if ((await prisma.game.count()) > 0) return;

  for (const seed of SEED_GAMES) {
    await importGame(toImportPayload(seed));
  }
}

export async function listGames(): Promise<GameSummary[]> {
  const games = await prisma.game.findMany({
    orderBy: { updatedAt: "desc" },
    include: gameInclude,
  });

  return games.map((game) => {
    const data = serialize(game);
    return {
      id: data.id,
      title: data.title,
      updatedAt: data.updatedAt,
      filledClues: countFilledClues(data),
      totalClues: CLUES_PER_GAME,
      hasFinal: gameHasFinal(data),
    };
  });
}

export async function getGame(id: string): Promise<GameData | null> {
  const game = await prisma.game.findUnique({ where: { id }, include: gameInclude });
  return game ? serialize(game) : null;
}

export async function createGame(title = "Untitled Game"): Promise<GameData> {
  const game = await prisma.game.create({
    data: { title, categories: { create: scaffoldCategories() } },
    include: gameInclude,
  });
  return serialize(game);
}

/**
 * Import a game from exported JSON. Anything missing falls back to the blank
 * scaffold, so a hand-edited or partial file still produces a valid board.
 * The same goes for fields of the wrong type.
 */
export async function importGame(payload: unknown): Promise<GameData> {
  const source = (payload ?? {}) as Partial<GameData>;
  const scaffold = scaffoldCategories();
  const text = (value: unknown, fallback = "") =>
    typeof value === "string" ? value : fallback;
  const list = <T>(value: T[] | undefined) => (Array.isArray(value) ? value : []);

  const categories = scaffold.map((blank) => {
    const incoming = list(source.categories).find(
      (c) => c?.round === blank.round && c?.position === blank.position,
    );
    return {
      name: text(incoming?.name, blank.name),
      round: blank.round,
      position: blank.position,
      clues: {
        create: blank.clues.create.map((blankClue) => {
          const incomingClue = list(incoming?.clues).find(
            (c) => c?.position === blankClue.position,
          );
          return {
            position: blankClue.position,
            value: blankClue.value,
            clue: text(incomingClue?.clue),
            answer: text(incomingClue?.answer),
            isDailyDouble: incomingClue?.isDailyDouble === true,
          };
        }),
      },
    };
  });

  const game = await prisma.game.create({
    data: {
      title: text(source.title).trim() || "Imported Game",
      finalCategory: text(source.finalCategory),
      finalClue: text(source.finalClue),
      finalAnswer: text(source.finalAnswer),
      categories: { create: categories },
    },
    include: gameInclude,
  });
  return serialize(game);
}

/** Clone an existing game — the fastest way to build the next one. */
export async function duplicateGame(id: string): Promise<GameData | null> {
  const original = await getGame(id);
  if (!original) return null;
  return importGame({ ...original, title: `${original.title} (copy)` });
}

/** Returns false if there was no such game to delete. */
export async function deleteGame(id: string): Promise<boolean> {
  const { count } = await prisma.game.deleteMany({ where: { id } });
  return count > 0;
}

export type GameUpdate = {
  title?: string;
  finalCategory?: string;
  finalClue?: string;
  finalAnswer?: string;
  categories?: { id: string; name: string }[];
  clues?: {
    id: string;
    clue?: string;
    answer?: string;
    isDailyDouble?: boolean;
  }[];
};

/** Check that an untrusted request body has the shape of a GameUpdate. */
export function isGameUpdate(body: unknown): body is GameUpdate {
  type Fields = Record<string, unknown>;
  const isObject = (value: unknown): value is Fields =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const optional = (value: unknown, type: "string" | "boolean") =>
    value === undefined || typeof value === type;
  const optionalRows = (value: unknown, isValid: (row: Fields) => boolean) =>
    value === undefined ||
    (Array.isArray(value) &&
      value.every((row) => isObject(row) && typeof row.id === "string" && isValid(row)));

  return (
    isObject(body) &&
    optional(body.title, "string") &&
    optional(body.finalCategory, "string") &&
    optional(body.finalClue, "string") &&
    optional(body.finalAnswer, "string") &&
    optionalRows(body.categories, (row) => typeof row.name === "string") &&
    optionalRows(
      body.clues,
      (row) =>
        optional(row.clue, "string") &&
        optional(row.answer, "string") &&
        optional(row.isDailyDouble, "boolean"),
    )
  );
}

/**
 * Patch a game in one transaction. The editor autosaves whole snapshots, so a
 * partial write mid-save would leave the board inconsistent. Category and clue
 * writes are scoped to this game, so an id from another game changes nothing.
 */
export async function updateGame(
  id: string,
  update: GameUpdate,
): Promise<GameData | null> {
  const exists = await prisma.game.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return null;

  await prisma.$transaction([
    prisma.game.update({
      where: { id },
      data: {
        ...(update.title !== undefined ? { title: update.title } : {}),
        ...(update.finalCategory !== undefined
          ? { finalCategory: update.finalCategory }
          : {}),
        ...(update.finalClue !== undefined ? { finalClue: update.finalClue } : {}),
        ...(update.finalAnswer !== undefined
          ? { finalAnswer: update.finalAnswer }
          : {}),
      },
    }),
    ...(update.categories ?? []).map((category) =>
      prisma.category.updateMany({
        where: { id: category.id, gameId: id },
        data: { name: category.name },
      }),
    ),
    ...(update.clues ?? []).map((clue) =>
      prisma.clue.updateMany({
        where: { id: clue.id, category: { gameId: id } },
        data: {
          ...(clue.clue !== undefined ? { clue: clue.clue } : {}),
          ...(clue.answer !== undefined ? { answer: clue.answer } : {}),
          ...(clue.isDailyDouble !== undefined
            ? { isDailyDouble: clue.isDailyDouble }
            : {}),
        },
      }),
    ),
  ]);

  return getGame(id);
}
