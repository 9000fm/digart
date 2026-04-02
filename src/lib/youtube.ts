import { cacheGet, cacheSet } from "./cache";
import { supabase } from "./supabase";
import type { CardData } from "./types";

const API_KEY = process.env.YOUTUBE_API_KEY!;
const YT_API = "https://www.googleapis.com/youtube/v3";

/* ── Tag type ────────────────────────────────────────────────────────── */

export type Tag = "all" | "hot" | "rare" | "new";

const VALID_TAGS: Tag[] = ["all", "hot", "rare", "new"];

export function isValidTag(v: string | null | undefined): v is Tag {
  return VALID_TAGS.includes(v as Tag);
}

/* ── Seeded PRNG (mulberry32) ────────────────────────────────────────── */

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Daily seed — same value across all Vercel instances for the same day */
function dailySeed(): number {
  return Math.floor(Date.now() / 86_400_000);
}

/** Fisher-Yates shuffle with seeded PRNG — deterministic per day */
function seededShuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  const rand = mulberry32(dailySeed());
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ── Approved channels from Supabase (cached) ───────────────────────── */

type ApprovedChannel = { name: string; id: string; labels?: string[]; starred?: boolean };

async function getApprovedChannels(): Promise<ApprovedChannel[]> {
  const cacheKey = "supabase-approved-channels-v1";
  const cached = cacheGet<ApprovedChannel[]>(cacheKey);
  if (cached) return cached;

  const { data } = await supabase
    .from("curator_channels")
    .select("channel_id, name, labels, starred")
    .eq("status", "approved");

  const channels: ApprovedChannel[] = (data || []).map((c) => ({
    id: c.channel_id,
    name: c.name,
    labels: c.labels || [],
    starred: c.starred === true,
  }));

  // Fall back to static JSON if Supabase returns empty (first-time setup)
  if (channels.length === 0) {
    const fallback = await import("@/data/approved-channels.json");
    const result = (fallback.default || []) as ApprovedChannel[];
    cacheSet(cacheKey, result);
    return result;
  }

  cacheSet(cacheKey, channels);
  return channels;
}

/* ── Persistent pool cache (Supabase) ────────────────────────────────── */

const POOL_MAX_AGE = 3 * 60 * 60 * 1000; // 3 hours
const RAW_CACHE_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours (deep fetch 2x/day)

interface PoolCacheResult<T = CardData[]> {
  data: T;
  isStale: boolean;
}

async function getPoolFromSupabase<T = CardData[]>(key: string, maxAge = POOL_MAX_AGE): Promise<PoolCacheResult<T> | null> {
  try {
    const { data } = await supabase
      .from("pool_cache")
      .select("data, updated_at")
      .eq("key", key)
      .single();
    if (!data) return null;
    const age = Date.now() - new Date(data.updated_at).getTime();
    return { data: data.data as T, isStale: age > maxAge };
  } catch {
    return null;
  }
}

/* ── Rebuild lock (prevents concurrent rebuilds of the same pool) ──── */

const globalRebuild = globalThis as typeof globalThis & {
  __digeartRebuilding?: Set<string>;
};
if (!globalRebuild.__digeartRebuilding) {
  globalRebuild.__digeartRebuilding = new Set();
}
const rebuildingPools = globalRebuild.__digeartRebuilding;

async function savePoolToSupabase(key: string, pool: unknown): Promise<void> {
  try {
    await supabase
      .from("pool_cache")
      .upsert({ key, data: pool, updated_at: new Date().toISOString() });
  } catch {
    // Non-critical — in-memory cache still works
  }
}

/* ── Shared types & constants ────────────────────────────────────────── */

interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  width: number;
  height: number;
  duration: number | null;
  viewCount: number | null;
  publishedAt: string | null;
  description: string | null;
}

