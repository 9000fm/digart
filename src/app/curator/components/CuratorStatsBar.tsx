"use client";

import type { CuratorStats } from "../types";

interface CuratorStatsBarProps {
  stats: CuratorStats | null;
}

export function CuratorStatsBar({ stats }: CuratorStatsBarProps) {
  if (!stats) return null;

  return (
    <div className="flex items-center gap-2 mb-3 text-[11px] font-mono text-[var(--text-muted)] tracking-wider">
      <span className="text-[var(--text)] font-bold">{stats.imported}</span>{" "}
      imported
      <span className="text-[var(--text-muted)]">&middot;</span>
      <span className="text-emerald-500 font-bold">{stats.approved}</span>{" "}
      approved
      <span className="text-[var(--text-muted)]">&middot;</span>
      <span className="font-bold">{stats.rejected}</span> rejected
      <span className="text-[var(--text-muted)]">&middot;</span>
      <span className="font-bold">{stats.unsub}</span> unsub
      <span className="text-[var(--text-muted)]">&middot;</span>
      <span className="font-bold">{stats.pending}</span> pending
    </div>
  );
}
