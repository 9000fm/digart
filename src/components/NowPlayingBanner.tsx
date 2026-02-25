"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import type { CardData } from "@/lib/types";

interface NowPlayingBannerProps {
  card: CardData;
  isPlaying: boolean;
  isUnavailable?: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
  onLocate?: () => void;
  onPrevTrack?: () => void;
  onNextTrack?: () => void;
  hasPrev?: boolean;
  audioProgress?: number;
  audioDuration?: number;
  onSeek?: (seconds: number) => void;
  autoPlay?: boolean;
  onToggleAutoPlay?: () => void;
  volume?: number;
  isMuted?: boolean;
  onVolumeChange?: (volume: number) => void;
  onToggleMute?: () => void;
  isLiked?: boolean;
  onToggleLike?: () => void;
  isAuthenticated?: boolean;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Tooltip wrapper component
function Tooltip({ label, children, position = "top" }: { label: string; children: React.ReactNode; position?: "top" | "bottom" | "left" | "right" }) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };
  return (
    <div className="relative group/tip">
      {children}
      <div className={`absolute ${positionClasses[position]} px-2 py-1 bg-[var(--text)] text-[var(--bg)] rounded-md font-mono text-[10px] whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 z-50`}>
        {label}
      </div>
    </div>
  );
}

export default function NowPlayingBanner({
  card,
  isPlaying,
  isUnavailable = false,
  onTogglePlay,
  onClose,
  onLocate,
  onPrevTrack,
  onNextTrack,
  hasPrev = false,
  audioProgress = 0,
  audioDuration = 0,
  onSeek,
  autoPlay = true,
  onToggleAutoPlay,
  volume = 80,
  isMuted = false,
  onVolumeChange,
  onToggleMute,
  isLiked = false,
  onToggleLike,
  isAuthenticated = true,
}: NowPlayingBannerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const mobileProgressBarRef = useRef<HTMLDivElement>(null);

  // EQ collapse
  const [eqActive, setEqActive] = useState(isPlaying);
  const eqBarRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const prevPlayingRef = useRef(isPlaying);

  // Mobile volume popup
  const [showVolumeFader, setShowVolumeFader] = useState(false);
  const volumeFaderRef = useRef<HTMLDivElement>(null);
  const volumeIconRef = useRef<HTMLButtonElement>(null);
  const volumeIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasDuration = audioDuration > 0;

  const progressPercent =
    dragPercent !== null
      ? dragPercent
      : hasDuration
        ? (audioProgress / audioDuration) * 100
        : 0;

  // EQ collapse: imperative 3-frame sequence for reliable staggered collapse
  useEffect(() => {
    if (prevPlayingRef.current && !isPlaying) {
      const bars = eqBarRefs.current.filter(Boolean) as HTMLSpanElement[];
      // Frame 1: pause animation at current position
      bars.forEach((bar) => { bar.style.animationPlayState = "paused"; });

      requestAnimationFrame(() => {
        // Frame 2: capture frozen heights, replace animation with explicit height
        bars.forEach((bar, i) => {
          const h = bar.getBoundingClientRect().height;
          bar.style.animation = "none";
          bar.style.height = `${h}px`;
          bar.style.transition = `height 0.35s ease-out ${i * 60}ms`;
        });

        requestAnimationFrame(() => {
          // Frame 3: collapse to 0 — transition kicks in from frozen height
          bars.forEach((bar) => { bar.style.height = "0px"; });
        });
      });

      setEqActive(false);
    } else if (isPlaying) {
      // Clear all inline overrides, let CSS animation take over
      const bars = eqBarRefs.current.filter(Boolean) as HTMLSpanElement[];
      bars.forEach((bar) => {
        bar.style.animation = "";
        bar.style.animationPlayState = "";
        bar.style.height = "";
        bar.style.transition = "";
      });
      setEqActive(true);
    }
    prevPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Dismiss volume fader on outside click
  useEffect(() => {
    if (!showVolumeFader) return;
    const handler = (e: PointerEvent) => {
      if (
        volumeFaderRef.current && !volumeFaderRef.current.contains(e.target as Node) &&
        volumeIconRef.current && !volumeIconRef.current.contains(e.target as Node)
      ) {
        setShowVolumeFader(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showVolumeFader]);

  // Auto-dismiss volume fader after 3s idle
  useEffect(() => {
    if (!showVolumeFader) return;
    if (volumeIdleTimer.current) clearTimeout(volumeIdleTimer.current);
    volumeIdleTimer.current = setTimeout(() => setShowVolumeFader(false), 3000);
    return () => { if (volumeIdleTimer.current) clearTimeout(volumeIdleTimer.current); };
  }, [showVolumeFader, volume, isMuted]);

  // --- Unified pointer seek handler ---
  const calcRatio = useCallback(
    (clientX: number, barEl: HTMLDivElement) => {
      const rect = barEl.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, barRef: React.RefObject<HTMLDivElement | null>) => {
      if (!onSeek || !barRef.current || !hasDuration) return;
      e.preventDefault();
      barRef.current.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      setIsDragging(true);
      const ratio = calcRatio(e.clientX, barRef.current);
      setDragPercent(ratio * 100);
    },
    [onSeek, hasDuration, calcRatio]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, barRef: React.RefObject<HTMLDivElement | null>) => {
      if (!isDraggingRef.current || !barRef.current) return;
      const ratio = calcRatio(e.clientX, barRef.current);
      setDragPercent(ratio * 100);
    },
    [calcRatio]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, barRef: React.RefObject<HTMLDivElement | null>) => {
      if (!isDraggingRef.current || !onSeek || !barRef.current) return;
      const ratio = calcRatio(e.clientX, barRef.current);
      onSeek(ratio * audioDuration);
      isDraggingRef.current = false;
      setIsDragging(false);
      setDragPercent(null);
    },
    [onSeek, audioDuration, calcRatio]
  );

  const thumbUrl = card.imageSmall || card.image;

  // EQ bars — always rendered; collapse handled imperatively via refs
  const eqBars = (
    <div className="flex items-end gap-[2px] h-3.5 shrink-0">
      {[1, 2, 3, 4, 5].map((n, i) => (
        <span
          key={n}
          ref={(el) => { eqBarRefs.current[i] = el; }}
          className={`w-[2px] bg-[var(--text)] rounded-full ${eqActive ? `eq-bar-${n}` : ""}`}
        />
      ))}
    </div>
  );

  // Like/Heart button
  const likeButton = (size: "sm" | "md" = "md") => onToggleLike ? (
    <Tooltip label={!isAuthenticated ? "Log in to save" : isLiked ? "Unlike" : "Like"}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isAuthenticated) onToggleLike();
        }}
        className={`shrink-0 flex items-center justify-center rounded-full transition-all duration-200 ease-out active:scale-90 ${
          size === "sm" ? "w-6 h-6" : "w-7 h-7"
        } ${!isAuthenticated ? "opacity-50 cursor-default" : ""}`}
      >
        <svg
          className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"}
          viewBox="0 0 24 24"
          fill={isLiked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: isLiked ? "var(--text)" : "var(--text-muted)" }}
        >
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      </button>
    </Tooltip>
  ) : null;

  // Locate button
  const [locateSpin, setLocateSpin] = useState(false);
  const locateButton = (size: "sm" | "md" = "md") => onLocate ? (
    <Tooltip label="Locate">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setLocateSpin(true);
          onLocate();
        }}
        className={`locate-btn shrink-0 flex items-center justify-center hover:text-[var(--text)] transition-all duration-200 ease-out active:scale-95 ${
          locateSpin ? "text-[var(--text)]" : "text-[var(--text-muted)]"
        } ${size === "sm" ? "w-7 h-7" : "w-8 h-8"}`}
      >
        <svg
          className={`${size === "sm" ? "w-4 h-4" : "w-5 h-5"} ${locateSpin ? "animate-[locate-spin_0.5s_ease-in-out]" : ""}`}
          onAnimationEnd={() => setLocateSpin(false)}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <line x1="12" y1="1" x2="12" y2="7" />
          <line x1="12" y1="17" x2="12" y2="23" />
          <line x1="1" y1="12" x2="7" y2="12" />
          <line x1="17" y1="12" x2="23" y2="12" />
        </svg>
      </button>
    </Tooltip>
  ) : null;

  // Shuffle button
  const autoPlayButton = onToggleAutoPlay ? (
    <Tooltip label={autoPlay ? "Shuffle on" : "Shuffle off"}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleAutoPlay();
        }}
        className={`relative shrink-0 w-8 h-8 flex items-center justify-center transition-all duration-200 ease-out active:scale-95 ${
          autoPlay
            ? "text-[var(--text)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill={autoPlay ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 3h5v5" />
          <path d="M4 20L21 3" />
          <path d="M21 16v5h-5" />
          <path d="M15 15l6 6" />
          <path d="M4 4l5 5" />
        </svg>
        <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current transition-opacity duration-200 ${autoPlay ? "opacity-100" : "opacity-0"}`} />
      </button>
    </Tooltip>
  ) : null;

  // Volume slider (desktop)
  const volumeControl = () => {
    const effectiveVolume = isMuted ? 0 : volume;
    const speakerIcon = (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {isMuted || effectiveVolume === 0 ? (
          <>
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        ) : effectiveVolume < 50 ? (
          <path d="M15.54 8.46a5 5 0 010 7.07" />
        ) : (
          <>
            <path d="M15.54 8.46a5 5 0 010 7.07" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
          </>
        )}
      </svg>
    );

    return (
      <div className="group/vol flex items-center gap-1.5">
        <Tooltip label={isMuted ? "Unmute" : "Mute"}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute?.();
            }}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] transition-all duration-200 ease-out active:scale-95"
          >
            {speakerIcon}
          </button>
        </Tooltip>
        <input
          type="range"
          min={0}
          max={100}
          value={effectiveVolume}
          onChange={(e) => onVolumeChange?.(parseInt(e.target.value, 10))}
          className="volume-slider w-20 cursor-pointer hidden lg:block"
          style={{
            background: `linear-gradient(to right, var(--vol-fill) ${effectiveVolume}%, var(--border) ${effectiveVolume}%)`,
          }}
        />
      </div>
    );
  };

  // Mobile volume icon + vertical fader popup
  const mobileVolumePopup = () => {
    const effectiveVolume = isMuted ? 0 : volume;
    return (
      <div className="relative shrink-0">
        <button
          ref={volumeIconRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowVolumeFader((prev) => !prev);
          }}
          className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] transition-all duration-200 ease-out active:scale-95"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {isMuted || effectiveVolume === 0 ? (
              <>
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : effectiveVolume < 50 ? (
              <path d="M15.54 8.46a5 5 0 010 7.07" />
            ) : (
              <>
                <path d="M15.54 8.46a5 5 0 010 7.07" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
              </>
            )}
          </svg>
        </button>

        {/* Vertical fader popup */}
        {showVolumeFader && (
          <div
            ref={volumeFaderRef}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col items-center gap-1.5 px-2 py-3 bg-[var(--bg-alt)] border border-[var(--border)] rounded-lg shadow-lg z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="range"
              min={0}
              max={100}
              value={effectiveVolume}
              onChange={(e) => {
                onVolumeChange?.(parseInt(e.target.value, 10));
                // Reset idle timer on interaction
                if (volumeIdleTimer.current) clearTimeout(volumeIdleTimer.current);
                volumeIdleTimer.current = setTimeout(() => setShowVolumeFader(false), 3000);
              }}
              className="h-24 accent-[var(--text)] cursor-pointer"
              style={{
                accentColor: "var(--text)",
                writingMode: "vertical-lr",
                direction: "rtl",
                width: "20px",
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute?.();
              }}
              className="w-5 h-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {isMuted ? (
                  <>
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </>
                ) : null}
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  // Seek bar
  const seekBar = (barRef: React.RefObject<HTMLDivElement | null>) => (
    <div className="flex-1 py-2 px-2">
      <div
        ref={barRef}
        className="relative h-1.5 bg-[var(--border)] rounded-full cursor-pointer touch-none"
        onPointerDown={(e) => handlePointerDown(e, barRef)}
        onPointerMove={(e) => handlePointerMove(e, barRef)}
        onPointerUp={(e) => handlePointerUp(e, barRef)}
      >
        <div
          className="h-full bg-[var(--text)] rounded-full pointer-events-none"
          style={{
            width: `${progressPercent}%`,
            transition: isDragging ? "none" : "width 75ms linear",
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[var(--bg)] border-2 border-[var(--text)] shadow-md pointer-events-none"
          style={{
            left: `${progressPercent}%`,
            width: isDragging ? "16px" : "14px",
            height: isDragging ? "16px" : "14px",
            transition: isDragging ? "width 100ms, height 100ms" : "left 75ms linear, width 100ms, height 100ms",
          }}
        />
      </div>
    </div>
  );

  // Time labels — desktop
  const elapsedLabel = (
    <span className="shrink-0 font-mono text-xs text-[var(--text-muted)] tabular-nums w-9 text-right">
      {formatTime(audioProgress)}
    </span>
  );
  const remainingLabel = (
    <span className="shrink-0 font-mono text-xs text-[var(--text-muted)] tabular-nums w-9">
      {hasDuration ? `-${formatTime(Math.max(0, audioDuration - audioProgress))}` : "--:--"}
    </span>
  );

  // Time labels — mobile
  const mobileElapsedLabel = (
    <span className="shrink-0 font-mono text-[11px] text-[var(--text-muted)] tabular-nums w-9 text-right">
      {formatTime(audioProgress)}
    </span>
  );
  const mobileRemainingLabel = (
    <span className="shrink-0 font-mono text-[11px] text-[var(--text-muted)] tabular-nums w-9">
      {hasDuration ? `-${formatTime(Math.max(0, audioDuration - audioProgress))}` : "--:--"}
    </span>
  );

  // Transport buttons
  const prevButton = (size: number) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onPrevTrack?.();
      }}
      disabled={!hasPrev}
      className={`shrink-0 flex items-center justify-center rounded-full transition-all duration-200 ease-out ${
        hasPrev
          ? "text-[var(--text)] hover:bg-[var(--border)] active:scale-95 active:-translate-x-0.5"
          : "text-[var(--text-muted)]/40 cursor-default"
      }`}
      style={{ width: size, height: size }}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
      </svg>
    </button>
  );

  const playPauseButton = (size: number, iconSize: number = 16) => (
    <button
      onClick={onTogglePlay}
      className="shrink-0 rounded-full bg-[var(--text)] text-[var(--bg)] flex items-center justify-center hover:opacity-80 hover:scale-105 active:scale-95 transition-all duration-200 ease-out"
      style={{ width: size, height: size }}
    >
      {isPlaying ? (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <rect x="5" y="3" width="5" height="18" rx="1" />
          <rect x="14" y="3" width="5" height="18" rx="1" />
        </svg>
      ) : (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}>
          <path d="M6 3.5v17a1 1 0 001.5.86l14-8.5a1 1 0 000-1.72l-14-8.5A1 1 0 006 3.5z" />
        </svg>
      )}
    </button>
  );

  const nextButton = (size: number) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onNextTrack?.();
      }}
      className="shrink-0 flex items-center justify-center rounded-full text-[var(--text)] hover:bg-[var(--border)] active:scale-95 active:translate-x-0.5 transition-all duration-200 ease-out"
      style={{ width: size, height: size }}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
      </svg>
    </button>
  );

  // Close button (desktop) — hatched gutter + half-diamond bg
  const closeGutter = (
    <div className="group/close self-stretch shrink-0 flex items-stretch">
      {/* Diagonal hatch separator */}
      <div className="self-stretch w-[6px] hatch-separator" />
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="relative w-10 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/60 active:scale-95 transition-all duration-200 ease-out"
      >
        <svg
          className="w-4 h-4 transition-transform duration-200 group-hover/close:scale-110"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );

  // Close button — mobile (round pill, no rotate)
  const mobileCloseButton = (
    <button
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/50 active:scale-90 transition-all duration-200 ease-out"
    >
      <svg
        className="w-3 h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0.5 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="player-banner fixed left-0 right-0 lg:left-[var(--sidebar-width)] bg-[var(--bg-alt)]/85 backdrop-blur-2xl backdrop-saturate-150 border-t border-[var(--border)]/50"
      style={{ bottom: 0, height: "var(--player-height)" }}
    >
      {/* ===== DESKTOP layout (sm+): single row, 96px ===== */}
      <div className="h-full hidden sm:flex items-center pl-0 pr-4 gap-2">
        {/* Album art thumbnail */}
        {thumbUrl && (
          <div
            key={card.id}
            className={`shrink-0 self-stretch aspect-square rounded-none overflow-hidden bg-[var(--bg)] shadow-md animate-art-in relative group/art cursor-pointer transition-opacity duration-300 ${isUnavailable ? "opacity-40" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (card.youtubeUrl) window.open(card.youtubeUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
            {card.source === "youtube" && card.youtubeUrl && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/art:opacity-100 transition-opacity duration-200">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.582 6.186a2.506 2.506 0 00-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418c-.86.23-1.538.908-1.768 1.768C2 7.746 2 12 2 12s0 4.254.418 5.814c.23.86.908 1.538 1.768 1.768C5.746 20 12 20 12 20s6.254 0 7.814-.418a2.506 2.506 0 001.768-1.768C22 16.254 22 12 22 12s0-4.254-.418-5.814zM10 15.464V8.536L16 12l-6 3.464z" />
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Track info — fixed width + like */}
        <div className="shrink-0 w-[140px] lg:w-[200px] xl:w-[280px] 2xl:w-[320px] flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {isUnavailable ? (
              <p className="font-mono text-sm text-[var(--text-muted)] uppercase truncate leading-tight">
                Unavailable &middot; skipping&hellip;
              </p>
            ) : (
              <>
                <p className="font-mono text-sm text-[var(--text)] uppercase truncate leading-tight font-bold">
                  {card.name}
                </p>
                <p className="font-mono text-xs text-[var(--text-secondary)] uppercase truncate leading-tight">
                  {card.artist}
                </p>
              </>
            )}
          </div>
          {likeButton("md")}
        </div>

        {/* EQ bars — stable position between info and transport */}
        {eqBars}

        {/* Transport */}
        {prevButton(36)}
        {playPauseButton(44, 18)}
        {nextButton(36)}

        {/* Progress */}
        <div className="flex flex-1 items-center gap-1.5 min-w-[80px]">
          {elapsedLabel}
          {seekBar(progressBarRef)}
          {remainingLabel}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {volumeControl()}
          <div className="hidden md:flex">{autoPlayButton}</div>
          <div className="hidden lg:flex">{locateButton("md")}</div>
        </div>

        {/* Edge gutter — close */}
        {closeGutter}
      </div>

      {/* ===== MOBILE layout (below sm): 2-row, 120px ===== */}
      <div className="h-full flex sm:hidden flex-col px-3 py-2 gap-1.5">
        {/* Row 1: Art + Info+Like + Volume + Transport + Locate */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {thumbUrl && (
            <a
              href={card.source === "youtube" && card.youtubeUrl ? card.youtubeUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              key={card.id}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-[var(--bg)] shadow-md animate-art-in relative group/art transition-opacity duration-300 ${isUnavailable ? "opacity-40" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!card.youtubeUrl) e.preventDefault();
              }}
            >
              <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
              {card.source === "youtube" && card.youtubeUrl && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/art:opacity-100 transition-opacity duration-200">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.582 6.186a2.506 2.506 0 00-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418c-.86.23-1.538.908-1.768 1.768C2 7.746 2 12 2 12s0 4.254.418 5.814c.23.86.908 1.538 1.768 1.768C5.746 20 12 20 12 20s6.254 0 7.814-.418a2.506 2.506 0 001.768-1.768C22 16.254 22 12 22 12s0-4.254-.418-5.814zM10 15.464V8.536L16 12l-6 3.464z" />
                  </svg>
                </div>
              )}
            </a>
          )}
          <div className="flex-1 min-w-0">
            {isUnavailable ? (
              <p className="font-mono text-sm text-[var(--text-muted)] uppercase truncate leading-tight">
                Unavailable &middot; skipping&hellip;
              </p>
            ) : (
              <>
                <p className="font-mono text-sm text-[var(--text)] uppercase truncate leading-tight font-bold">
                  {card.name}
                </p>
                <p className="font-mono text-[11px] text-[var(--text-secondary)] uppercase truncate leading-tight">
                  {card.artist}
                </p>
              </>
            )}
          </div>
          {prevButton(32)}
          {playPauseButton(36, 14)}
          {nextButton(32)}
          {mobileVolumePopup()}
          {/* Compact mobile shuffle */}
          {onToggleAutoPlay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleAutoPlay();
              }}
              className={`relative shrink-0 w-6 h-6 flex items-center justify-center transition-all duration-200 ease-out active:scale-95 ${
                autoPlay
                  ? "text-[var(--text)]"
                  : "text-[var(--text-muted)]/50"
              }`}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill={autoPlay ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3h5v5" />
                <path d="M4 20L21 3" />
                <path d="M21 16v5h-5" />
                <path d="M15 15l6 6" />
                <path d="M4 4l5 5" />
              </svg>
              <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full bg-current transition-opacity duration-200 ${autoPlay ? "opacity-100" : "opacity-0"}`} />
            </button>
          )}
          {mobileCloseButton}
        </div>

        {/* Row 2: Seek bar only */}
        <div className="flex items-center gap-1.5">
          {mobileElapsedLabel}
          {seekBar(mobileProgressBarRef)}
          {mobileRemainingLabel}
        </div>
      </div>
    </motion.div>
  );
}