const NON_MUSIC_KEYWORDS = [
  // tutorials & education
  "tutorial", "how to", "how-to", "walkthrough", "explained",
  "lesson", "masterclass", "course", "learn to",
  "piano lesson", "music theory", "chord progression", "beginner", "practice",
  // production / DAW content
  "fl studio", "ableton", "logic pro", "bitwig", "pro tools",
  "making a beat", "beat making", "beatmaking", "sound design tutorial",
  "preset pack", "sample pack review", "plugin review",
  // gear & reviews
  "gear review", "unboxing", "studio tour", "setup tour",
  "vs comparison", "synth review", "midi controller",
  // covers & non-original
  "cover)", "cover]", "(cover", "[cover",
  "piano cover", "guitar cover", "drum cover", "vocal cover",
  "acoustic cover", "ukulele cover",
  // reactions & commentary
  "reaction", "reacting to", "first time hearing",
  "review:", "album review", "track review",
  // vlogs & non-music
  "vlog", "q&a", "q & a", "behind the scenes",
  "day in the life", "studio vlog",
];

function isNonMusic(title: string): boolean {
  const lower = title.toLowerCase();
  return NON_MUSIC_KEYWORDS.some((kw) => lower.includes(kw));
}

/* ── Feed-separation filters ─────────────────────────────────────────── */

const NON_ELECTRONIC_ONLY_LABELS = [
  "Samples", "Experimental", "Pop", "World", "Jazz", "Hip Hop", "Reggae",
  "Rock", "Alternative", "Indie", "Metal", "Punk", "Folk", "Country",
  "Classical", "R&B", "Soul", "Blues", "Funk",
];

const HOMEPAGE_TITLE_EXCLUDES = [
  "sample", "samples", "drum break", "drum breaks", "breaks compilation",
  "rock", "metal", "punk", "grunge", "classic rock",
  "alternative", "indie rock", "folk", "country", "classical", "blues", "r&b", "soul",
  "dj set", "dj mix", "live set", "live mix", "b2b", "boiler room",
];

const SAMPLE_TITLE_KEYWORDS = [
  "sample", "rare", "obscure", "ost", "soundtrack", "library",
  "private press", "unreleased", "forgotten",
];

const MIX_TITLE_KEYWORDS = [
  "mix", "set", "dj", "live", "b2b", "session", "boiler room", "recorded at",
];

const MIX_CHANNEL_LABELS = ["DJ Sets", "Live Sets"];

function isNonElectronicOnly(labels: string[]): boolean {
  if (labels.some((l) => ["samples", "dj sets", "live sets"].includes(l.toLowerCase()))) return true;
  return labels.every((l) =>
    NON_ELECTRONIC_ONLY_LABELS.some((nl) => nl.toLowerCase() === l.toLowerCase())
  );
}

