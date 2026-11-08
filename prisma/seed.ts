import "dotenv/config";
import { prisma } from "../src/lib/db";
import { importGame } from "../src/lib/games-service";
import { SEED_GAMES, toImportPayload } from "../src/lib/seed-games";

// `npm run seed` — restore the bundled game. Idempotent: it replaces the seeded
// game by title and leaves anything you've written alone.

async function main() {
  for (const seed of SEED_GAMES) {
    const { count } = await prisma.game.deleteMany({ where: { title: seed.title } });
    if (count > 0) console.log(`Removed ${count} existing copy of "${seed.title}".`);

    // Reuse the JSON-import path so there's only one way a game gets built.
    const game = await importGame(toImportPayload(seed));

    const clues = game.categories.flatMap((c) => c.clues);
    const filled = clues.filter((c) => c.clue.trim()).length;
    const dailyDoubles = clues.filter((c) => c.isDailyDouble).length;
    console.log(
      `Seeded "${game.title}" — ${filled} clues, ${dailyDoubles} Daily Doubles.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
