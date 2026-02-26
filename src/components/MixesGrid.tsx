"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import MusicCard from "./MusicCard";
import type { TagFilter } from "./Sidebar";
import type { CardData } from "@/lib/types";

interface MixesGridProps {
  savedIds: Set<string>;
  likedIds: Set<string>;
  playingId: string | null;
  isPlaying: boolean;
  onPlay: (id: string) => void;
  onToggleSave: (id: string) => void;
  onToggleLike: (id: string) => void;
  activeTagFilter?: TagFilter;
  onCardsLoaded?: (cards: CardData[]) => void;
  isAuthenticated?: boolean;
}

export default function MixesGrid({
  savedIds,
  likedIds,
  playingId,
  isPlaying,
  onPlay,
  onToggleSave,
  onToggleLike,
  activeTagFilter = "all",
  onCardsLoaded,
  isAuthenticated = true,
}: MixesGridProps) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef(0);
  const hasMore = useRef(true);

  const fetchMixes = useCallback(
    async (append = false, sort?: string) => {
      if (append && !hasMore.current) return;
      if (append) setLoadingMore(true);
      else { setLoading(true); hasMore.current = true; }

      try {
        const limit = 20;
        const offset = append ? pageRef.current * limit : 0;
        let url = `/api/mixes?limit=${limit}&offset=${offset}`;
        if (sort) url += `&sort=${sort}`;
        const res = await fetch(url);
        const data = await res.json();
        const newCards: CardData[] = data.cards || [];
        onCardsLoaded?.(newCards);

        if (newCards.length < limit) hasMore.current = false;

        if (append) {
          setCards((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const unique = newCards.filter((c) => !existingIds.has(c.id));
            return [...prev, ...unique];
          });
        } else {
          setCards(newCards);
          pageRef.current = 0;
        }
        pageRef.current += 1;
      } catch (err) {
        console.error("Failed to fetch mixes:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const prevTagRef = useRef(activeTagFilter);
  useEffect(() => {
    const wasTop = prevTagRef.current === "top";
    const isTop = activeTagFilter === "top";
    prevTagRef.current = activeTagFilter;
    if (wasTop !== isTop) {
      fetchMixes(false, isTop ? "top" : undefined);
    }
  }, [activeTagFilter, fetchMixes]);

  useEffect(() => {
    fetchMixes(false, activeTagFilter === "top" ? "top" : undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loading &&
          !loadingMore &&
          cards.length > 0
        ) {
          fetchMixes(true, activeTagFilter === "top" ? "top" : undefined);
        }
      },
      { rootMargin: "400px" }
    );

    const el = observerRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [activeTagFilter, loading, loadingMore, cards.length, fetchMixes]);

  const shareCard = async (card: CardData) => {
    const url = card.youtubeUrl || "";
    if (navigator.share) {
      await navigator.share({
        title: `${card.name} — ${card.artist}`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const top10Ids = useMemo(() => {
    const sorted = [...cards]
      .filter((c) => c.viewCount != null && c.viewCount > 0)
      .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
    return new Set(sorted.slice(0, 10).map((c) => c.id));
  }, [cards]);

  const displayCards = useMemo(() => {
    if (activeTagFilter === "all") return cards;
    if (activeTagFilter === "top") return cards; // server already sorted by viewCount
    return cards.filter((card) => {
      if (activeTagFilter === "hot") return card.viewCount != null && card.viewCount >= 100_000;
      if (activeTagFilter === "rare") return card.viewCount != null && card.viewCount < 5_000;
      if (activeTagFilter === "new") return card.publishedAt && (Date.now() - new Date(card.publishedAt).getTime()) / 86400000 <= 30;
      return true;
    });
  }, [cards, activeTagFilter, top10Ids]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-[11px] p-2 sm:p-[11px]">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square skeleton-shimmer rounded-md"
          />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <svg className="w-12 h-12 text-[var(--text-muted)] mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <line x1="4" y1="10" x2="4" y2="14" />
          <line x1="8" y1="6" x2="8" y2="18" />
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="16" y1="8" x2="16" y2="16" />
          <line x1="20" y1="7" x2="20" y2="17" />
        </svg>
        <p className="font-mono text-sm text-[var(--text-muted)] uppercase">No mixes found</p>
        <p className="font-mono text-[11px] text-[var(--text-muted)] mt-1">Approve more channels with DJ sets via /curator</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-[11px] p-2 sm:p-[11px]">
        {displayCards.map((card) => (
          <MusicCard
            key={card.id}
            card={card}
            saved={likedIds.has(card.id)}
            isPlaying={playingId === card.id && isPlaying}
            isTop10={top10Ids.has(card.id)}
            onPlay={() => onPlay(card.id)}
            onSave={() => onToggleLike(card.id)}
            onShare={() => shareCard(card)}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </div>

      <div ref={observerRef} className="flex justify-center py-6">
        {loadingMore && (
          <div className="vinyl-spinner" />
        )}
      </div>
    </>
  );
}
