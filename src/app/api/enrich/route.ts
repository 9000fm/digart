import { NextResponse } from "next/server";
import { searchArtistGenres } from "@/lib/musicbrainz";
import { getChannelUploads, parseVideoTitle } from "@/lib/youtube";
import approvedChannels from "@/data/approved-channels.json";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_PATH = join(process.cwd(), "src/data/genre-cache.json");

interface GenreCache {
  [artistName: string]: {
    mbId: string | null;
    genres: string[];
    tags: string[];
    fetchedAt: string;
  };
}

function loadCache(): GenreCache {
  if (existsSync(CACHE_PATH)) {
    return JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
  }
  return {};
}

function saveCache(cache: GenreCache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

/**
 * GET /api/enrich?limit=5
 * Enriches approved channels by looking up artist genres on MusicBrainz.
 * Processes `limit` new artists per call (rate limited at 1req/sec).
 * Results are cached in genre-cache.json.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 5), 20);

  const cache = loadCache();
  const artistsSeen = new Set<string>();
  const newResults: { artist: string; genres: string[]; tags: string[] }[] = [];

  // Collect unique artists from approved channels
  const allArtists: string[] = [];
  
  for (const ch of approvedChannels as { name: string; id: string; labels?: string[] }[]) {
    // Use channel name as a potential artist
    const name = ch.name.trim();
    if (name && !artistsSeen.has(name.toLowerCase()) && !cache[name.toLowerCase()]) {
      artistsSeen.add(name.toLowerCase());
      allArtists.push(name);
    }
  }

  // Process up to `limit` uncached artists
  const toProcess = allArtists.slice(0, limit);

  for (const artist of toProcess) {
    try {
      const result = await searchArtistGenres(artist);
      const entry = {
        mbId: result?.id || null,
        genres: result?.genres || [],
        tags: result?.tags?.map((t) => t.name) || [],
        fetchedAt: new Date().toISOString(),
      };
      cache[artist.toLowerCase()] = entry;
      newResults.push({
        artist,
        genres: entry.genres,
        tags: entry.tags.slice(0, 10),
      });
    } catch (e) {
      console.error(`MusicBrainz lookup failed for "${artist}":`, e);
      cache[artist.toLowerCase()] = {
        mbId: null,
        genres: [],
        tags: [],
        fetchedAt: new Date().toISOString(),
      };
    }

    // Rate limit: 1 req/sec (already in searchArtistGenres, but extra safety)
    await new Promise((r) => setTimeout(r, 500));
  }

  saveCache(cache);

  return NextResponse.json({
    processed: newResults.length,
    remaining: allArtists.length - toProcess.length,
    cached: Object.keys(cache).length,
    results: newResults,
  });
}
