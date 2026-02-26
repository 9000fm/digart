"use client";

import { useState } from "react";
import type { CuratorData, Upload } from "../types";
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
  onDecision: (d: "approve" | "reject" | "unsubscribe") => void;
  onSkip: () => void;
  onGoBack: () => void;
  onToggleStar: () => void;
  onRescan: () => void;
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
  onSkip,
  onGoBack,
  onToggleStar,
  onRescan,
}: ReviewQueueProps) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const channel = data.channel;
  const uploads = data.uploads || [];
  const progress = Math.round((data.reviewed / data.total) * 100);

  if (!channel) return null;

  return (
    <>
      {/* Progress bar */}
      <div className="w-full h-px bg-[var(--border)] mb-2 relative">
        <div
          className="absolute top-0 left-0 h-[3px] -translate-y-[1px] bg-[var(--accent)] transition-all duration-500 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Channel info */}
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-0.5">
          <h2 className="text-2xl font-bold tracking-tight">{channel.name}</h2>
          <button
            onClick={onToggleStar}
            className={`text-2xl leading-none transition-colors ${
              isStarred
                ? "text-amber-400"
                : "text-[var(--text-muted)] hover:text-amber-400"
            }`}
            title={isStarred ? "Unstar (F)" : "Star (F)"}
          >
            {isStarred ? "\u2605" : "\u2606"}
          </button>
        </div>
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
            <button
              onClick={() => onDecision("unsubscribe")}
              disabled={acting}
              className="relative flex-1 flex items-center rounded-none bg-red-500/5 text-red-400 transition-all duration-100 hover:bg-red-500 hover:text-white active:scale-[0.93] disabled:opacity-30 disabled:active:scale-100"
            >
              <div className="w-1 self-stretch bg-red-500 shrink-0" />
              <div className="flex-1 flex items-center justify-between px-3 py-2.5">
                <span className="text-xs font-bold uppercase tracking-wider">
                  &oslash; UNSUB
                </span>
                <kbd className="text-[9px] font-normal opacity-40 border border-current/20 px-1.5 py-0.5">
                  U
                </kbd>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onSkip}
              className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-[var(--text-muted)] rounded-none border border-transparent transition-all duration-100 hover:border-[var(--border)] hover:text-[var(--text)] active:scale-[0.93]"
            >
              <span className="inline-flex items-center gap-2">
                SKIP{" "}
                <kbd className="text-[9px] opacity-40 border border-[var(--border)] px-1 py-0.5">
                  S
                </kbd>
              </span>
            </button>
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
            <div className="ml-auto flex items-center gap-3 text-[var(--text-muted)] text-[11px] tracking-wider uppercase">
              <span>
                <kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">
                  A
                </kbd>
                Approve
              </span>
              <span>
                <kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">
                  R
                </kbd>
                Reject
              </span>
              <span>
                <kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">
                  U
                </kbd>
                Unsub
              </span>
              <span>
                <kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">
                  S
                </kbd>
                Skip
              </span>
              <span>
                <kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">
                  B
                </kbd>
                Back
              </span>
              <span>
                <kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">
                  F
                </kbd>
                Flag
              </span>
              <span>
                <kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">
                  X
                </kbd>
                Rescan
              </span>
              <span>
                <kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">
                  ESC
                </kbd>
                Close
              </span>
              {history.length > 0 && (
                <span className="text-[var(--text-secondary)] ml-1 tabular-nums">
                  {history.length} reviewed
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
