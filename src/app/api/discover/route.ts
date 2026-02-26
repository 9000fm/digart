import { NextRequest, NextResponse } from "next/server";
import { discoverFromYouTube } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") || 30),
    50
  );
  const offset = Number(req.nextUrl.searchParams.get("offset") || 0);
  const sort = req.nextUrl.searchParams.get("sort") || undefined;

  try {
    const cards = await discoverFromYouTube(limit, offset, sort);
    return NextResponse.json({ cards, hasMore: true });
  } catch (err) {
    console.error("Discover API error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
