"use client";

import { useEffect, useState, useCallback } from "react";
import MusicCard, { CardData } from "./MusicCard";

const GENRE_PRESETS = [
  { label: "All Vibes", genres: ["pop", "electronic", "hip-hop"] },
  { label: "Electronic", genres: ["electronic", "house", "techno"] },
  { label: "Hip Hop", genres: ["hip-hop", "r-n-b"] },
  { label: "Rock", genres: ["rock", "indie", "alternative"] },
  { label: "Latin", genres: ["latin", "reggaeton"] },
  { label: "Chill", genres: ["ambient", "chill", "acoustic"] },
  { label: "Dance", genres: ["dance", "edm", "house"] },
];

export default function DiscoverGrid() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState(0);

  const fetchCards = useCallback(async (genreIndex: number) => {
    setLoading(true);
    try {
      const genres = GENRE_PRESETS[genreIndex].genres.join(",");
      const res = await fetch(`/api/discover?genres=${genres}&limit=30`);
      const data = await res.json();
      setCards(data.cards || []);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards(activeGenre);
  }, [activeGenre, fetchCards]);

  return (
    <div className="space-y-6">
      {/* Genre filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {GENRE_PRESETS.map((preset, i) => (
          <button
            key={preset.label}
            onClick={() => setActiveGenre(i)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              i === activeGenre
                ? "bg-emerald-500 text-black"
                : "bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700/80"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => fetchCards(activeGenre)}
          className="px-4 py-2 rounded-full text-sm font-medium bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition-all duration-200"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-zinc-900/80 border border-zinc-800/50 overflow-hidden break-inside-avoid animate-pulse"
            >
              <div className="aspect-square bg-zinc-800" />
              <div className="p-3.5 space-y-2">
                <div className="h-4 bg-zinc-800 rounded w-3/4" />
                <div className="h-3 bg-zinc-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
          {cards.map((card) => (
            <div key={card.id} className="break-inside-avoid">
              <MusicCard card={card} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
