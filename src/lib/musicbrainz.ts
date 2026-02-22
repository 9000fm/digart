/**
 * MusicBrainz API — free, no auth for reads.
 * Rate limit: 1 req/sec. Always set a User-Agent.
 */

const MB_API = "https://musicbrainz.org/ws/2";
const USER_AGENT = "digeart/1.0 (https://github.com/9000fm/digeart)";

interface MBArtistTag {
  name: string;
  count: number;
}

interface MBArtistResult {
  id: string;
  name: string;
  tags: MBArtistTag[];
  genres: string[];
}

/**
 * Search for an artist by name, return top genre tags.
 * Returns null if not found.
 */
export async function searchArtistGenres(
  artistName: string
): Promise<MBArtistResult | null> {
  const query = encodeURIComponent(artistName.trim());
  const url = `${MB_API}/artist/?query=artist:${query}&fmt=json&limit=1`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const artist = data.artists?.[0];
  if (!artist) return null;

  // Get full artist with tags (inc=tags+genres)
  const detailUrl = `${MB_API}/artist/${artist.id}?inc=tags+genres&fmt=json`;

  // Respect rate limit
  await new Promise((r) => setTimeout(r, 1100));

  const detailRes = await fetch(detailUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!detailRes.ok) {
    return {
      id: artist.id,
      name: artist.name,
      tags: [],
      genres: [],
    };
  }

  const detail = await detailRes.json();

  const tags: MBArtistTag[] = (detail.tags || [])
    .filter((t: MBArtistTag) => t.count > 0)
    .sort((a: MBArtistTag, b: MBArtistTag) => b.count - a.count);

  const genres: string[] = (detail.genres || []).map(
    (g: { name: string }) => g.name
  );

  return {
    id: artist.id,
    name: artist.name,
    tags,
    genres,
  };
}