function titleContainsAny(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/** Parse ISO 8601 duration (PT1H23M45S) to seconds */
export function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/* ── Tag filtering utility ───────────────────────────────────────────── */

/**
 * Filter + sort a card pool by tag(s) BEFORE offset/limit slicing.
 * Accepts a single tag or an array of tags.
 * When multiple tags are provided, returns cards matching ANY tag (union).
 */
export function applyTagFilter(pool: CardData[], tag: Tag | Tag[]): CardData[] {
  const tags: Tag[] = Array.isArray(tag) ? tag : [tag];
  // No filter needed
  if (tags.length === 0 || (tags.length === 1 && tags[0] === "all")) return pool;

  const thirtyDaysMs = 30 * 86_400_000;
  const now = Date.now();

  return pool.filter((c) => {
    for (const t of tags) {
      if (t === "all") return true;
      if (t === "hot" && c.viewCount != null && c.viewCount >= 50_000) return true;
      if (t === "rare" && c.viewCount != null && c.viewCount < 5_000) return true;
      if (t === "new" && c.publishedAt && now - new Date(c.publishedAt).getTime() <= thirtyDaysMs) return true;
    }
    return false;
  });
}

/* ── YouTube helpers ─────────────────────────────────────────────────── */

/** Batch-fetch durations + view counts for video IDs via videos.list */
async function fetchVideoDetails(
  videoIds: string[]
): Promise<Map<string, { duration: number; viewCount: number }>> {
  const details = new Map<string, { duration: number; viewCount: number }>();
  if (videoIds.length === 0) return details;

  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const params = new URLSearchParams({
      part: "contentDetails,statistics",
      id: chunk.join(","),
      key: API_KEY,
    });

    try {
      const res = await fetch(`${YT_API}/videos?${params}`, {
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const data = await res.json();
        for (const item of data.items || []) {
          const dur = parseDuration(item.contentDetails?.duration || "");
          const views = parseInt(item.statistics?.viewCount || "0", 10);
          details.set(item.id, { duration: dur, viewCount: views });
        }
      }
    } catch {
      // silently skip fetch failures
    }
  }

  return details;
}

function uploadsPlaylistId(channelId: string): string {
  return "UU" + channelId.slice(2);
}

/**
 * Fetch uploads from a channel's uploads playlist.
 * `maxPages` controls YouTube API pagination (each page ≤ maxResults items).
 */
export async function getChannelUploads(
  channelId: string,
  maxResults = 5,
  withDuration = false,
  skipCache = false,
  maxPages = 1
): Promise<YouTubeVideo[]> {
  const cacheKey = `yt-uploads-${channelId}-${maxResults}-${withDuration ? "dur" : "nodur"}-p${maxPages}`;
  if (!skipCache) {
    const cached = cacheGet<YouTubeVideo[]>(cacheKey);
    if (cached) return cached;
  }

  const playlistId = uploadsPlaylistId(channelId);
  const allVideos: YouTubeVideo[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: String(maxResults),
      key: API_KEY,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${YT_API}/playlistItems?${params}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error(`YouTube uploads error for ${channelId}:`, res.status);
      break;
    }

    const data = await res.json();
    const videos: YouTubeVideo[] = (data.items || [])
      .filter((item: { snippet?: { resourceId?: { videoId?: string } } }) =>
        item.snippet?.resourceId?.videoId
      )
      .map(
        (item: {
          snippet: {
            resourceId: { videoId: string };
            title: string;
            channelTitle: string;
            publishedAt?: string;
            description?: string;
            thumbnails?: {
              high?: { url: string; width?: number; height?: number };
              medium?: { url: string; width?: number; height?: number };
              default?: { url: string; width?: number; height?: number };
            };
          };
        }) => {
          const thumb =
            item.snippet.thumbnails?.high ||
            item.snippet.thumbnails?.medium ||
            item.snippet.thumbnails?.default;
          return {
            id: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: thumb?.url || "",
            width: thumb?.width || 480,
            height: thumb?.height || 360,
            duration: null as number | null,
            viewCount: null as number | null,
            publishedAt: item.snippet.publishedAt || null,
            description: item.snippet.description || null,
          };
        }
      );

    allVideos.push(...videos);

    // Check for next page
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  // Fetch durations + view counts
  if (allVideos.length > 0) {
    const details = await fetchVideoDetails(allVideos.map((v) => v.id));
    for (const v of allVideos) {
      const d = details.get(v.id);
      if (d) {
        v.duration = d.duration;
        v.viewCount = d.viewCount;
      }
    }
  }

  cacheSet(cacheKey, allVideos);
  return allVideos;
}

export function parseVideoTitle(
  title: string,
  channelName: string
): { name: string; artist: string } {
  const cleaned = title
    .replace(/\b(?:premiere|premier)\s*[:：]\s*/gi, "")
    .replace(/\s*[\[\(](?:official|music|lyric|audio|video|hd|hq|4k|visualizer|remastered|remaster|full|original)[\s\w]*[\]\)]/gi, "")
    .replace(/\s*\|\s*.*$/, "")
    .trim();

  const separators = [" — ", " – ", " - "];
  const stripPremiere = (s: string) => s.replace(/\b(?:premiere|premier)\s*[:：]\s*/gi, "").trim();

  for (const sep of separators) {
    const idx = cleaned.indexOf(sep);
    if (idx > 0) {
      return {
        artist: stripPremiere(cleaned.slice(0, idx).trim()),
        name: stripPremiere(cleaned.slice(idx + sep.length).trim()) || cleaned,
      };
    }
  }

  return { name: stripPremiere(cleaned) || title, artist: channelName };
}

function videoThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function videoToCard(v: YouTubeVideo): CardData {
  const { name, artist } = parseVideoTitle(v.title, v.channelTitle);
  return {
    id: `yt-${v.id}`,
    name,
    artist,
    album: v.channelTitle,
    image: videoThumbnail(v.id),
    imageSmall: v.thumbnail,
    previewUrl: null,
    youtubeUrl: `https://www.youtube.com/watch?v=${v.id}`,
    videoId: v.id,
    uri: null,
    source: "youtube" as const,
    bpm: null,
    energy: null,
    danceability: null,
    valence: null,
    key: null,
    duration: v.duration,
    viewCount: v.viewCount,
    publishedAt: v.publishedAt,
    description: v.description,
  };
}

/* ── Pool return type ────────────────────────────────────────────────── */

interface PoolResult {
  cards: CardData[];
  totalFiltered: number;
  needsRebuild: boolean;
}

/* ── Genre label filtering ────────────────────────────────────────────── */

function filterChannelsByGenre(
  channels: { name: string; id: string; labels?: string[] }[],
  genre?: string
): { name: string; id: string; labels?: string[] }[] {
  if (!genre) return channels;
  // Support comma-separated genres (match ANY)
  const genres = genre.split(",").map((g) => g.trim().toLowerCase()).filter(Boolean);
  if (genres.length === 0) return channels;
  return channels.filter(
    (c) => c.labels?.some((l) => genres.includes(l.toLowerCase()))
  );
}

/* ── Raw video cache (deep fetch, stored in pool_cache) ─────────────── */

interface RawVideo {
  video: YouTubeVideo;
  starred: boolean;
}

async function getRawVideos(
  poolType: "discover" | "mixes" | "samples",
  genre?: string
): Promise<{ raw: RawVideo[]; isStale: boolean }> {
  const rawKey = genre
    ? `raw-${poolType}-${genre.toLowerCase()}`
    : `raw-${poolType}`;

  // Check raw cache (12h TTL)
  const cached = await getPoolFromSupabase<RawVideo[]>(rawKey, RAW_CACHE_MAX_AGE);
  if (cached && cached.data.length > 0 && !cached.isStale) {
    return { raw: cached.data, isStale: false };
  }

  // Raw cache miss or stale → deep fetch from YouTube
  const allApproved = await getApprovedChannels();

  let channels: ApprovedChannel[];
  let maxPages: number;
  let maxResults: number;

  if (poolType === "discover") {
    channels = allApproved.filter((c) => {
      if (!c.labels || c.labels.length === 0) return false;
      if (isNonElectronicOnly(c.labels)) return false;
      return true;
    });
    maxPages = 8;
    maxResults = 50;
  } else if (poolType === "mixes") {
    channels = allApproved.filter(
      (c) => c.labels?.some((l) =>
        MIX_CHANNEL_LABELS.some((ml) => ml.toLowerCase() === l.toLowerCase())
      )
    );
    maxPages = 5;
    maxResults = 50;
  } else {
    channels = allApproved.filter(
      (c) => c.labels?.some((l) =>
        STRICT_SAMPLE_LABELS.some((sl) => l.toLowerCase() === sl.toLowerCase())
      )
    );
    maxPages = 8;
    maxResults = 50;
  }

  channels = filterChannelsByGenre(channels, genre);

  const allRaw: RawVideo[] = [];
  const BATCH_SIZE = 10;
  for (let i = 0; i < channels.length; i += BATCH_SIZE) {
    const batch = channels.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((ch) => getChannelUploads(ch.id, maxResults, true, false, maxPages))
    );
    for (let j = 0; j < batch.length; j++) {
      if (results[j].status === "fulfilled") {
        for (const v of (results[j] as PromiseFulfilledResult<YouTubeVideo[]>).value) {
          allRaw.push({ video: v, starred: batch[j].starred === true });
        }
      }
    }
  }

  if (allRaw.length > 0) {
    await savePoolToSupabase(rawKey, allRaw);
  }

  return { raw: allRaw, isStale: cached?.isStale ?? false };
}

