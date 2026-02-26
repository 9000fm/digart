"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Tooltip from "./Tooltip";
import type { CardData } from "@/lib/types";

interface MusicCardProps {
  card: CardData;
  saved: boolean;
  isPlaying: boolean;
  isTop10?: boolean;
  onPlay: () => void;
  onSave: () => void;
  onShare?: () => void;
  isAuthenticated?: boolean;
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
  return String(count);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MusicCard({
  card,
  saved,
  isPlaying,
  isTop10 = false,
  onPlay,
  onSave,
  isAuthenticated = true,
}: MusicCardProps) {
  const [imgError, setImgError] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [tipLocked, setTipLocked] = useState(false);

  const handlePlay = () => {
    onPlay();
  };

  const handleHeartClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNudge(true);
    if (isAuthenticated) onSave();
    else setTipLocked(true);
  }, [isAuthenticated, onSave]);

  return (
    <div data-card-id={card.id} className={`group relative aspect-square cursor-pointer bg-[var(--bg-alt)] rounded-2xl transition-all duration-200 hover:z-10 hover:ring-1 hover:ring-[var(--text-muted)]/20`}>
      {/* Clip layer for cover image */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        {imgError ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-alt)]"
            onClick={handlePlay}
            title="YouTube"
          >
            <svg className="w-10 h-10 text-[var(--text-muted)] mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="6.5" strokeDasharray="2 3" />
            </svg>
            <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">DIGEART</span>
          </div>
        ) : (
          <Image
            src={card.image || "/placeholder.svg"}
            alt={`${card.name} by ${card.artist}`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onClick={handlePlay}
            onError={() => setImgError(true)}
            title="YouTube"
          />
        )}
      </div>

      {/* Duration badge — top left (for mixes >40min) */}
      {card.duration && card.duration > 2400 && (
        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/70 text-white font-mono text-[10px] rounded-md backdrop-blur-sm">
          {formatDuration(card.duration)}
        </span>
      )}

      {/* Status tags — top right */}
      {(() => {
        const isNew = card.publishedAt ? (Date.now() - new Date(card.publishedAt).getTime()) / 86400000 <= 30 : false;
        const tags: { label: string; color: string }[] = [];
        if (isTop10) tags.push({ label: "Top", color: "bg-orange-500" });
        if (card.viewCount != null && card.viewCount >= 100_000 && !isTop10) tags.push({ label: "Hot", color: "bg-red-500" });
        if (card.viewCount != null && card.viewCount < 5_000 && !isTop10 && !isNew) tags.push({ label: "Rare", color: "bg-pink-500" });
        if (isNew) tags.push({ label: "New", color: "bg-emerald-500" });
        if (tags.length === 0) return null;
        return (
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
            {tags.map((t) => (
              <span key={t.label} className={`px-2 py-0.5 ${t.color} text-white font-mono text-[10px] font-bold rounded-md shadow-sm`}>
                {t.label}
              </span>
            ))}
          </div>
        );
      })()}

      {/* Center EQ — wind-down animation on stop */}
      <div className={`absolute inset-0 flex items-center justify-center z-10 pointer-events-none group-hover:opacity-0 transition-opacity duration-200 ${isPlaying ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: isPlaying ? "0ms" : "350ms" }}>
        <div className="flex items-end gap-[3px] bg-black/60 rounded-lg px-3 py-2 h-10 backdrop-blur-sm">
          <span className={`w-[3px] bg-white rounded-full transition-[height] duration-300 ease-out ${isPlaying ? "eq-bar" : "eq-bar-idle"}`} style={{ animationDelay: "0ms", transitionDelay: isPlaying ? "0ms" : "0ms" }} />
          <span className={`w-[3px] bg-white rounded-full transition-[height] duration-300 ease-out ${isPlaying ? "eq-bar" : "eq-bar-idle"}`} style={{ animationDelay: "150ms", transitionDelay: isPlaying ? "0ms" : "60ms" }} />
          <span className={`w-[3px] bg-white rounded-full transition-[height] duration-300 ease-out ${isPlaying ? "eq-bar" : "eq-bar-idle"}`} style={{ animationDelay: "300ms", transitionDelay: isPlaying ? "0ms" : "120ms" }} />
          <span className={`w-[3px] bg-white rounded-full transition-[height] duration-300 ease-out ${isPlaying ? "eq-bar" : "eq-bar-idle"}`} style={{ animationDelay: "100ms", transitionDelay: isPlaying ? "0ms" : "180ms" }} />
          <span className={`w-[3px] bg-white rounded-full transition-[height] duration-300 ease-out ${isPlaying ? "eq-bar" : "eq-bar-idle"}`} style={{ animationDelay: "220ms", transitionDelay: isPlaying ? "0ms" : "240ms" }} />
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded-2xl" />

      {/* Play/Stop button — center, on hover */}
      <div
        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={handlePlay}
      >
        <span
          className={`font-mono text-6xl sm:text-7xl lg:text-8xl leading-none transition-colors drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] ${
            isPlaying ? "text-white" : "text-white hover:text-zinc-300"
          }`}
        >
          {isPlaying ? "❚❚" : "▶"}
        </span>
      </div>

      {/* Save/Like button — bottom right */}
      <div className="absolute bottom-2 right-2 z-20">
        <Tooltip label={!isAuthenticated ? "Log in to save" : saved ? "Unlike" : "Like"} position="top" show={nudge || tipLocked} hoverable={isAuthenticated}>
          <button
            onClick={handleHeartClick}
            onAnimationEnd={() => setNudge(false)}
            onMouseLeave={() => setTipLocked(false)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 bg-black/70 text-white hover:bg-black/90 ${
              saved
                ? "opacity-100"
                : isAuthenticated
                  ? "opacity-0 group-hover:opacity-100"
                  : "opacity-0 group-hover:opacity-50 cursor-default"
            } ${nudge ? "heart-nudge" : ""}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={saved ? 0 : 2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        </Tooltip>
      </div>


      {/* Track info — bottom */}
      <div className="absolute bottom-0 left-0 right-10 px-2.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <p className="font-mono text-sm text-white uppercase truncate leading-tight font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
            {card.name}
          </p>
          <p className="font-mono text-[11px] text-zinc-300 uppercase truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
            {card.artist}
          </p>
        </div>
    </div>
  );
}
