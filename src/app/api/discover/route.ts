import { NextRequest, NextResponse } from "next/server";
import { getRecommendations, getAudioFeatures } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const genres = req.nextUrl.searchParams.get("genres")?.split(",") || [
    "pop",
    "electronic",
    "hip-hop",
  ];
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") || 30),
    50
  );

  try {
    const tracks = await getRecommendations(genres, limit);
    const ids = tracks.map((t) => t.id);
    const features = await getAudioFeatures(ids);

    const cards = tracks.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      album: t.album.name,
      image: t.album.images[0]?.url || "",
      imageSmall: t.album.images[t.album.images.length - 1]?.url || "",
      previewUrl: t.preview_url,
      spotifyUrl: t.external_urls.spotify,
      uri: t.uri,
      bpm: features[t.id] ? Math.round(features[t.id].tempo) : null,
      energy: features[t.id] ? Math.round(features[t.id].energy * 100) : null,
      danceability: features[t.id]
        ? Math.round(features[t.id].danceability * 100)
        : null,
      valence: features[t.id]
        ? Math.round(features[t.id].valence * 100)
        : null,
      key: features[t.id]?.key ?? null,
    }));

    return NextResponse.json({ cards });
  } catch (err) {
    console.error("Discover API error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