/* ── Smart sampling (recientes + populares + random) ────────────────── */

function smartSample(
  raw: RawVideo[],
  videoFilter: (v: YouTubeVideo) => boolean,
  recentPct = 0.4,
  popularPct = 0.4,
  randomPct = 0.2
): CardData[] {
  const filtered = raw.filter(({ video }) => videoFilter(video));
  const starred = filtered.filter((v) => v.starred);
  const regular = filtered.filter((v) => !v.starred);

  const sampleGroup = (group: RawVideo[]) => {
    const total = group.length;
    if (total === 0) return [] as YouTubeVideo[];
    const recentCount = Math.ceil(total * recentPct);
    const popularCount = Math.ceil(total * popularPct);
    const randomCount = Math.ceil(total * randomPct);

    const byDate = [...group].sort(
      (a, b) => new Date(b.video.publishedAt || 0).getTime() - new Date(a.video.publishedAt || 0).getTime()
    );
    const byViews = [...group].sort(
      (a, b) => (b.video.viewCount || 0) - (a.video.viewCount || 0)
    );

    const selected = new Set<string>();
    const result: YouTubeVideo[] = [];

    for (const v of byDate) {
      if (selected.size >= recentCount) break;
      if (!selected.has(v.video.id)) { selected.add(v.video.id); result.push(v.video); }
    }
    for (const v of byViews) {
      if (result.length >= recentCount + popularCount) break;
      if (!selected.has(v.video.id)) { selected.add(v.video.id); result.push(v.video); }
    }
    const remaining = group.filter((v) => !selected.has(v.video.id));
    const shuffled = seededShuffle(remaining);
    for (const v of shuffled.slice(0, randomCount)) {
      result.push(v.video);
    }

    return result;
  };

  const starredCards = sampleGroup(starred).map(videoToCard);
  const regularCards = sampleGroup(regular).map(videoToCard);
  const totalAvailable = starredCards.length + regularCards.length;
  const starredTarget = Math.min(starredCards.length, Math.round(totalAvailable * 0.35));
  const regularTarget = totalAvailable - starredTarget;

  return seededShuffle([
    ...seededShuffle(starredCards).slice(0, starredTarget),
    ...seededShuffle(regularCards).slice(0, regularTarget),
  ]);
}

