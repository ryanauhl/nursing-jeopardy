import { NextResponse } from "next/server";
import { duplicateGame } from "@/lib/games-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const copy = await duplicateGame(id);
  if (!copy) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  return NextResponse.json(copy, { status: 201 });
}
