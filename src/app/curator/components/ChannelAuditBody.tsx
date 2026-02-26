"use client";

import { useState, useCallback, useEffect } from "react";
import type { ApprovedChannel, Upload } from "../types";
import { GenreLabels } from "./GenreLabels";
import { ChannelUploadGrid } from "./ChannelUploadGrid";

interface ChannelAuditBodyProps {
  channel: ApprovedChannel;
  labels: Set<string>;
  onToggleLabel: (label: string) => void;
  onToggleStar?: () => void;
  isStarred?: boolean;
  /** Extra content rendered below the header (e.g. progress indicator) */
  headerExtra?: React.ReactNode;
}

export function ChannelAuditBody({
  channel,
  labels,
  onToggleLabel,
  onToggleStar,
  isStarred,
  headerExtra,
}: ChannelAuditBodyProps) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    setPlayingId(null);
    try {
      const res = await fetch(
        `/api/curator?rescan=true&channelId=${channel.id}`
      );
      const json = await res.json();
      setUploads(json.uploads || []);
    } catch {
      setUploads([]);
    }
    setLoading(false);
  }, [channel.id]);

  // Fetch on mount and when channel changes
  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  return (
    <>
      {/* Channel info */}
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-0.5">
          <h2 className="text-2xl font-bold tracking-tight">{channel.name}</h2>
          {onToggleStar && (
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
          )}
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
            onClick={fetchUploads}
            disabled={loading}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-xs uppercase tracking-[0.2em] transition-colors disabled:opacity-40"
          >
            {loading ? "RESCANNING..." : "RESCAN"}
          </button>
        </div>
        {headerExtra}
      </div>

      <GenreLabels selected={labels} onToggle={onToggleLabel} />

      <div className="pb-36">
        <h3 className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2">
          UPLOADS
        </h3>
        <ChannelUploadGrid
          uploads={uploads}
          playingVideoId={playingId}
          setPlayingVideoId={setPlayingId}
          loading={loading}
        />
      </div>
    </>
  );
}
