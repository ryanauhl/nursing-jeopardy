import { notFound } from "next/navigation";
import { getGame } from "@/lib/games-service";
import { GameBoard } from "@/components/game-board";

export const dynamic = "force-dynamic";

export default async function PlayGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <GameBoard game={game} />;
}
