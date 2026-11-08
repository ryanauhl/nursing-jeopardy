import { NextResponse } from "next/server";
import { createGame, importGame, listGames } from "@/lib/games-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listGames());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (body?.title !== undefined && typeof body.title !== "string") {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  }

  // Two ways in: a blank scaffolded game, or a game restored from exported JSON.
  const game = body?.import
    ? await importGame(body.import)
    : await createGame(body?.title?.trim() || "Untitled Game");

  return NextResponse.json(game, { status: 201 });
}
