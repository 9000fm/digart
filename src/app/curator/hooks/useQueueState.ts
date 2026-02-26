import { useState, useCallback, useMemo } from "react";
import type { ApprovedChannel } from "../types";

export function useQueueState(initialChannels: ApprovedChannel[]) {
  const [channels, setChannels] = useState(initialChannels);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  const current = channels[index] ?? null;
  const isDone = channels.length === 0 || index >= channels.length;
  const canGoBack = history.length > 0;
  const progress = useMemo(
    () => ({ index: Math.min(index, channels.length - 1), total: channels.length }),
    [index, channels.length]
  );

  const advance = useCallback(() => {
    setHistory((h) => [...h, index]);
    setIndex((i) => i + 1);
  }, [index]);

  const remove = useCallback(() => {
    setChannels((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    // index stays the same — next item slides into current position
    // but clear forward history since the list changed
    setHistory((h) => [...h, index]);
  }, [index]);

  const goBack = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = [...h];
      const lastIdx = prev.pop()!;
      setIndex(lastIdx);
      return prev;
    });
  }, []);

  return { current, progress, advance, remove, goBack, canGoBack, isDone, channels };
}
