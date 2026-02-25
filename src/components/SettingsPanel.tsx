"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeProvider";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

export default function SettingsPanel({ open, onClose, anchorRect }: SettingsPanelProps) {
  const { theme, toggleTheme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener("mousedown", handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Overlay — subtle */}
      <div
        className="fixed inset-0 z-[70]"
        onClick={onClose}
      />

      {/* Floating card — anchored to gear icon */}
      <div
        ref={panelRef}
        className="fixed z-[80] w-[240px] bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
        style={
          anchorRect
            ? {
                // Desktop: position relative to gear icon
                top: anchorRect.top - 8,
                left: anchorRect.right + 12,
                transform: "translateY(-100%)",
              }
            : {
                // Mobile fallback: slide from left
                top: "auto",
                bottom: 80,
                left: 12,
              }
        }
      >
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-mono text-[10px] font-bold text-[var(--text)] uppercase tracking-widest">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-alt)] transition-colors"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Theme toggle */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[var(--text)]">
              Theme
            </span>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-xs text-[var(--text)] hover:border-[var(--text-muted)] active:scale-95 transition-all duration-100"
            >
              <span className="text-base">
                {theme === "light" ? "☀" : "☾"}
              </span>
              {theme === "light" ? "Light" : "Dark"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