/* ── Discover (homepage) ─────────────────────────────────────────────── */

/** Common video filter for homepage */
function isValidHomepageVideo(v: YouTubeVideo): boolean {
  if (v.title === "Private video" || v.title === "Deleted video") return false;
  const lower = v.title.toLowerCase();
  if (lower.includes("#shorts") || lower.includes("#short")) return false;
  if (lower.includes("shorts") && lower.length < 80) return false;
  if (v.height > v.width) return false;
  if (isNonMusic(v.title)) return false;
  if (!v.duration || v.duration < 240 || v.duration > 900) return false;
  if (titleContainsAny(v.title, HOMEPAGE_TITLE_EXCLUDES)) return false;
  return true;
}

async function getDiscoverPool(genre?: string): Promise<{ pool: CardData[]; needsRebuild: boolean }> {
  const poolKey = genre ? `discover-${genre.toLowerCase()}` : "discover";
  const memoryCacheKey = `pool-${poolKey}`;

  // Layer 1: in-memory cache (instant)
  const memCached = cacheGet<CardData[]>(memoryCacheKey);
  if (memCached && memCached.length > 0) return { pool: memCached, needsRebuild: false };

  // Layer 2: Supabase persistent cache (survives cold starts)
  const sbCached = await getPoolFromSupabase(poolKey);
  if (sbCached && sbCached.data.length > 0) {
    cacheSet(memoryCacheKey, sbCached.data, POOL_MAX_AGE);
    // Stale-while-revalidate: serve stale data, signal background rebuild
    return { pool: sbCached.data, needsRebuild: sbCached.isStale };
  }

  // Layer 3: rebuild from YouTube (only on true cold start — no data at all)
  const pool = await buildDiscoverPool(genre);
  return { pool, needsRebuild: false };
}

