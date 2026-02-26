"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence } from "framer-motion";
import DiscoverGrid from "@/components/DiscoverGrid";
import MixesGrid from "@/components/MixesGrid";
import SamplesGrid from "@/components/SamplesGrid";
import NowPlayingBanner from "@/components/NowPlayingBanner";
import Sidebar from "@/components/Sidebar";
import type { ViewType } from "@/components/Sidebar";
import type { CardData } from "@/lib/types";

/* ── YouTube IFrame API types ── */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getDuration(): number;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
  loadVideoById(videoId: string, startSeconds?: number): void;
  cueVideoById(videoId: string, startSeconds?: number): void;
}

interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        config: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: YTPlayerEvent) => void;
            onStateChange?: (event: YTPlayerEvent) => void;
            onError?: (event: YTPlayerEvent) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function Home() {
  const { data: session } = useSession();
  const isAuthenticated = !!session;
  const [activeView, setActiveView] = useState<ViewType>("home");
  const [activeGenre, setActiveGenre] = useState(0);
  const [activeTagFilter, setActiveTagFilter] = useState<"all" | "top" | "hot" | "rare" | "new">("all");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [nowPlayingCard, setNowPlayingCard] = useState<CardData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [historyLength, setHistoryLength] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("digeart-volume");
      return saved ? parseInt(saved, 10) : 80;
    }
    return 80;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [skippingUnavailable, setSkippingUnavailable] = useState(false);

  const skippingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cardRegistry = useRef<Map<string, CardData>>(new Map());
  const cardViewMap = useRef<Map<string, ViewType>>(new Map());
  const playOriginView = useRef<ViewType | null>(null);
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;
  const playHistory = useRef<CardData[]>([]);
  const playForwardStack = useRef<CardData[]>([]);
  // YT IFrame API refs
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytApiReady = useRef(false);
  const ytProgressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const ytPendingVideoId = useRef<string | null>(null);



  // ── Load YouTube IFrame API script ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT && window.YT.Player) {
      ytApiReady.current = true;
      return;
    }
    // Set callback before loading script
    window.onYouTubeIframeAPIReady = () => {
      ytApiReady.current = true;
      // If there's a pending video, play it now
      if (ytPendingVideoId.current) {
        createYTPlayer(ytPendingVideoId.current);
        ytPendingVideoId.current = null;
      }
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }, []);

  // ── YT progress poller ──
  const startYTProgressPoller = useCallback(() => {
    if (ytProgressInterval.current) clearInterval(ytProgressInterval.current);
    ytProgressInterval.current = setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p) return;
      try {
        const current = p.getCurrentTime();
        const duration = p.getDuration();
        setAudioProgress(current);
        if (duration > 0) setAudioDuration(duration);
      } catch {
        // player may not be ready
      }
    }, 250);
  }, []);

  const stopYTProgressPoller = useCallback(() => {
    if (ytProgressInterval.current) {
      clearInterval(ytProgressInterval.current);
      ytProgressInterval.current = null;
    }
  }, []);

  // ── Auto-advance refs (to avoid stale closures in YT callbacks) ──
  const autoPlayEnabledRef = useRef(autoPlayEnabled);
  autoPlayEnabledRef.current = autoPlayEnabled;
  const nowPlayingCardRef = useRef(nowPlayingCard);
  nowPlayingCardRef.current = nowPlayingCard;

  // ── Create / load YT player ──
  const handleYTStateChange = useRef<((event: YTPlayerEvent) => void) | null>(null);

  const createYTPlayer = useCallback((videoId: string) => {
    if (!ytApiReady.current || !ytContainerRef.current) return;

    // Destroy existing player
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch { /* ignore */ }
      ytPlayerRef.current = null;
    }

    // Create fresh div for player
    const div = document.createElement("div");
    div.id = "yt-player-target";
    ytContainerRef.current.innerHTML = "";
    ytContainerRef.current.appendChild(div);

    ytPlayerRef.current = new window.YT.Player("yt-player-target", {
      height: "1",
      width: "1",
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
      },
      events: {
        onReady: (event: YTPlayerEvent) => {
          // iOS Safari: must start muted for autoplay policy
          event.target.mute();
          event.target.playVideo();
          setTimeout(() => {
            event.target.setVolume(volume);
            if (!isMuted) event.target.unMute();
          }, 300);
          startYTProgressPoller();
        },
        onStateChange: (event: YTPlayerEvent) => {
          handleYTStateChange.current?.(event);
        },
        onError: () => {
          // Show unavailable feedback, then auto-advance
          setSkippingUnavailable(true);
          if (skippingTimerRef.current) clearTimeout(skippingTimerRef.current);
          skippingTimerRef.current = setTimeout(() => {
            setSkippingUnavailable(false);
            handleNextTrackRef.current?.();
          }, 1500);
        },
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startYTProgressPoller]);

  // Keep handleYTStateChange in sync
  useEffect(() => {
    handleYTStateChange.current = (event: YTPlayerEvent) => {
      if (event.data === 0) {
        // ENDED
        stopYTProgressPoller();
        handleNextTrackRef.current?.();
      } else if (event.data === 1) {
        // PLAYING
        setIsPlaying(true);
        startYTProgressPoller();
        // Get real duration
        try {
          const dur = event.target.getDuration();
          if (dur > 0) setAudioDuration(dur);
        } catch { /* ignore */ }
      } else if (event.data === 2) {
        // PAUSED
        // Don't set isPlaying to false here — we control it ourselves
      }
    };
  }, [stopYTProgressPoller, startYTProgressPoller]);

  const registerCards = useCallback((cards: CardData[], view: ViewType) => {
    for (const c of cards) {
      cardRegistry.current.set(c.id, c);
      cardViewMap.current.set(c.id, view);
    }
  }, []);

  const registerHomeCards = useCallback(
    (cards: CardData[]) => registerCards(cards, "home"),
    [registerCards]
  );
  const registerSamplesCards = useCallback(
    (cards: CardData[]) => registerCards(cards, "samples"),
    [registerCards]
  );
  const registerMixesCards = useCallback(
    (cards: CardData[]) => registerCards(cards, "mixes"),
    [registerCards]
  );
  const registerSavedCards = useCallback(
    (cards: CardData[]) => registerCards(cards, "saved"),
    [registerCards]
  );


  // Internal play handler
  const handlePlayInternal = useCallback((card: CardData, skipHistory = false) => {
    if (!skipHistory) {
      setNowPlayingCard((prev) => {
        if (prev) {
          playHistory.current.push(prev);
          setHistoryLength(playHistory.current.length);
        }
        return prev;
      });
      // Clear forward stack on manual track selection
      playForwardStack.current = [];
    }
    setPlayingId(card.id);
    setIsPlaying(true);
    setAudioProgress(0);
    setAudioDuration(card.duration || 0);
    setNowPlayingCard(card);

    // Update origin view so locate points to the card's actual view
    if (skipHistory) {
      playOriginView.current = cardViewMap.current.get(card.id) || null;
    }

    if (card.source === "youtube" && card.videoId) {
      if (ytApiReady.current) {
        createYTPlayer(card.videoId);
      } else {
        ytPendingVideoId.current = card.videoId;
      }
    } else {
      // No playable source — show unavailable feedback then auto-advance
      stopYTProgressPoller();
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.stopVideo(); } catch { /* ignore */ }
      }
      setSkippingUnavailable(true);
      if (skippingTimerRef.current) clearTimeout(skippingTimerRef.current);
      skippingTimerRef.current = setTimeout(() => {
        setSkippingUnavailable(false);
        handleNextTrackRef.current?.();
      }, 1500);
    }
  }, [createYTPlayer, stopYTProgressPoller]);

  // Play random track
  const playRandomTrack = useCallback(() => {
    const entries = Array.from(cardRegistry.current.entries());
    const candidates = entries.filter(
      ([id]) => id !== nowPlayingCardRef.current?.id
    );
    if (candidates.length === 0) return;
    const [, card] = candidates[Math.floor(Math.random() * candidates.length)];
    handlePlayInternal(card);
  }, [handlePlayInternal]);

  // Play next sequential
  const playNextSequential = useCallback(() => {
    const current = nowPlayingCardRef.current;
    if (!current) return;
    const currentView = cardViewMap.current.get(current.id);
    if (!currentView) {
      playRandomTrack();
      return;
    }
    const viewEntries = Array.from(cardRegistry.current.entries()).filter(
      ([id]) => cardViewMap.current.get(id) === currentView
    );
    const currentIndex = viewEntries.findIndex(([id]) => id === current.id);
    if (currentIndex === -1 || viewEntries.length === 0) {
      playRandomTrack();
      return;
    }
    const nextIndex = (currentIndex + 1) % viewEntries.length;
    const [, nextCard] = viewEntries[nextIndex];
    handlePlayInternal(nextCard);
  }, [handlePlayInternal, playRandomTrack]);

  // Prev track (with forward stack)
  const handlePrevTrack = useCallback(() => {
    const prev = playHistory.current.pop();
    setHistoryLength(playHistory.current.length);
    if (!prev) return;
    // Push current to forward stack before going back
    if (nowPlayingCardRef.current) {
      playForwardStack.current.push(nowPlayingCardRef.current);
    }
    handlePlayInternal(prev, true);
  }, [handlePlayInternal]);

  // Next track (with forward stack support)
  const handleNextTrack = useCallback(() => {
    // If forward stack has entries (came back), use those first
    if (playForwardStack.current.length > 0) {
      const next = playForwardStack.current.pop()!;
      // Push current to history
      if (nowPlayingCardRef.current) {
        playHistory.current.push(nowPlayingCardRef.current);
        setHistoryLength(playHistory.current.length);
      }
      handlePlayInternal(next, true);
      return;
    }
    if (autoPlayEnabledRef.current) {
      playRandomTrack();
    } else {
      playNextSequential();
    }
  }, [playRandomTrack, playNextSequential, handlePlayInternal]);

  // Stable ref for handleNextTrack (used in YT callbacks)
  const handleNextTrackRef = useRef(handleNextTrack);
  handleNextTrackRef.current = handleNextTrack;

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.pauseVideo(); } catch { /* ignore */ }
      }
      stopYTProgressPoller();
      setPlayingId(null);
      setIsPlaying(false);
    } else if (nowPlayingCard) {
      setPlayingId(nowPlayingCard.id);
      setIsPlaying(true);
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.playVideo();
          startYTProgressPoller();
        } catch { /* ignore */ }
      }
    }
  }, [isPlaying, nowPlayingCard, stopYTProgressPoller, startYTProgressPoller]);

  const handlePlay = useCallback((id: string) => {
    // If clicking the currently-playing card, toggle pause
    if (id === nowPlayingCardRef.current?.id) {
      handleTogglePlay();
      return;
    }
    const card = cardRegistry.current.get(id);
    if (!card) return;
    // Manual selection clears forward stack
    playForwardStack.current = [];
    // Record which view the user played from (for locate)
    playOriginView.current = activeViewRef.current;
    handlePlayInternal(card);
  }, [handlePlayInternal, handleTogglePlay]);

  const toggleLike = useCallback((id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClosePlayer = useCallback(() => {
    stopYTProgressPoller();
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch { /* ignore */ }
      ytPlayerRef.current = null;
    }
    setPlayingId(null);
    setIsPlaying(false);
    setNowPlayingCard(null);
    setAudioProgress(0);
    setAudioDuration(0);
  }, [stopYTProgressPoller]);

  const handleClosePlayerRef = useRef(handleClosePlayer);
  handleClosePlayerRef.current = handleClosePlayer;

  const handleViewChange = useCallback((view: ViewType) => {
    setActiveView(view);
  }, []);

  // Locate card — with 3s poll (30 × 100ms) + failure feedback
  const handleLocateCard = useCallback(() => {
    if (!nowPlayingCard) return;

    const tryScroll = () => {
      const els = document.querySelectorAll(`[data-card-id="${nowPlayingCard.id}"]`);
      const el = Array.from(els).find(e => (e as HTMLElement).offsetParent !== null);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const observer = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) {
            observer.disconnect();
            el.classList.add("locate-highlight");
            setTimeout(() => el.classList.remove("locate-highlight"), 1800);
          }
        }, { threshold: 0.8 });
        observer.observe(el);
        setTimeout(() => observer.disconnect(), 3000);
        return true;
      }
      return false;
    };

    // Shake the locate button to signal failure
    const pulseLocateBtn = () => {
      const btn = document.querySelector(".locate-btn");
      if (btn) {
        btn.classList.add("locate-pulse");
        setTimeout(() => btn.classList.remove("locate-pulse"), 400);
      }
    };

    if (tryScroll()) return;

    // Use the view where the card was played from, falling back to cardViewMap
    const originView = playOriginView.current || cardViewMap.current.get(nowPlayingCard.id);
    if (originView && originView !== activeView) {
      setActiveView(originView);
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        if (tryScroll()) {
          clearInterval(poll);
        } else if (attempts > 30) {
          clearInterval(poll);
          // Card not found after 3s — give visual feedback
          pulseLocateBtn();
        }
      }, 100);
    } else {
      // Same view but card not in DOM — give feedback
      pulseLocateBtn();
    }
  }, [nowPlayingCard, activeView]);

  // Seek — uses YT.Player.seekTo() directly
  const handleSeek = useCallback((seconds: number) => {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(seconds, true);
      setAudioProgress(seconds);
    }
  }, []);

  // Volume control
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem("digeart-volume", String(newVolume));
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.setVolume(newVolume); } catch { /* ignore */ }
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
      if (ytPlayerRef.current) try { ytPlayerRef.current.unMute(); } catch { /* ignore */ }
    }
    if (newVolume === 0 && !isMuted) {
      setIsMuted(true);
      if (ytPlayerRef.current) try { ytPlayerRef.current.mute(); } catch { /* ignore */ }
    }
  }, [isMuted]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (ytPlayerRef.current) {
        try {
          if (next) ytPlayerRef.current.mute();
          else ytPlayerRef.current.unMute();
        } catch { /* ignore */ }
      }
      // Unmuting from 0 → restore to 50%
      if (!next && volume === 0) {
        const restored = 50;
        setVolume(restored);
        localStorage.setItem("digeart-volume", String(restored));
        if (ytPlayerRef.current) try { ytPlayerRef.current.setVolume(restored); } catch { /* ignore */ }
      }
      return next;
    });
  }, [volume]);

  const handleToggleAutoPlay = useCallback(() => {
    setAutoPlayEnabled((prev) => !prev);
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (nowPlayingCard) handleTogglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (nowPlayingCard) handleNextTrack();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (nowPlayingCard && historyLength > 0) handlePrevTrack();
          break;
        case "s":
        case "S":
          if (nowPlayingCard) handleToggleAutoPlay();
          break;
        case "m":
        case "M":
          if (nowPlayingCard) handleToggleMute();
          break;
        case "Escape":
          if (nowPlayingCard) handleClosePlayerRef.current();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nowPlayingCard, handleTogglePlay, handleNextTrack, handlePrevTrack, handleToggleAutoPlay, historyLength, handleToggleMute]);

  const hasPlayer = !!nowPlayingCard;

  return (
    <main
      className="layout-shift min-h-screen bg-[var(--bg)] lg:ml-[var(--sidebar-width)]"
      data-player={hasPlayer ? "true" : "false"}
    >
      {/* Hidden YT Player container */}
      <div
        ref={ytContainerRef}
        className="fixed w-px h-px opacity-0 pointer-events-none"
        style={{ top: 0, left: 0 }}
      />

      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        activeGenre={activeGenre}
        onGenreChange={setActiveGenre}
        activeTagFilter={activeTagFilter}
        onTagFilterChange={setActiveTagFilter}
      />

      <div style={{ display: activeView === "home" ? undefined : "none" }}>
        <DiscoverGrid
          savedIds={likedIds}
          likedIds={likedIds}
          playingId={playingId}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onToggleSave={toggleLike}
          onToggleLike={toggleLike}
          activeGenre={activeGenre}
          activeTagFilter={activeTagFilter}
          onCardsLoaded={registerHomeCards}
          isAuthenticated={isAuthenticated}
        />
      </div>

      <div style={{ display: activeView === "samples" ? undefined : "none" }}>
        <SamplesGrid
          savedIds={likedIds}
          likedIds={likedIds}
          playingId={playingId}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onToggleSave={toggleLike}
          onToggleLike={toggleLike}
          activeTagFilter={activeTagFilter}
          onCardsLoaded={registerSamplesCards}
          isAuthenticated={isAuthenticated}
        />
      </div>

      <div style={{ display: activeView === "mixes" ? undefined : "none" }}>
        <MixesGrid
          savedIds={likedIds}
          likedIds={likedIds}
          playingId={playingId}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onToggleSave={toggleLike}
          onToggleLike={toggleLike}
          activeTagFilter={activeTagFilter}
          onCardsLoaded={registerMixesCards}
          isAuthenticated={isAuthenticated}
        />
      </div>

      <div style={{ display: activeView === "saved" ? undefined : "none" }}>
        <DiscoverGrid
          showSavedOnly
          savedIds={likedIds}
          likedIds={likedIds}
          playingId={playingId}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onToggleSave={toggleLike}
          onToggleLike={toggleLike}
          activeGenre={activeGenre}
          activeTagFilter={activeTagFilter}
          onCardsLoaded={registerSavedCards}
          isAuthenticated={isAuthenticated}
        />
      </div>

      <AnimatePresence>
        {nowPlayingCard && (
          <NowPlayingBanner
            key="player"
            card={nowPlayingCard}
            isPlaying={isPlaying}
            isUnavailable={skippingUnavailable}
            onTogglePlay={handleTogglePlay}
            onClose={handleClosePlayer}
            onLocate={handleLocateCard}
            onPrevTrack={handlePrevTrack}
            onNextTrack={handleNextTrack}
            hasPrev={historyLength > 0}
            audioProgress={audioProgress}
            audioDuration={audioDuration}
            onSeek={handleSeek}
            autoPlay={autoPlayEnabled}
            onToggleAutoPlay={handleToggleAutoPlay}
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            isLiked={likedIds.has(nowPlayingCard.id)}
            onToggleLike={() => toggleLike(nowPlayingCard.id)}
            isAuthenticated={isAuthenticated}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
