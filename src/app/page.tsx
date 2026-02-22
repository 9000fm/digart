"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import DiscoverGrid from "@/components/DiscoverGrid";
import MixesGrid from "@/components/MixesGrid";
import SamplesGrid from "@/components/SamplesGrid";
import NowPlayingBanner from "@/components/NowPlayingBanner";
import Sidebar from "@/components/Sidebar";
import type { ViewType } from "@/components/Sidebar";
import type { CardData } from "@/lib/types";
import { createPlayer, YT_STATE } from "@/lib/youtube-player";

interface YTPlayer {
  loadVideoById: (opts: { videoId: string; startSeconds?: number }) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>("home");
  const [activeGenre, setActiveGenre] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [nowPlayingCard, setNowPlayingCard] = useState<CardData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playerClosing, setPlayerClosing] = useState(false);
  const cardRegistry = useRef<Map<string, CardData>>(new Map());

  // YouTube IFrame API player
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytPlayerReady = useRef(false);
  const ytProgressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const registerCards = useCallback((cards: CardData[]) => {
    for (const c of cards) {
      cardRegistry.current.set(c.id, c);
    }
  }, []);

  // Initialize YouTube player once
  useEffect(() => {
    const initYT = async () => {
      try {
        const player = await createPlayer(
          "yt-player-target",
          (state: number) => {
            if (state === YT_STATE.ENDED) {
              setIsPlaying(false);
              setPlayingId(null);
              setAudioProgress(0);
              stopYtProgress();
            }
          }
        );
        ytPlayerRef.current = player;
        ytPlayerReady.current = true;
      } catch (e) {
        console.error("YT player init failed:", e);
      }
    };
    initYT();

    return () => {
      stopYtProgress();
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch { /* ignore */ }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopYtProgress = useCallback(() => {
    if (ytProgressInterval.current) {
      clearInterval(ytProgressInterval.current);
      ytProgressInterval.current = null;
    }
  }, []);

  const startYtProgress = useCallback(() => {
    stopYtProgress();
    ytProgressInterval.current = setInterval(() => {
      if (ytPlayerRef.current && ytPlayerReady.current) {
        try {
          const t = ytPlayerRef.current.getCurrentTime();
          const d = ytPlayerRef.current.getDuration();
          setAudioProgress(t);
          if (d > 0) setAudioDuration(d);
        } catch { /* player not ready */ }
      }
    }, 250);
  }, [stopYtProgress]);

  const handlePlay = useCallback((id: string) => {
    const card = cardRegistry.current.get(id);
    if (!card) return;

    setPlayingId(id);
    setIsPlaying(true);
    setAudioProgress(0);
    setAudioDuration(card.duration || 0);
    setNowPlayingCard(card);

    if (card.videoId && ytPlayerRef.current && ytPlayerReady.current) {
      ytPlayerRef.current.loadVideoById({ videoId: card.videoId });
      startYtProgress();
    }
  }, [startYtProgress]);

  const toggleSave = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleLike = useCallback((id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.pauseVideo();
        stopYtProgress();
      }
      setPlayingId(null);
      setIsPlaying(false);
    } else if (nowPlayingCard) {
      setPlayingId(nowPlayingCard.id);
      setIsPlaying(true);
      if (ytPlayerRef.current) {
        ytPlayerRef.current.playVideo();
        startYtProgress();
      }
    }
  }, [isPlaying, nowPlayingCard, startYtProgress, stopYtProgress]);

  const handleClosePlayer = useCallback(() => {
    setPlayerClosing(true);
    setTimeout(() => {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.pauseVideo(); } catch { /* ignore */ }
      }
      stopYtProgress();
      setPlayingId(null);
      setIsPlaying(false);
      setNowPlayingCard(null);
      setAudioProgress(0);
      setAudioDuration(0);
      setPlayerClosing(false);
    }, 300);
  }, [stopYtProgress]);

  const handleViewChange = useCallback((view: ViewType) => {
    setActiveView(view);
  }, []);

  const handleLocateCard = useCallback(() => {
    if (!nowPlayingCard) return;
    const el = document.querySelector(`[data-card-id="${nowPlayingCard.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-[var(--accent)]");
      setTimeout(() => el.classList.remove("ring-2", "ring-[var(--accent)]"), 1500);
    }
  }, [nowPlayingCard]);

  const handleSeek = useCallback((seconds: number) => {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(seconds, true);
      setAudioProgress(seconds);
    }
  }, []);

  const hasPlayer = !!nowPlayingCard && !playerClosing;

  return (
    <main
      className="layout-shift min-h-screen bg-[var(--bg)] lg:ml-[var(--sidebar-width)]"
      data-player={hasPlayer ? "true" : "false"}
    >
      {/* Hidden div for YouTube IFrame API player */}
      <div id="yt-player-target" className="fixed w-px h-px opacity-0 pointer-events-none" style={{ top: 0, left: 0 }} />

      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        activeGenre={activeGenre}
        onGenreChange={setActiveGenre}
      />

      {activeView === "home" && (
        <DiscoverGrid
          savedIds={savedIds}
          likedIds={likedIds}
          playingId={playingId}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onToggleSave={toggleSave}
          onToggleLike={toggleLike}
          activeGenre={activeGenre}
          onCardsLoaded={registerCards}
        />
      )}

      {activeView === "samples" && (
        <SamplesGrid
          savedIds={savedIds}
          likedIds={likedIds}
          playingId={playingId}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onToggleSave={toggleSave}
          onToggleLike={toggleLike}
          onCardsLoaded={registerCards}
        />
      )}

      {activeView === "mixes" && (
        <MixesGrid
          savedIds={savedIds}
          likedIds={likedIds}
          playingId={playingId}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onToggleSave={toggleSave}
          onToggleLike={toggleLike}
          onCardsLoaded={registerCards}
        />
      )}

      {activeView === "saved" && (
        <DiscoverGrid
          showSavedOnly
          savedIds={savedIds}
          likedIds={likedIds}
          playingId={playingId}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onToggleSave={toggleSave}
          onToggleLike={toggleLike}
          activeGenre={activeGenre}
          onCardsLoaded={registerCards}
        />
      )}

      {nowPlayingCard && (
        <NowPlayingBanner
          card={nowPlayingCard}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onClose={handleClosePlayer}
          onLocate={handleLocateCard}
          audioProgress={audioProgress}
          audioDuration={audioDuration}
          onSeek={handleSeek}
          closing={playerClosing}
        />
      )}
    </main>
  );
}
