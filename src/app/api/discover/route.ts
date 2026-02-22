import { NextRequest, NextResponse } from "next/server";
import { discoverFromYouTube } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") || 30),
    50
  );
  const offset = Number(req.nextUrl.searchParams.get("offset") || 0);
  const genre = req.nextUrl.searchParams.get("genre") || "";

  try {
    const cards = await discoverFromYouTube(limit, offset);

    // Filter by genre if provided
    const filtered = genre
      ? cards.filter(
          (c) =>
            c.genres.some((g) => g.toLowerCase().includes(genre.toLowerCase())) ||
            c.channelLabels.some((l) => l.toLowerCase().includes(genre.toLowerCase()))
        )
      : cards;

    return NextResponse.json({ cards: filtered, hasMore: true });
  } catch (err) {
    console.error("Discover API error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
