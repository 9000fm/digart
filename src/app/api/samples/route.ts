import { NextRequest, NextResponse } from "next/server";
import { discoverSamples } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const cards = await discoverSamples(limit, offset);
    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Samples API error:", error);
    return NextResponse.json({ cards: [] }, { status: 500 });
  }
}
