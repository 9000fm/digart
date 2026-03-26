"use client";

import { useState, useEffect, useCallback } from "react";
import type { CuratorData } from "../types";
import { GenreLabels } from "./GenreLabels";
import { ChannelUploadGrid } from "./ChannelUploadGrid";

interface ReviewQueueProps {
  data: CuratorData;
  acting: boolean;
  history: { id: string }[];
  rescanning: boolean;
  isStarred: boolean;
  selectedLabels: Set<string>;
  onToggleLabel: (label: string) => void;
  onDecision: (d: "approve" | "reject") => void;
  onGoBack: () => void;
  onToggleStar: (starred: boolean) => void;
  onRescan: () => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function ReviewQueue({
  data,
  acting,
  history,
  rescanning,
  isStarred,
  selectedLabels,
  onToggleLabel,
  onDecision,
  onGoBack,
  onToggleStar,
  onRescan,
  notes,
  onNotesChange,
}: ReviewQueueProps) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [localStarred, setLocalStarred] = useState(isStarred);
  const channel = data.channel;
  const uploads = data.uploads || [];

  // Sync from parent
  useEffect(() => { setLocalStarred(isStarred); }, [isStarred]);

  // Direct star toggle — calls API directly, no stale closures
  const toggleStar = useCallback(async () => {
    if (!channel) return;
    const res = await fetch("/api/curator", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: channel.id, channelName: channel.name }),
    });
    const result = await res.json();
    setLocalStarred(result.starred);
    onToggleStar(result.starred);
  }, [channel, onToggleStar]);

  // Own keyboard shortcuts — ensures F/A/R/B/X/ESC always work
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "a" || e.key === "A") onDecision("approve");
      if (e.key === "r" || e.key === "R") onDecision("reject");
      if (e.key === "f" || e.key === "F") toggleStar();
      if (e.key === "b" || e.key === "B") onGoBack();
      if (e.key === "x" || e.key === "X") onRescan();
      if (e.key === "Escape") setPlayingVideoId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDecision, toggleStar, onGoBack, onRescan]);

  if (!channel) return null;

  return (
    <>
      {/* Channel info */}
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-0.5">
          <h2 className="text-2xl font-bold tracking-tight">{channel.name}</h2>
          <button
            onClick={toggleStar}
            className={`text-2xl leading-none transition-all duration-200 active:scale-150 ${
              localStarred
                ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                : "text-[var(--text-muted)]/30 hover:text-amber-400"
            }`}
            title={localStarred ? "Unstar (F)" : "Star (F)"}
          >
            {localStarred ? "\u2605" : "\u2606"}
          </button>
          {localStarred && (
            <span className="text-[9px] text-amber-400 uppercase tracking-[0.2em] font-bold animate-pulse">
              STARRED
            </span>
          )}
        </div>
        {/* YouTube topics */}
        {data.topics && data.topics.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[11px] text-[var(--text-muted)]/60 uppercase tracking-wider mr-1">YT topics</span>
            {data.topics.map((t) => (
              <span
                key={t}
                className={`text-[11px] px-2.5 py-1 rounded-full uppercase tracking-wider ${
                  t.toLowerCase().includes("music")
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-[var(--bg-alt)] text-[var(--text-muted)]"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <a
            href={`https://www.youtube.com/channel/${channel.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-xs uppercase tracking-[0.2em] transition-colors"
          >
            View on YouTube &rarr;
          </a>
          <button
            onClick={onRescan}
            disabled={rescanning}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-xs uppercase tracking-[0.2em] transition-colors disabled:opacity-40"
          >
            {rescanning ? "RESCANNING..." : "RESCAN"}
          </button>
        </div>
      </div>

      <GenreLabels selected={selectedLabels} onToggle={onToggleLabel} />

      {/* Notes */}
      <div className="mb-3">
        <input
          type="text"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add a note... (e.g. embed disabled, vinyl only)"
          className="w-full bg-transparent border-b border-[var(--border)] px-1 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]/30 focus:outline-none focus:border-[var(--text-secondary)] transition-colors font-mono"
        />
      </div>

      {/* Uploads */}
      <div className="pb-36">
        <h3 className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2">
          UPLOADS
        </h3>
        <ChannelUploadGrid
          uploads={uploads}
          playingVideoId={playingVideoId}
          setPlayingVideoId={setPlayingVideoId}
        />
      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg)] border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3">
          <div className="flex gap-3 mb-2">
            <button
              onClick={() => onDecision("approve")}
              disabled={acting}
              className="relative flex-[2] flex items-center rounded-none bg-[var(--accent)] text-[var(--accent-text)] transition-all duration-100 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] active:scale-[0.93] active:shadow-none disabled:opacity-30 disabled:hover:shadow-none disabled:active:scale-100"
            >
              <div className="w-1.5 self-stretch bg-emerald-400 shrink-0" />
              <div className="flex-1 flex items-center justify-between px-4 py-2.5">
                <span className="text-sm font-bold uppercase tracking-[0.15em]">
                  + APPROVE
                </span>
                <kbd className="text-[9px] font-normal opacity-60 border border-current/20 px-1.5 py-0.5">
                  A
                </kbd>
              </div>
            </button>
            <button
              onClick={() => onDecision("reject")}
              disabled={acting}
              className="relative flex-1 flex items-center rounded-none bg-[var(--bg-alt)] text-[var(--text-muted)] transition-all duration-100 hover:text-[var(--text)] hover:bg-[var(--border)] active:scale-[0.93] disabled:opacity-30 disabled:active:scale-100"
            >
              <div className="w-1 self-stretch bg-[var(--text-muted)] shrink-0" />
              <div className="flex-1 flex items-center justify-between px-3 py-2.5">
                <span className="text-xs font-bold uppercase tracking-wider">
                  &times; REJECT
                </span>
                <kbd className="text-[9px] font-normal opacity-40 border border-[var(--border)] px-1.5 py-0.5">
                  R
                </kbd>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onGoBack}
              disabled={acting || history.length === 0}
              className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-[var(--text-muted)] rounded-none border border-transparent transition-all duration-100 hover:border-[var(--border)] hover:text-[var(--text)] active:scale-[0.93] disabled:opacity-20 disabled:hover:border-transparent disabled:cursor-default"
            >
              <span className="inline-flex items-center gap-2">
                GO BACK{" "}
                <kbd className="text-[9px] opacity-40 border border-[var(--border)] px-1 py-0.5">
                  B
                </kbd>
              </span>
            </button>
            <div className="ml-auto flex items-center gap-4 text-[var(--text-muted)] text-xs tracking-wider uppercase">
              <span>
                <kbd className="text-[10px] opacity-50 border border-[var(--border)] px-1.5 py-0.5 rounded mr-1.5">A</kbd>
                Approve
              </span>
              <span>
                <kbd className="text-[10px] opacity-50 border border-[var(--border)] px-1.5 py-0.5 rounded mr-1.5">R</kbd>
                Reject
              </span>
              <span>
                <kbd className="text-[10px] opacity-50 border border-[var(--border)] px-1.5 py-0.5 rounded mr-1.5">F</kbd>
                Star
              </span>
              <span>
                <kbd className="text-[10px] opacity-50 border border-[var(--border)] px-1.5 py-0.5 rounded mr-1.5">X</kbd>
                Rescan
              </span>
              <span>
                <kbd className="text-[10px] opacity-50 border border-[var(--border)] px-1.5 py-0.5 rounded mr-1.5">ESC</kbd>
                Back
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
