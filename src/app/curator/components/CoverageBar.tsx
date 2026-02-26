"use client";

import { useState } from "react";
import type { CoverageData } from "../types";

interface CoverageBarProps {
  data: CoverageData | null;
  loading: boolean;
}

type SegmentKey =
  | "approved"
  | "rejected"
  | "unsub"
  | "skipped"
  | "unreviewed"
  | "conflict";

const SEGMENT_CONFIG: {
  key: SegmentKey;
  label: string;
  color: string;
  bgClass: string;
}[] = [
  {
    key: "approved",
    label: "APPROVED",
    color: "bg-emerald-500",
    bgClass: "text-emerald-500",
  },
  {
    key: "rejected",
    label: "REJECTED",
    color: "bg-zinc-600",
    bgClass: "text-zinc-400",
  },
  {
    key: "unsub",
    label: "UNSUB",
    color: "bg-red-500",
    bgClass: "text-red-400",
  },
  {
    key: "skipped",
    label: "SKIPPED",
    color: "bg-amber-500",
    bgClass: "text-amber-400",
  },
  {
    key: "unreviewed",
    label: "UNREVIEWED",
    color: "bg-blue-500",
    bgClass: "text-blue-400",
  },
  {
    key: "conflict",
    label: "CONFLICT",
    color: "bg-red-500 animate-pulse",
    bgClass: "text-red-400",
  },
];

export function CoverageBar({ data, loading }: CoverageBarProps) {
  const [expanded, setExpanded] = useState<SegmentKey | null>(null);

  if (loading || !data) {
    return (
      <div className="animate-pulse h-10 bg-[var(--bg-alt)] rounded-lg" />
    );
  }

  const total = data.total;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.2em]">
          COVERAGE
        </h3>
        <span className="text-[11px] text-[var(--text)] font-bold tabular-nums">
          {total} CHANNELS
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-7 rounded-sm overflow-hidden gap-px">
        {SEGMENT_CONFIG.map(({ key, color, label }) => {
          const count = data.segments[key]?.count || 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <button
              key={key}
              onClick={() => setExpanded(expanded === key ? null : key)}
              className={`${color} relative group transition-opacity ${
                expanded && expanded !== key ? "opacity-40" : ""
              }`}
              style={{ width: `${pct}%`, minWidth: count > 0 ? "2px" : 0 }}
              title={`${label}: ${count}`}
            >
              {pct > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90 tracking-wider truncate px-1">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {SEGMENT_CONFIG.map(({ key, label, bgClass }) => {
          const count = data.segments[key]?.count || 0;
          if (count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setExpanded(expanded === key ? null : key)}
              className={`text-[10px] tracking-wider uppercase transition-opacity ${
                expanded && expanded !== key
                  ? "opacity-30"
                  : bgClass
              }`}
            >
              {label}: {count}
            </button>
          );
        })}
      </div>

      {/* Expanded channel list */}
      {expanded && data.segments[expanded] && (
        <div className="border border-[var(--border)] rounded-lg p-3 max-h-64 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.segments[expanded].channels.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center gap-2 text-xs py-1"
              >
                <span className="text-[var(--text)] truncate flex-1">
                  {ch.name}
                </span>
                <a
                  href={`https://www.youtube.com/channel/${ch.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-muted)] hover:text-[var(--text)] text-[9px] uppercase tracking-wider shrink-0"
                >
                  YT
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
