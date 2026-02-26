"use client";

import type { CuratorTab } from "../types";

interface CuratorTabBarProps {
  activeTab: CuratorTab;
  onChange: (tab: CuratorTab) => void;
}

const TABS: { key: CuratorTab; label: string; shortcut: string }[] = [
  { key: "review", label: "Review", shortcut: "1" },
  { key: "approved", label: "Approved", shortcut: "2" },
  { key: "ops", label: "Ops", shortcut: "3" },
];

export function CuratorTabBar({ activeTab, onChange }: CuratorTabBarProps) {
  return (
    <div className="flex items-center gap-0 border-b border-[var(--border)] mb-4">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] border-b-2 transition-colors ${
            activeTab === tab.key
              ? "border-[var(--accent)] text-[var(--text)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {tab.label}
          <kbd className="ml-2 text-[9px] font-normal opacity-30 border border-[var(--border)] px-1 py-0.5 rounded-sm">
            {tab.shortcut}
          </kbd>
        </button>
      ))}
    </div>
  );
}
