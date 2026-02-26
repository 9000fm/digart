import { useState, useCallback, useRef } from "react";
import type { CuratorData, Upload } from "../types";

interface HistoryEntry {
  id: string;
  name: string;
  decision: string;
  labels: string[];
  uploads: Upload[];
  wasStarred: boolean;
}

interface UseCuratorActionsProps {
  data: CuratorData | null;
  setData: React.Dispatch<React.SetStateAction<CuratorData | null>>;
  fetchNext: () => Promise<CuratorData>;
  fetchStats: () => Promise<void>;
  selectedLabels: Set<string>;
  isStarred: boolean;
  setIsStarred: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedLabels: React.Dispatch<React.SetStateAction<Set<string>>>;
  setPlayingVideoId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useCuratorActions({
  data,
  setData,
  fetchNext,
  fetchStats,
  selectedLabels,
  isStarred,
  setIsStarred,
  setSelectedLabels,
  setPlayingVideoId,
}: UseCuratorActionsProps) {
  const [acting, setActing] = useState(false);
  const actingRef = useRef(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [rescanning, setRescanning] = useState(false);

  const handleDecision = useCallback(
    async (decision: "approve" | "reject" | "unsubscribe") => {
      if (!data?.channel || actingRef.current) return;
      actingRef.current = true;
      setActing(true);
      const labels = decision === "approve" ? Array.from(selectedLabels) : [];
      setHistory((prev) => [
        ...prev,
        {
          id: data.channel!.id,
          name: data.channel!.name,
          decision,
          labels,
          uploads: data.uploads || [],
          wasStarred: isStarred,
        },
      ]);
      await fetch("/api/curator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: data.channel.id,
          channelName: data.channel.name,
          decision,
          labels,
        }),
      });
      actingRef.current = false;
      setActing(false);
      fetchNext();
    },
    [data, fetchNext, selectedLabels, isStarred]
  );

  const handleGoBack = useCallback(async () => {
    if (history.length === 0 || actingRef.current) return;
    actingRef.current = true;
    setActing(true);

    const last = history[history.length - 1];
    await fetch("/api/curator", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: last.id }),
    });

    setHistory((prev) => prev.slice(0, -1));
    setPlayingVideoId(null);
    setSelectedLabels(new Set(last.labels));
    setIsStarred(last.wasStarred);
    setData((prev) => ({
      reviewed: (prev?.reviewed || 1) - 1,
      total: prev?.total || 0,
      remaining: (prev?.remaining || 0) + 1,
      approvedCount:
        last.decision === "approve"
          ? (prev?.approvedCount || 1) - 1
          : prev?.approvedCount || 0,
      unsubCount:
        last.decision === "unsubscribe"
          ? (prev?.unsubCount || 1) - 1
          : prev?.unsubCount || 0,
      channel: { name: last.name, id: last.id },
      uploads: last.uploads,
    }));

    actingRef.current = false;
    setActing(false);
  }, [history, setData, setIsStarred, setSelectedLabels, setPlayingVideoId]);

  const handleToggleStar = useCallback(async () => {
    if (!data?.channel) return;
    const res = await fetch("/api/curator", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: data.channel.id,
        channelName: data.channel.name,
      }),
    });
    const result = await res.json();
    setIsStarred(result.starred);
    setData((prev) =>
      prev ? { ...prev, starredCount: result.starredCount } : prev
    );
  }, [data, setIsStarred, setData]);

  const handleSkip = useCallback(async () => {
    if (!data?.channel) return;
    await fetch("/api/curator", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: data.channel.id }),
    });
    fetchNext();
  }, [data, fetchNext]);

  const handleReviewSkipped = useCallback(async () => {
    await fetch("/api/curator", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
    fetchNext();
    fetchStats();
  }, [fetchNext, fetchStats]);

  const handleRescan = useCallback(async () => {
    if (!data?.channel || rescanning) return;
    setRescanning(true);
    const res = await fetch(
      `/api/curator?rescan=true&channelId=${data.channel.id}`
    );
    const json = await res.json();
    setData(json);
    setPlayingVideoId(null);
    setRescanning(false);
  }, [data, rescanning, setData, setPlayingVideoId]);

  return {
    acting,
    history,
    rescanning,
    handleDecision,
    handleGoBack,
    handleToggleStar,
    handleSkip,
    handleReviewSkipped,
    handleRescan,
  };
}
