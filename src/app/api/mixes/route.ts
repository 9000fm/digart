import { NextRequest, NextResponse } from "next/server";
import { discoverMixes } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const sort = searchParams.get("sort") || undefined;
    const cards = await discoverMixes(limit, offset, sort);
    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Mixes API error:", error);
    return NextResponse.json({ cards: [] }, { status: 500 });
  }
}
