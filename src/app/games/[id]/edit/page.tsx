import { notFound } from "next/navigation";
import { getGame } from "@/lib/games-service";
import { GameEditor } from "@/components/game-editor";

export const dynamic = "force-dynamic";

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <GameEditor initialGame={game} />;
}
