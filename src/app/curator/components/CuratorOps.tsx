"use client";

import { useState, useEffect, useCallback } from "react";
import type { CoverageData, HealthData, CuratorTab } from "../types";
import { CoverageBar } from "./CoverageBar";
import { HealthIndicators } from "./HealthIndicators";
import { ImportTools } from "./ImportTools";
import type { useImport } from "../hooks/useImport";

interface CuratorOpsProps {
  fetchCoverage: () => Promise<CoverageData>;
  fetchHealth: () => Promise<HealthData>;
  fetchStats: () => Promise<void>;
  importProps: ReturnType<typeof useImport>;
  skippedCount: number;
  onReviewSkipped: () => void;
  setActiveTab: (tab: CuratorTab) => void;
}

export function CuratorOps({
  fetchCoverage,
  fetchHealth,
  fetchStats,
  importProps,
  skippedCount,
  onReviewSkipped,
  setActiveTab,
}: CuratorOpsProps) {
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loadingCoverage, setLoadingCoverage] = useState(true);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoadingCoverage(true);
    setLoadingHealth(true);
    fetchCoverage().then((d) => {
      setCoverage(d);
      setLoadingCoverage(false);
    });
    fetchHealth().then((d) => {
      setHealth(d);
      setLoadingHealth(false);
    });
  }, [fetchCoverage, fetchHealth]);

  const handleResolveConflict = useCallback(
    async (channelId: string, keep: "approved" | "rejected") => {
      await fetch("/api/curator", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolveConflict",
          channelId,
          keep,
        }),
      });
      // Refresh data
      fetchCoverage().then(setCoverage);
      fetchHealth().then(setHealth);
      fetchStats();
    },
    [fetchCoverage, fetchHealth, fetchStats]
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const [coverageRes, healthRes] = await Promise.all([
        fetchCoverage(),
        fetchHealth(),
      ]);
      const exportData = {
        exportedAt: new Date().toISOString(),
        total: coverageRes.total,
        approved: coverageRes.segments.approved.count,
        rejected: coverageRes.segments.rejected.count,
        unsub: coverageRes.segments.unsub.count,
        unreviewed: coverageRes.segments.unreviewed.count,
        conflicts: healthRes.conflicts.length,
        noLabels: healthRes.noLabels,
        channels: {
          approved: coverageRes.segments.approved.channels.map((c) => ({
            name: c.name,
            id: c.id,
          })),
          rejected: coverageRes.segments.rejected.channels.map((c) => ({
            name: c.name,
            id: c.id,
          })),
        },
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `curator-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [fetchCoverage, fetchHealth]);

  return (
    <div className="space-y-8 pb-8">
      {/* Section 1: Coverage */}
      <section>
        <CoverageBar data={coverage} loading={loadingCoverage} />
      </section>

      {/* Section 2: Health */}
      <section>
        <h3 className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.2em] mb-3">
          HEALTH
        </h3>
        <HealthIndicators
          data={health}
          loading={loadingHealth}
          onResolveConflict={handleResolveConflict}
          setActiveTab={setActiveTab}
        />
      </section>

      {/* Section 3: Import Tools */}
      <section>
        <h3 className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.2em] mb-3">
          IMPORT
        </h3>
        <ImportTools
          importText={importProps.importText}
          setImportText={importProps.setImportText}
          importing={importProps.importing}
          importResult={importProps.importResult}
          handleImport={importProps.handleImport}
          bookmarks={importProps.bookmarks}
          loadingBookmarks={importProps.loadingBookmarks}
          selectedBookmarks={importProps.selectedBookmarks}
          importedUrls={importProps.importedUrls}
          deleting={importProps.deleting}
          loadBookmarks={importProps.loadBookmarks}
          toggleBookmark={importProps.toggleBookmark}
          selectAllBookmarks={importProps.selectAllBookmarks}
          importSelectedBookmarks={importProps.importSelectedBookmarks}
          deleteFromChrome={importProps.deleteFromChrome}
        />
      </section>

      {/* Section 4: Quick Actions */}
      <section>
        <h3 className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.2em] mb-3">
          ACTIONS
        </h3>
        <div className="flex flex-wrap gap-3">
          {skippedCount > 0 && (
            <button
              onClick={onReviewSkipped}
              className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider bg-[var(--bg-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] rounded-lg transition-all"
            >
              RE-QUEUE {skippedCount} SKIPPED
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider bg-[var(--bg-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] rounded-lg transition-all disabled:opacity-40"
          >
            {exporting ? "EXPORTING..." : "EXPORT DATA"}
          </button>
        </div>
      </section>
    </div>
  );
}
