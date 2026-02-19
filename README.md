# 🎵 Superself — Music Discovery

Pinterest-style music discovery powered by Spotify. Click to preview tracks, explore by genre, see BPM/energy/key data.

## Quick Start

```bash
cd projects/superself-music
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment

Create `.env.local` (already included):

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

Uses Spotify's **Client Credentials** flow (no user login needed for recommendations).

## Architecture

- **Next.js 15** + TypeScript + Tailwind CSS
- `/api/discover` — Server-side Spotify API (recommendations + audio features)
- `DiscoverGrid` — Pinterest masonry layout with genre filters
- `MusicCard` — Album art, metadata, BPM/energy bars, 30s preview player

## MVP Scope (Discover page only)

- [x] Pinterest-style responsive grid
- [x] Genre filter tabs
- [x] Album art + track info
- [x] BPM, key, energy, danceability, valence tags
- [x] Click-to-preview (30s Spotify preview)
- [x] Dark theme

## Future

- My DNA (listening stats)
- DJ Prep (BPM/key matching)
- User auth (Spotify OAuth)
- Save/like tracks
