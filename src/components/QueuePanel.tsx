"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CardData } from "@/lib/types";

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
  queue: string[];
  currentIndex: number;
  cardRegistry: Map<string, CardData>;
  onPlayIndex: (index: number) => void;
}

function QueueRow({ card, isCurrent, dimmed, onClick, isMobile = false }: {
  card: CardData;
  isCurrent: boolean;
  dimmed: boolean;
  onClick: () => void;
  isMobile?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
        isCurrent
          ? "bg-[var(--text)]/90 text-[var(--bg)]"
          : "hover:bg-[var(--bg-alt)]/60"
      } ${dimmed ? "opacity-50" : ""}`}
    >
      <img
        src={card.imageSmall || card.image}
        alt=""
        className="w-9 h-9 rounded-md object-cover shrink-0"
      />
      <div className={`min-w-0 text-left ${isCurrent && isMobile ? "" : "flex-1"}`}>
        <p className={`font-mono text-[13px] uppercase truncate leading-tight font-bold ${
          isCurrent ? "text-[var(--bg)]" : "text-[var(--text)]"
        }`}>
          {card.name}
        </p>
        <p className={`font-mono text-[10px] uppercase truncate leading-tight font-bold tracking-widest ${
          isCurrent ? "text-[var(--bg)]/60" : "text-[var(--text)]/60"
        }`}>
          {card.artist}
        </p>
      </div>
      {isCurrent && (
        <div className={`shrink-0 flex flex-col items-center ${isMobile ? "ml-4" : ""}`}>
          <div className="flex items-end gap-[2px] h-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={`eq-bar-base w-[1.5px] bg-[var(--bg)] rounded-full eq-bar-${n}`} />
            ))}
          </div>
          <div className="flex items-start gap-[2px] h-1.5 opacity-25 overflow-hidden">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={`eq-bar-base w-[1.5px] bg-[var(--bg)] rounded-full eq-bar-${n}`} style={{ transformOrigin: "top" }} />
            ))}
          </div>
        </div>
      )}
    </button>
  );
}

export default function QueuePanel({
  isOpen,
  onClose,
  queue,
  currentIndex,
  cardRegistry,
  onPlayIndex,
}: QueuePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1152);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Auto-dismiss after 10s of inactivity (desktop/tablet only)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetIdleTimer = useCallback(() => {
    if (isMobile) return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => onClose(), 10000);
  }, [isMobile, onClose]);

  useEffect(() => {
    if (isOpen && !isMobile) resetIdleTimer();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [isOpen, isMobile, resetIdleTimer, queue, currentIndex]);

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen, isMobile]);

  // Desktop: 4 prev + 1 current + 5 next. Mobile: 3 prev + 1 current + 4 next.
  const prevCount = isMobile ? 2 : 4;
  const nextCount = isMobile ? 3 : 5;

  const previousTracks = queue.slice(Math.max(0, currentIndex - prevCount), currentIndex).map((id, i) => ({ id, index: Math.max(0, currentIndex - prevCount) + i, card: cardRegistry.get(id) })).filter(t => t.card);
  const currentTrack = currentIndex >= 0 && currentIndex < queue.length ? { id: queue[currentIndex], card: cardRegistry.get(queue[currentIndex]) } : null;
  const upNextTracks = queue.slice(currentIndex + 1, currentIndex + 1 + nextCount).map((id, i) => ({ id, index: currentIndex + 1 + i, card: cardRegistry.get(id) })).filter(t => t.card);

  // Asymmetric warm: previous fades more, up next holds bright, edges dip
  const prevOpacities = isMobile ? [0.22, 0.85] : [0.22, 0.77, 0.85, 0.92];
  const nextOpacities = isMobile ? [0.95, 0.85, 0.40] : [0.98, 0.95, 0.95, 0.85, 0.40];
  const prevFade = (dist: number) => prevOpacities[prevCount - dist] ?? 0.80;
  const nextFade = (dist: number) => nextOpacities[dist - 1] ?? 0.80;

  const layoutAnim = { type: "spring" as const, stiffness: 300, damping: 24, mass: 1.2 };

  // Build one flat list so framer-motion can track each track across sections
  const rows: { id: string; index: number; card: CardData; section: "prev" | "current" | "next"; dist: number }[] = [];
  for (const t of previousTracks) {
    rows.push({ id: t.id, index: t.index, card: t.card!, section: "prev", dist: previousTracks.length - previousTracks.indexOf(t) });
  }
  if (currentTrack?.card) {
    rows.push({ id: currentTrack.id, index: currentIndex, card: currentTrack.card, section: "current", dist: 0 });
  }
  for (const t of upNextTracks) {
    rows.push({ id: t.id, index: t.index, card: t.card!, section: "next", dist: upNextTracks.indexOf(t) + 1 });
  }

  const content = (
    <div ref={scrollRef} className="overflow-hidden px-2 py-2">
      {rows.map((row, i) => {
        // Insert section headers at boundaries
        const prevRow = rows[i - 1];
        const showPrevHeader = row.section === "prev" && (!prevRow || prevRow.section !== "prev");
        const showCurrentHeader = row.section === "current";
        const showNextHeader = row.section === "next" && prevRow?.section !== "next";

        const opacity = row.section === "prev" ? prevFade(row.dist)
          : row.section === "next" ? nextFade(row.dist)
          : 1;

        return (
          <motion.div key={row.id} layout transition={layoutAnim}>
            {showPrevHeader && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text)]/70 font-bold px-3 pb-1">Previously played</p>
            )}
            {showCurrentHeader && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text)]/70 font-bold px-3 pt-1.5 pb-1">Now playing</p>
            )}
            {showNextHeader && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text)]/70 font-bold px-3 pt-1.5 pb-1">Up next</p>
            )}
            <div style={{ opacity }}>
              <QueueRow
                card={row.card}
                isCurrent={row.section === "current"}
                dimmed={row.section === "prev"}
                onClick={row.section === "current" ? () => {} : () => onPlayIndex(row.index)}
                isMobile={row.section === "current" ? isMobile : false}
              />
            </div>
          </motion.div>
        );
      })}

      {queue.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <p className="font-mono text-[11px] uppercase text-[var(--text-muted)]">No queue</p>
        </div>
      )}
    </div>
  );

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-[70] bg-[var(--bg-alt)] border-t border-[var(--border)]/50 rounded-t-2xl shadow-2xl overflow-y-auto overscroll-contain"
              style={{ maxHeight: "65vh" }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-2.5 pb-1 cursor-pointer" onClick={onClose}>
                <div className="w-8 h-1 rounded-full bg-[var(--text-muted)]/30" />
              </div>
              <div className="px-1 pb-2">
                <p className="font-mono text-xs uppercase tracking-wider text-[var(--text)] font-bold px-4 py-2">Queue</p>
                {content}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: anchored panel — non-modal, player stays interactive
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed right-14 min-[1152px]:right-16 w-[360px] z-[60] bg-[var(--bg-alt)]/40 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden"
          style={{ bottom: "calc(var(--player-height) + 8px)" }}
          onMouseEnter={resetIdleTimer}
          onMouseMove={resetIdleTimer}
        >
          <div className="px-1 py-2">
            <div className="flex items-center justify-between px-4 py-1.5">
              <p className="font-mono text-xs uppercase tracking-wider text-[var(--text)] font-bold">Queue</p>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--text)]/10 active:scale-95 transition-all duration-150 cursor-pointer" aria-label="Close queue">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            {content}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