/** Full YouTube rebuild for discover pool — called synchronously on cold start or via after() on stale */
async function buildDiscoverPool(genre?: string): Promise<CardData[]> {
  const poolKey = genre ? `discover-${genre.toLowerCase()}` : "discover";
  const memoryCacheKey = `pool-${poolKey}`;

  const { raw } = await getRawVideos("discover", genre);
  const pool = smartSample(raw, isValidHomepageVideo);

  if (pool.length > 0) {
    cacheSet(memoryCacheKey, pool, POOL_MAX_AGE);
    await savePoolToSupabase(poolKey, pool);
  }

  return pool;
}

/** Background rebuild for discover pool (called from after()) */
export async function rebuildDiscoverPool(genre?: string): Promise<void> {
  const lockKey = genre ? `discover-${genre.toLowerCase()}` : "discover";
  if (rebuildingPools.has(lockKey)) return;
  rebuildingPools.add(lockKey);
  try {
    await buildDiscoverPool(genre);
  } finally {
    rebuildingPools.delete(lockKey);
  }
}

export async function discoverFromYouTube(
  limit = 30,
  offset = 0,
  tag: Tag | Tag[] = "all",
  genre?: string,
  rotate?: number
): Promise<PoolResult> {
  const { pool, needsRebuild } = await getDiscoverPool(genre);
  if (pool.length === 0) return { cards: [], totalFiltered: 0, needsRebuild };

  const filtered = applyTagFilter(pool, tag);
  let feed = filtered;
  if (rotate && feed.length > 1) {
    const r = ((rotate % feed.length) + feed.length) % feed.length;
    feed = [...feed.slice(r), ...feed.slice(0, r)];
  }
  return {
    cards: feed.slice(offset, offset + limit),
    totalFiltered: feed.length,
    needsRebuild,
  };
}

/* ── Mixes ───────────────────────────────────────────────────────────── */

/** Full YouTube rebuild for mixes pool */
function isValidMixVideo(v: YouTubeVideo): boolean {
  if (v.title === "Private video" || v.title === "Deleted video") return false;
  if (!v.duration || v.duration < 2400) return false;
  const lower = v.title.toLowerCase();
  if (lower.includes("#shorts") || lower.includes("#short")) return false;
  if (!titleContainsAny(v.title, MIX_TITLE_KEYWORDS)) {
    if (isNonMusic(v.title)) return false;
  }
  return true;
}

async function buildMixesPool(genre?: string): Promise<CardData[]> {
  const poolKey = genre ? `mixes-${genre.toLowerCase()}` : "mixes";
  const memoryCacheKey = `pool-${poolKey}`;

  const { raw } = await getRawVideos("mixes", genre);
  const pool = smartSample(raw, isValidMixVideo);

  if (pool.length > 0) {
    cacheSet(memoryCacheKey, pool, POOL_MAX_AGE);
    await savePoolToSupabase(poolKey, pool);
  }

  return pool;
}

/** Background rebuild for mixes pool (called from after()) */
export async function rebuildMixesPool(genre?: string): Promise<void> {
  const lockKey = genre ? `mixes-${genre.toLowerCase()}` : "mixes";
  if (rebuildingPools.has(lockKey)) return;
  rebuildingPools.add(lockKey);
  try {
    await buildMixesPool(genre);
  } finally {
    rebuildingPools.delete(lockKey);
  }
}

