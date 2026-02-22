# digeart

YouTube-powered music discovery. Curate channels, explore by genre, watch DJ sets and discover samples.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment

Create `.env.local`:

```
YOUTUBE_API_KEY=your_key_here
```

YouTube uses a standard Data API v3 key.

## Architecture

```
src/
  app/
    page.tsx              # Main layout, YT IFrame API player, view switching
    globals.css           # CSS variables, theme, animations
    api/
      discover/route.ts   # YouTube channel discovery with genre filtering
      mixes/route.ts      # Long-form DJ sets (>40min)
      samples/route.ts    # Short-form samples (<15min, niche channels)
      curator/route.ts    # Channel review (approve/reject/undo)
      enrich/route.ts     # MusicBrainz genre enrichment
    curator/page.tsx      # Channel curation UI
  components/
    Sidebar.tsx           # Nav, genre filters, banner, search, theme toggle
    DiscoverGrid.tsx      # Infinite-scroll card grid
    MixesGrid.tsx         # DJ sets grid
    SamplesGrid.tsx       # Samples grid
    MusicCard.tsx         # Thumbnail, metadata, play/save controls
    NowPlayingBanner.tsx  # Persistent player bar with progress + seek
  lib/
    youtube.ts            # YouTube Data API helpers
    youtube-player.ts     # YouTube IFrame Player API wrapper
    musicbrainz.ts        # MusicBrainz genre lookup (free, no auth)
    types.ts              # Shared CardData type
    cache.ts              # In-memory cache
  data/
    music-channels.json   # All imported YouTube channels
    approved-channels.json # Curated channels with labels
    genre-cache.json      # MusicBrainz genre data (auto-populated)
```

## Features

- 131 curated YouTube music channels
- Genre metadata from MusicBrainz + manual curator labels
- YouTube IFrame Player API (instant seek, smooth scrubbing)
- Persistent playback across view switches
- Now-playing banner with album art, EQ visualizer, seek bar
- Infinite scroll (30 cards/page)
- Samples grid (short-form from niche channels)
- Mixes grid (long-form DJ sets)
- Like/Save toggles
- Dark/Light theme
- Curator page with keyboard shortcuts (A/R/U/S/B) + undo
- Chrome bookmarks import for channel discovery

## Stack

- Next.js 16 + TypeScript
- Tailwind CSS v4
- YouTube Data API v3
- YouTube IFrame Player API
- MusicBrainz API (genre enrichment)
