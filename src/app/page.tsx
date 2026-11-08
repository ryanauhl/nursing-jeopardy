import { ensureSeedGames, listGames } from "@/lib/games-service";
import { GameLibrary } from "@/components/game-library";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensureSeedGames();
  const games = await listGames();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-24 pt-14">
      <header className="mb-12">
        <p className="display text-sm tracking-[0.45em] text-gold">
          GAME NIGHT CONTROL
        </p>
        <h1 className="display tv-shadow-lg mt-3 text-6xl leading-none text-paper sm:text-7xl">
          JEOPARDY!
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Write your questions, keep them on this machine, and play as many
          rounds as the party wants.
        </p>
      </header>

      <GameLibrary initialGames={games} />
    </main>
  );
}