export async function discoverMixes(
  limit = 20,
  offset = 0,
  tag: Tag | Tag[] = "all",
  genre?: string,
  rotate?: number
): Promise<PoolResult> {
  const poolKey = genre ? `mixes-${genre.toLowerCase()}` : "mixes";
  const memoryCacheKey = `pool-${poolKey}`;
  let needsRebuild = false;

  let pool = cacheGet<CardData[]>(memoryCacheKey);

  if (!pool || pool.length === 0) {
    const sbCached = await getPoolFromSupabase(poolKey);
    if (sbCached && sbCached.data.length > 0) {
      pool = sbCached.data;
      cacheSet(memoryCacheKey, pool, POOL_MAX_AGE);
      needsRebuild = sbCached.isStale;
    }
  }

  if (!pool || pool.length === 0) {
    pool = await buildMixesPool(genre);
  }

  const filtered = applyTagFilter(pool, tag);
  let feed = filtered;
  if (rotate && feed.length > 1) {
    const r = ((rotate % feed.length) + feed.length) % feed.length;
    feed = [...feed.slice(r), ...feed.slice(0, r)];
  }
  return {
    cards: feed.slice(offset, offset + limit),
    totalFiltered: feed.length,
    needsRebuild,
  };
}

/* ── Samples ─────────────────────────────────────────────────────────── */

const STRICT_SAMPLE_LABELS = [
  "Samples", "Experimental", "Ambient", "Funk", "Disco", "Jazz",
  "Hip Hop", "Dub", "World", "Pop", "Downtempo", "Industrial", "Reggae",
];

/** Full YouTube rebuild for samples pool */
function isValidSampleVideo(v: YouTubeVideo): boolean {
  if (v.title === "Private video" || v.title === "Deleted video") return false;
  if (!v.duration || v.duration > 2700 || v.duration < 30) return false;
  const lower = v.title.toLowerCase();
  if (lower.includes("#shorts") || lower.includes("#short")) return false;
  if (lower.includes("shorts") && lower.length < 80) return false;
  if (v.height > v.width) return false;
  if (isNonMusic(v.title)) return false;
  return true;
}

async function buildSamplesPool(genre?: string): Promise<CardData[]> {
  const poolKey = genre ? `samples-${genre.toLowerCase()}` : "samples";
  const memoryCacheKey = `pool-${poolKey}`;

  const { raw } = await getRawVideos("samples", genre);
  const pool = smartSample(raw, isValidSampleVideo);

  if (pool.length > 0) {
    cacheSet(memoryCacheKey, pool, POOL_MAX_AGE);
    await savePoolToSupabase(poolKey, pool);
  }

  return pool;
}

/** Background rebuild for samples pool (called from after()) */
export async function rebuildSamplesPool(genre?: string): Promise<void> {
  const lockKey = genre ? `samples-${genre.toLowerCase()}` : "samples";
  if (rebuildingPools.has(lockKey)) return;
  rebuildingPools.add(lockKey);
  try {
    await buildSamplesPool(genre);
  } finally {
    rebuildingPools.delete(lockKey);
  }
}

export async function discoverSamples(
  limit = 30,
  offset = 0,
  tag: Tag | Tag[] = "all",
  genre?: string,
  rotate?: number
): Promise<PoolResult> {
  const poolKey = genre ? `samples-${genre.toLowerCase()}` : "samples";
  const memoryCacheKey = `pool-${poolKey}`;
  let needsRebuild = false;

  let pool = cacheGet<CardData[]>(memoryCacheKey);

  if (!pool || pool.length === 0) {
    const sbCached = await getPoolFromSupabase(poolKey);
    if (sbCached && sbCached.data.length > 0) {
      pool = sbCached.data;
      cacheSet(memoryCacheKey, pool, POOL_MAX_AGE);
      needsRebuild = sbCached.isStale;
    }
  }

  if (!pool || pool.length === 0) {
    pool = await buildSamplesPool(genre);
  }

  const filtered = applyTagFilter(pool, tag);
  let feed = filtered;
  if (rotate && feed.length > 1) {
    const r = ((rotate % feed.length) + feed.length) % feed.length;
    feed = [...feed.slice(r), ...feed.slice(0, r)];
  }
  return {
    cards: feed.slice(offset, offset + limit),
    totalFiltered: feed.length,
    needsRebuild,
  };
}
