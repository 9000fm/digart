"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Upload {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  viewCount?: number | null;
  isTopViewed?: boolean;
}

interface CuratorData {
  channel?: { name: string; id: string };
  uploads?: Upload[];
  reviewed: number;
  total: number;
  remaining?: number;
  approvedCount?: number;
  unsubCount?: number;
  starredCount?: number;
  isStarred?: boolean;
  done?: boolean;
  skippedCount?: number;
  starredChannels?: { name: string; id: string }[];
  approvedChannels?: { name: string; id: string; labels?: string[] }[];
  rejectedCount?: number;
  unsubChannels?: { name: string; id: string }[];
}

interface ApprovedChannel {
  name: string;
  id: string;
  labels?: string[];
  isStarred?: boolean;
}

interface BookmarkEntry {
  name: string;
  url: string;
  path: string;
}

const GENRE_LABELS = [
  "House",
  "Deep House",
  "Tech House",
  "Techno",
  "Minimal",
  "Rominimal",
  "Electro",
  "Breaks",
  "DnB",
  "Jungle",
  "Garage / UKG",
  "Ambient",
  "Downtempo",
  "Dub",
  "Disco",
  "Funk",
  "Acid",
  "Trance",
  "Industrial",
  "EBM",
  "Hip Hop",
  "Jazz",
  "Reggae",
  "Pop",
  "World",
  "Experimental",
  "Samples",
  "DJ Sets",
  "Live Sets",
];

interface CuratorStats {
  imported: number;
  approved: number;
  skipped: number;
  rejected: number;
  unsub: number;
  starred: number;
  pending: number;
}

type CuratorTab = "review" | "approved";
type ApprovedFilter = "all" | "has-labels" | "no-labels" | "starred";

export default function CuratorPage() {
  const [activeTab, setActiveTab] = useState<CuratorTab>("review");
  const [data, setData] = useState<CuratorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const actingRef = useRef(false);
  const [history, setHistory] = useState<
    { id: string; name: string; decision: string; labels: string[]; uploads: Upload[]; wasStarred: boolean }[]
  >([]);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    added: string[];
    failed: string[];
  } | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[] | null>(null);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [selectedBookmarks, setSelectedBookmarks] = useState<Set<string>>(
    new Set()
  );
  const [importedUrls, setImportedUrls] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [isStarred, setIsStarred] = useState(false);

  // Stats bar state
  const [stats, setStats] = useState<CuratorStats | null>(null);
  const [reimporting, setReimporting] = useState(false);
  const [reimportResult, setReimportResult] = useState<string | null>(null);

  // Approved Browser state
  const [approvedChannels, setApprovedChannels] = useState<ApprovedChannel[]>([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [approvedFilter, setApprovedFilter] = useState<ApprovedFilter>("all");

  // Audit mode state (click channel in approved tab → full review)
  const [auditChannel, setAuditChannel] = useState<ApprovedChannel | null>(null);
  const [auditUploads, setAuditUploads] = useState<Upload[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLabels, setAuditLabels] = useState<Set<string>>(new Set());
  const [auditPlayingId, setAuditPlayingId] = useState<string | null>(null);

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setPlayingVideoId(null);
    setSelectedLabels(new Set());
    setIsStarred(false);
    const res = await fetch("/api/curator");
    const json = await res.json();
    setData(json);
    setIsStarred(json.isStarred || false);
    setLoading(false);
  }, []);

  const fetchApproved = useCallback(async () => {
    setApprovedLoading(true);
    const res = await fetch("/api/curator?mode=approved");
    const json = await res.json();
    setApprovedChannels(json.channels || []);
    setApprovedLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/curator?mode=stats");
    const json = await res.json();
    setStats(json);
  }, []);

  const handleReimport = useCallback(async () => {
    if (reimporting) return;
    setReimporting(true);
    setReimportResult(null);
    try {
      const bmRes = await fetch("/api/curator/bookmarks");
      const bmJson = await bmRes.json();
      const bookmarkUrls = (bmJson.bookmarks || []).map((b: BookmarkEntry) => b.url);
      if (bookmarkUrls.length === 0) {
        setReimportResult("No bookmarks found");
        setReimporting(false);
        return;
      }
      const importRes = await fetch("/api/curator/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: bookmarkUrls.join("\n") }),
      });
      const importJson = await importRes.json();
      const added = importJson.added?.length || 0;
      setReimportResult(added > 0 ? `Added ${added} new channel${added === 1 ? "" : "s"}` : "All up to date");
      if (added > 0) {
        fetchNext();
        fetchStats();
      }
    } catch {
      setReimportResult("Import failed");
    }
    setReimporting(false);
  }, [reimporting, fetchNext, fetchStats]);

  useEffect(() => {
    fetchNext();
    fetchStats();
  }, [fetchNext, fetchStats]);

  useEffect(() => {
    if (activeTab === "approved") fetchApproved();
  }, [activeTab, fetchApproved]);

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
      approvedCount: last.decision === "approve"
        ? (prev?.approvedCount || 1) - 1
        : prev?.approvedCount || 0,
      unsubCount: last.decision === "unsubscribe"
        ? (prev?.unsubCount || 1) - 1
        : prev?.unsubCount || 0,
      channel: { name: last.name, id: last.id },
      uploads: last.uploads,
    }));

    actingRef.current = false;
    setActing(false);
  }, [history]);

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
    setData((prev) => prev ? { ...prev, starredCount: result.starredCount } : prev);
  }, [data]);

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
    const res = await fetch(`/api/curator?rescan=true&channelId=${data.channel.id}`);
    const json = await res.json();
    setData(json);
    setPlayingVideoId(null);
    setRescanning(false);
  }, [data, rescanning]);

  // Approved tab: enter audit mode for a channel
  const handleEnterAudit = useCallback(async (ch: ApprovedChannel) => {
    setAuditChannel(ch);
    setAuditLabels(new Set(ch.labels || []));
    setAuditLoading(true);
    setAuditPlayingId(null);
    try {
      const res = await fetch(`/api/curator?rescan=true&channelId=${ch.id}`);
      const json = await res.json();
      setAuditUploads(json.uploads || []);
    } catch {
      setAuditUploads([]);
    }
    setAuditLoading(false);
  }, []);

  // Approved tab: change decision (reject or unsubscribe)
  const handleChangeDecision = useCallback(async (channelId: string, channelName: string, newDecision: "reject" | "unsubscribe") => {
    await fetch("/api/curator", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "changeDecision", channelId, channelName, newDecision }),
    });
    setApprovedChannels((prev) => prev.filter((c) => c.id !== channelId));
    setAuditChannel(null);
    setAuditUploads([]);
    setAuditPlayingId(null);
    fetchStats();
  }, [fetchStats]);

  // Approved tab: save labels on audited channel
  const handleSaveAuditLabels = useCallback(async () => {
    if (!auditChannel) return;
    const labels = Array.from(auditLabels);
    await fetch("/api/curator", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateLabels", channelId: auditChannel.id, labels }),
    });
    setApprovedChannels((prev) =>
      prev.map((c) => c.id === auditChannel.id ? { ...c, labels } : c)
    );
    setAuditChannel((prev) => prev ? { ...prev, labels } : null);
  }, [auditChannel, auditLabels]);

  // Approved tab: toggle star on audited channel
  const handleToggleStarAudit = useCallback(async () => {
    if (!auditChannel) return;
    const res = await fetch("/api/curator", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: auditChannel.id, channelName: auditChannel.name }),
    });
    const result = await res.json();
    setAuditChannel((prev) => prev ? { ...prev, isStarred: result.starred } : null);
    setApprovedChannels((prev) =>
      prev.map((c) => c.id === auditChannel.id ? { ...c, isStarred: result.starred } : c)
    );
    fetchStats();
  }, [auditChannel, fetchStats]);

  // Approved tab: rescan uploads for audited channel
  const handleAuditRescan = useCallback(async () => {
    if (!auditChannel || auditLoading) return;
    setAuditLoading(true);
    setAuditPlayingId(null);
    try {
      const res = await fetch(`/api/curator?rescan=true&channelId=${auditChannel.id}`);
      const json = await res.json();
      setAuditUploads(json.uploads || []);
    } catch {
      setAuditUploads([]);
    }
    setAuditLoading(false);
  }, [auditChannel, auditLoading]);

  const toggleLabel = (label: string) => {
    setSelectedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleImport = async () => {
    if (!importText.trim() || importing) return;
    setImporting(true);
    setImportResult(null);
    const res = await fetch("/api/curator/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: importText }),
    });
    const result = await res.json();
    setImportResult({ added: result.added, failed: result.failed });
    setImporting(false);
    if (result.added.length > 0) {
      setImportText("");
      fetchNext();
    }
  };

  const loadBookmarks = async () => {
    setLoadingBookmarks(true);
    const res = await fetch("/api/curator/bookmarks");
    const json = await res.json();
    setBookmarks(json.bookmarks || []);
    setSelectedBookmarks(new Set());
    setLoadingBookmarks(false);
  };

  const toggleBookmark = (url: string) => {
    setSelectedBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const importSelectedBookmarks = async () => {
    if (selectedBookmarks.size === 0 || importing) return;
    setImporting(true);
    setImportResult(null);
    const selectedUrls = Array.from(selectedBookmarks);
    const res = await fetch("/api/curator/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: selectedUrls.join("\n") }),
    });
    const result = await res.json();
    setImportResult({ added: result.added, failed: result.failed });
    setImporting(false);
    if (result.added.length > 0) {
      setImportedUrls((prev) => [...prev, ...selectedUrls]);
      setBookmarks(
        (prev) =>
          prev?.filter((b) => !selectedBookmarks.has(b.url)) ?? null
      );
      setSelectedBookmarks(new Set());
      fetchNext();
    }
  };

  const deleteFromChrome = async () => {
    if (importedUrls.length === 0 || deleting) return;
    setDeleting(true);
    const res = await fetch("/api/curator/bookmarks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: importedUrls }),
    });
    const result = await res.json();
    setDeleting(false);
    if (result.removed > 0) {
      setImportedUrls([]);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      // Audit mode shortcuts (approved tab)
      if (auditChannel) {
        if (e.key === "l" || e.key === "L") handleSaveAuditLabels();
        if (e.key === "r" || e.key === "R") handleChangeDecision(auditChannel.id, auditChannel.name, "reject");
        if (e.key === "u" || e.key === "U") handleChangeDecision(auditChannel.id, auditChannel.name, "unsubscribe");
        if (e.key === "f" || e.key === "F") handleToggleStarAudit();
        if (e.key === "x" || e.key === "X") handleAuditRescan();
        if (e.key === "b" || e.key === "B" || e.key === "Escape") {
          setAuditChannel(null);
          setAuditUploads([]);
          setAuditPlayingId(null);
        }
        return;
      }
      if (activeTab !== "review") return;
      if (e.key === "a" || e.key === "A") handleDecision("approve");
      if (e.key === "r" || e.key === "R") handleDecision("reject");
      if (e.key === "u" || e.key === "U") handleDecision("unsubscribe");
      if (e.key === "s" || e.key === "S") handleSkip();
      if (e.key === "b" || e.key === "B") handleGoBack();
      if (e.key === "f" || e.key === "F") handleToggleStar();
      if (e.key === "x" || e.key === "X") handleRescan();
      if (e.key === "Escape") setPlayingVideoId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDecision, handleSkip, handleGoBack, handleToggleStar, handleRescan, activeTab, auditChannel, handleSaveAuditLabels, handleChangeDecision, handleToggleStarAudit, handleAuditRescan]);

  // Filter approved channels
  const filteredApproved = approvedChannels.filter((ch) => {
    if (approvedFilter === "has-labels") return ch.labels && ch.labels.length > 0;
    if (approvedFilter === "no-labels") return !ch.labels || ch.labels.length === 0;
    if (approvedFilter === "starred") return ch.isStarred;
    return true;
  });

  const noLabelsCount = approvedChannels.filter((ch) => !ch.labels || ch.labels.length === 0).length;

  // ===== Stats bar =====
  const statsBar = stats && (
    <div className="flex items-center gap-3 mb-3 flex-wrap">
      <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)] tracking-wider">
        <span className="text-[var(--text)] font-bold">{stats.imported}</span> imported
        <span className="text-[var(--text-muted)]">&middot;</span>
        <span className="text-emerald-500 font-bold">{stats.approved}</span> approved
        <span className="text-[var(--text-muted)]">&middot;</span>
        <span className="font-bold">{stats.skipped}</span> skipped
        <span className="text-[var(--text-muted)]">&middot;</span>
        <span className="font-bold">{stats.pending}</span> pending
      </div>
      <button
        onClick={handleReimport}
        disabled={reimporting}
        className="ml-auto px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-[var(--bg-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] rounded-lg transition-all disabled:opacity-40"
      >
        {reimporting ? "SCANNING..." : "IMPORT NEW"}
      </button>
      {reimportResult && (
        <span className="text-[10px] text-[var(--text-secondary)]">{reimportResult}</span>
      )}
    </div>
  );

  // ===== Tab bar =====
  const tabBar = (
    <div className="flex items-center gap-0 border-b border-[var(--border)] mb-4">
      <button
        onClick={() => setActiveTab("review")}
        className={`px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] border-b-2 transition-colors ${
          activeTab === "review"
            ? "border-[var(--accent)] text-[var(--text)]"
            : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
      >
        Review Queue
      </button>
      <button
        onClick={() => setActiveTab("approved")}
        className={`px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] border-b-2 transition-colors ${
          activeTab === "approved"
            ? "border-[var(--accent)] text-[var(--text)]"
            : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
      >
        Approved
      </button>
    </div>
  );

  // ===== APPROVED BROWSER TAB =====
  if (activeTab === "approved") {
    // Audit mode: full review of a single approved channel
    if (auditChannel) {
      return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-mono">
          <div className="max-w-7xl mx-auto px-4 py-3 lg:px-8 lg:py-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-5">
                <button
                  onClick={() => { setAuditChannel(null); setAuditUploads([]); setAuditPlayingId(null); }}
                  className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-2xl leading-none"
                >
                  &larr;
                </button>
                <h1 className="text-lg font-bold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
                  CURATOR
                </h1>
              </div>
            </div>

            {statsBar}
            {tabBar}

            {/* Channel info */}
            <div className="mb-2">
              <div className="flex items-center gap-3 mb-0.5">
                <h2 className="text-2xl font-bold tracking-tight">
                  {auditChannel.name}
                </h2>
                <button
                  onClick={handleToggleStarAudit}
                  className={`text-2xl leading-none transition-colors ${
                    auditChannel.isStarred
                      ? "text-amber-400"
                      : "text-[var(--text-muted)] hover:text-amber-400"
                  }`}
                  title={auditChannel.isStarred ? "Unstar (F)" : "Star (F)"}
                >
                  {auditChannel.isStarred ? "\u2605" : "\u2606"}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`https://www.youtube.com/channel/${auditChannel.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-muted)] hover:text-[var(--text)] text-xs uppercase tracking-[0.2em] transition-colors"
                >
                  View on YouTube &rarr;
                </a>
                <button
                  onClick={handleAuditRescan}
                  disabled={auditLoading}
                  className="text-[var(--text-muted)] hover:text-[var(--text)] text-xs uppercase tracking-[0.2em] transition-colors disabled:opacity-40"
                >
                  {auditLoading ? "RESCANNING..." : "RESCAN"}
                </button>
              </div>
            </div>

            {/* Tags */}
            <div className="mb-3">
              <div className="flex flex-wrap gap-1.5">
                {GENRE_LABELS.map((label) => (
                  <button
                    key={label}
                    onClick={() => {
                      setAuditLabels((prev) => {
                        const next = new Set(prev);
                        if (next.has(label)) next.delete(label);
                        else next.add(label);
                        return next;
                      });
                    }}
                    className={`px-2.5 py-1 text-[10px] rounded-full transition-all duration-150 ${
                      auditLabels.has(label)
                        ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-sm"
                        : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-secondary)] hover:text-[var(--text)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {auditLabels.size > 0 && (
                <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                  {Array.from(auditLabels).join("  \u00b7  ")}
                </p>
              )}
            </div>

            {/* Uploads */}
            <div className="pb-36">
              <h3 className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2">
                UPLOADS
              </h3>
              {auditLoading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="animate-pulse text-[var(--text-muted)]">LOADING UPLOADS...</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {auditUploads.map((upload) => (
                    <div key={upload.id} className="rounded-lg overflow-hidden bg-[var(--bg-alt)]">
                      {auditPlayingId === upload.id ? (
                        <div>
                          <div className="relative w-full aspect-video bg-black">
                            <iframe
                              src={`https://www.youtube.com/embed/${upload.id}?autoplay=1&rel=0`}
                              allow="autoplay; encrypted-media"
                              allowFullScreen
                              className="absolute inset-0 w-full h-full"
                            />
                          </div>
                          <div className="flex items-center justify-between px-2 py-1.5">
                            <span className="text-[10px] leading-tight truncate flex-1 text-[var(--text-secondary)]">
                              {upload.title}
                            </span>
                            <button
                              onClick={() => setAuditPlayingId(null)}
                              className="shrink-0 ml-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                            >
                              STOP
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAuditPlayingId(upload.id)}
                          className="w-full text-left transition-all duration-200 group hover:ring-2 hover:ring-[var(--accent)]/20 rounded-lg"
                        >
                          <div className="relative w-full aspect-video overflow-hidden">
                            <img
                              src={upload.thumbnail}
                              alt={upload.title}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            {upload.isTopViewed && (
                              <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 bg-amber-500 text-black font-mono text-[9px] font-bold uppercase tracking-wider">
                                TOP
                              </span>
                            )}
                            {upload.viewCount != null && upload.viewCount > 0 && (
                              <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 bg-black/70 text-white font-mono text-[9px] rounded-sm backdrop-blur-sm inline-flex items-center gap-1">
                                <svg className="w-2.5 h-2.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                                {upload.viewCount >= 1_000_000
                                  ? `${(upload.viewCount / 1_000_000).toFixed(1)}M`
                                  : upload.viewCount >= 1_000
                                    ? `${(upload.viewCount / 1_000).toFixed(0)}K`
                                    : upload.viewCount}
                              </span>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                              <span className="w-9 h-9 flex items-center justify-center bg-white/90 rounded-full text-black text-sm opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100">
                                &#9654;
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] leading-snug px-2 py-1.5 text-[var(--text-secondary)] line-clamp-2">
                            {upload.title}
                          </p>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!auditLoading && auditUploads.length === 0 && (
                <p className="text-[var(--text-muted)] text-sm py-4">
                  No uploads found for this channel
                </p>
              )}
            </div>
          </div>

          {/* Fixed bottom audit action bar */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg)] border-t border-[var(--border)]">
            <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3">
              {/* Row 1: SAVE LABELS + REJECT + UNSUB */}
              <div className="flex gap-3 mb-2">
                <button
                  onClick={handleSaveAuditLabels}
                  className="relative flex-[2] flex items-center rounded-none bg-emerald-600 text-white transition-all duration-100 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] active:scale-[0.93] active:shadow-none"
                >
                  <div className="w-1.5 self-stretch bg-emerald-400 shrink-0" />
                  <div className="flex-1 flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm font-bold uppercase tracking-[0.15em]">SAVE LABELS</span>
                    <kbd className="text-[9px] font-normal opacity-60 border border-current/20 px-1.5 py-0.5">L</kbd>
                  </div>
                </button>
                <button
                  onClick={() => handleChangeDecision(auditChannel.id, auditChannel.name, "reject")}
                  className="relative flex-1 flex items-center rounded-none bg-[var(--bg-alt)] text-[var(--text-muted)] transition-all duration-100 hover:text-[var(--text)] hover:bg-[var(--border)] active:scale-[0.93]"
                >
                  <div className="w-1 self-stretch bg-[var(--text-muted)] shrink-0" />
                  <div className="flex-1 flex items-center justify-between px-3 py-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider">&times; REJECT</span>
                    <kbd className="text-[9px] font-normal opacity-40 border border-[var(--border)] px-1.5 py-0.5">R</kbd>
                  </div>
                </button>
                <button
                  onClick={() => handleChangeDecision(auditChannel.id, auditChannel.name, "unsubscribe")}
                  className="relative flex-1 flex items-center rounded-none bg-red-500/5 text-red-400 transition-all duration-100 hover:bg-red-500 hover:text-white active:scale-[0.93]"
                >
                  <div className="w-1 self-stretch bg-red-500 shrink-0" />
                  <div className="flex-1 flex items-center justify-between px-3 py-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider">&oslash; UNSUB</span>
                    <kbd className="text-[9px] font-normal opacity-40 border border-current/20 px-1.5 py-0.5">U</kbd>
                  </div>
                </button>
              </div>
              {/* Row 2: BACK + legend */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setAuditChannel(null); setAuditUploads([]); setAuditPlayingId(null); }}
                  className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-[var(--text-muted)] rounded-none border border-transparent transition-all duration-100 hover:border-[var(--border)] hover:text-[var(--text)] active:scale-[0.93]"
                >
                  <span className="inline-flex items-center gap-2">
                    &larr; BACK <kbd className="text-[9px] opacity-40 border border-[var(--border)] px-1 py-0.5">ESC</kbd>
                  </span>
                </button>
                <div className="ml-auto flex items-center gap-3 text-[var(--text-muted)] text-[11px] tracking-wider uppercase">
                  <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">L</kbd>Save</span>
                  <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">R</kbd>Reject</span>
                  <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">U</kbd>Unsub</span>
                  <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">F</kbd>Star</span>
                  <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">X</kbd>Rescan</span>
                  <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">B</kbd>Back</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Approved list view
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-mono">
        <div className="max-w-7xl mx-auto px-4 py-3 lg:px-8 lg:py-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-5">
              <a
                href="/"
                className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-2xl leading-none"
              >
                &larr;
              </a>
              <h1 className="text-lg font-bold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
                CURATOR
              </h1>
            </div>
          </div>

          {statsBar}
          {tabBar}

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(
              [
                { key: "all", label: "All", count: approvedChannels.length },
                { key: "has-labels", label: "Has Labels", count: approvedChannels.length - noLabelsCount },
                { key: "no-labels", label: "No Labels", count: noLabelsCount },
                { key: "starred", label: "Starred", count: approvedChannels.filter((c) => c.isStarred).length },
              ] as { key: ApprovedFilter; label: string; count: number }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setApprovedFilter(f.key)}
                className={`px-3 py-1.5 text-[10px] rounded-full transition-all duration-150 ${
                  approvedFilter === f.key
                    ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-sm"
                    : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Channels grid */}
          {approvedLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="animate-pulse text-[var(--text-muted)]">LOADING...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-8">
              {filteredApproved.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleEnterAudit(ch)}
                  className="rounded-lg border border-[var(--border)] hover:border-[var(--text-muted)] p-3 text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-[var(--text)] group-hover:text-emerald-500 transition-colors truncate block">
                        {ch.name}
                      </span>
                      {ch.labels && ch.labels.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ch.labels.map((l) => (
                            <span
                              key={l}
                              className="text-[8px] px-1.5 py-0.5 bg-[var(--bg-alt)] text-[var(--text-muted)] rounded uppercase tracking-wider"
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] text-[var(--text-muted)]/50 uppercase tracking-wider mt-1 block">
                          No labels
                        </span>
                      )}
                    </div>
                    {ch.isStarred && (
                      <span className="text-amber-400 text-sm leading-none shrink-0">&#9733;</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {!approvedLoading && filteredApproved.length === 0 && (
            <p className="text-[var(--text-muted)] text-sm py-8 text-center">
              No approved channels yet
            </p>
          )}
        </div>
      </div>
    );
  }

  // ===== REVIEW QUEUE TAB (existing behavior) =====
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center font-mono">
        <span className="animate-pulse">LOADING...</span>
      </div>
    );
  }

  if (data?.done) {
    const skippedCount = data.skippedCount || 0;

    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-mono">
        <div className="max-w-7xl mx-auto px-4 py-3 lg:px-8 lg:py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-5">
              <a
                href="/"
                className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-2xl leading-none"
              >
                &larr;
              </a>
              <h1 className="text-lg font-bold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
                CURATOR
              </h1>
            </div>
          </div>

          {statsBar}
          {tabBar}

          <div className="max-w-2xl mx-auto py-12 space-y-8">
            {/* Caught up header */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-wider">ALL CAUGHT UP</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {data.approvedCount} approved &middot; {data.total} total
              </p>
            </div>

            {/* Review skipped */}
            {skippedCount > 0 && (
              <div className="flex items-center justify-center">
                <button
                  onClick={handleReviewSkipped}
                  className="px-6 py-2.5 text-sm font-bold uppercase tracking-[0.15em] bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-80 transition-opacity rounded-lg"
                >
                  REVIEW {skippedCount} SKIPPED
                </button>
              </div>
            )}

            {/* Import section — always visible */}
            <div className="space-y-6">
              {/* Paste URLs */}
              <div>
                <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-2">
                  PASTE URLS
                </h4>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={"https://youtube.com/@BoilerRoom\nhttps://youtube.com/channel/UCxxxxxxx\n@Cercle"}
                  className="w-full h-24 p-3 bg-[var(--bg-alt)] border border-[var(--border)] rounded-lg font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--text-secondary)] transition-colors"
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={handleImport}
                    disabled={importing || !importText.trim()}
                    className="px-3 py-1.5 bg-[var(--accent)] text-[var(--accent-text)] font-mono text-[10px] uppercase tracking-wider rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    {importing ? "IMPORTING..." : "IMPORT"}
                  </button>
                </div>
                {importResult && importResult.added.length > 0 && (
                  <div className="text-xs text-emerald-500 mt-2">
                    Added: {importResult.added.join(", ")}
                  </div>
                )}
                {importResult && importResult.failed.length > 0 && (
                  <div className="text-xs text-red-400 mt-2">
                    Failed: {importResult.failed.join(", ")}
                  </div>
                )}
              </div>

              {/* Chrome bookmarks */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-widest">
                    FROM CHROME BOOKMARKS
                  </h4>
                  <button
                    onClick={loadBookmarks}
                    disabled={loadingBookmarks}
                    className="px-3 py-1 bg-[var(--bg-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-secondary)] font-mono text-[10px] uppercase tracking-wider rounded-lg transition-all disabled:opacity-40"
                  >
                    {loadingBookmarks ? "SCANNING..." : bookmarks ? "REFRESH" : "SCAN BOOKMARKS"}
                  </button>
                </div>

                {bookmarks && bookmarks.length > 0 && (
                  <>
                    <div className="max-h-60 overflow-y-auto space-y-1 border border-[var(--border)] rounded-lg p-2">
                      {bookmarks.map((b) => (
                        <label
                          key={b.url}
                          className="flex items-start gap-2 p-2 rounded hover:bg-[var(--bg-alt)] cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBookmarks.has(b.url)}
                            onChange={() => toggleBookmark(b.url)}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="block truncate text-[var(--text)]">{b.name}</span>
                            <span className="block truncate text-[var(--text-muted)] text-[10px]">{b.path} &middot; {b.url}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => {
                          if (selectedBookmarks.size === bookmarks.length) {
                            setSelectedBookmarks(new Set());
                          } else {
                            setSelectedBookmarks(new Set(bookmarks.map((b) => b.url)));
                          }
                        }}
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] uppercase tracking-wider transition-colors"
                      >
                        {selectedBookmarks.size === bookmarks.length ? "DESELECT ALL" : "SELECT ALL"}
                      </button>
                      <button
                        onClick={importSelectedBookmarks}
                        disabled={importing || selectedBookmarks.size === 0}
                        className="px-3 py-1 bg-[var(--accent)] text-[var(--accent-text)] font-mono text-[10px] uppercase tracking-wider rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
                      >
                        {importing ? "IMPORTING..." : `IMPORT ${selectedBookmarks.size} SELECTED`}
                      </button>
                    </div>
                  </>
                )}
                {bookmarks && bookmarks.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">No YouTube channel bookmarks found</p>
                )}
              </div>

              {/* Delete imported from Chrome */}
              {importedUrls.length > 0 && (
                <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
                  <button
                    onClick={deleteFromChrome}
                    disabled={deleting}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-mono text-[10px] uppercase tracking-wider rounded-lg transition-colors disabled:opacity-40"
                  >
                    {deleting ? "DELETING..." : `DELETE ${importedUrls.length} FROM CHROME BOOKMARKS`}
                  </button>
                  <span className="text-[10px] text-[var(--text-muted)]">Close Chrome first for best results</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const channel = data?.channel;
  const uploads = data?.uploads || [];
  const progress = data ? Math.round((data.reviewed / data.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-mono">
      <div className="max-w-7xl mx-auto px-4 py-3 lg:px-8 lg:py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-5">
            <a
              href="/"
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-2xl leading-none"
              title="Back to home"
            >
              &larr;
            </a>
            <h1 className="text-lg font-bold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
              CURATOR
            </h1>
          </div>
          <div className="text-right space-y-1">
            <span className="text-[var(--text)] text-sm font-bold block tabular-nums">
              {data?.reviewed}
              <span className="text-[var(--text-muted)] font-normal">
                {" "}/ {data?.total}
              </span>
            </span>
            <span className="text-[var(--text-muted)] text-[11px] tracking-wide">
              {data?.approvedCount} approved · {data?.starredCount || 0} starred · {data?.unsubCount} unsub ·{" "}
              {data?.remaining} left
            </span>
          </div>
        </div>

        {statsBar}
        {tabBar}

        {/* Progress bar */}
        <div className="w-full h-px bg-[var(--border)] mb-2 relative">
          <div
            className="absolute top-0 left-0 h-[3px] -translate-y-[1px] bg-[var(--accent)] transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Import section */}
        <div className="mb-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] font-mono uppercase tracking-[0.2em] transition-colors"
          >
            {showImport ? "- HIDE IMPORT" : "+ IMPORT CHANNELS"}
          </button>

          {showImport && (
            <div className="mt-4 space-y-6">
              {/* Chrome bookmarks */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-widest">
                    FROM CHROME BOOKMARKS
                  </h4>
                  <button
                    onClick={loadBookmarks}
                    disabled={loadingBookmarks}
                    className="px-3 py-1 bg-[var(--accent)] text-[var(--accent-text)] font-mono text-[10px] uppercase tracking-wider rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    {loadingBookmarks
                      ? "SCANNING..."
                      : bookmarks
                        ? "REFRESH"
                        : "SCAN BOOKMARKS"}
                  </button>
                </div>

                {bookmarks && bookmarks.length > 0 && (
                  <>
                    <div className="max-h-60 overflow-y-auto space-y-1 border border-[var(--border)] rounded-lg p-2">
                      {bookmarks.map((b) => (
                        <label
                          key={b.url}
                          className="flex items-start gap-2 p-2 rounded hover:bg-[var(--bg-alt)] cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBookmarks.has(b.url)}
                            onChange={() => toggleBookmark(b.url)}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="block truncate text-[var(--text)]">
                              {b.name}
                            </span>
                            <span className="block truncate text-[var(--text-muted)] text-[10px]">
                              {b.path} · {b.url}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => {
                          if (selectedBookmarks.size === bookmarks.length) {
                            setSelectedBookmarks(new Set());
                          } else {
                            setSelectedBookmarks(
                              new Set(bookmarks.map((b) => b.url))
                            );
                          }
                        }}
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] uppercase tracking-wider transition-colors"
                      >
                        {selectedBookmarks.size === bookmarks.length
                          ? "DESELECT ALL"
                          : "SELECT ALL"}
                      </button>
                      <button
                        onClick={importSelectedBookmarks}
                        disabled={importing || selectedBookmarks.size === 0}
                        className="px-3 py-1 bg-[var(--accent)] text-[var(--accent-text)] font-mono text-[10px] uppercase tracking-wider rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
                      >
                        {importing
                          ? "IMPORTING..."
                          : `IMPORT ${selectedBookmarks.size} SELECTED`}
                      </button>
                    </div>
                  </>
                )}
                {bookmarks && bookmarks.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">
                    No YouTube channel bookmarks found
                  </p>
                )}
              </div>

              {/* Paste URLs */}
              <div>
                <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-2">
                  PASTE URLS
                </h4>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={
                    "https://youtube.com/@BoilerRoom\nhttps://youtube.com/channel/UCxxxxxxx\n@Cercle"
                  }
                  className="w-full h-24 p-3 bg-[var(--bg-alt)] border border-[var(--border)] rounded-lg font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--text-secondary)] transition-colors"
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={handleImport}
                    disabled={importing || !importText.trim()}
                    className="px-3 py-1 bg-[var(--accent)] text-[var(--accent-text)] font-mono text-[10px] uppercase tracking-wider rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    {importing ? "IMPORTING..." : "IMPORT"}
                  </button>
                </div>
              </div>

              {/* Import results */}
              {importResult && importResult.added.length > 0 && (
                <div className="text-xs text-emerald-500">
                  Added: {importResult.added.join(", ")}
                </div>
              )}
              {importResult && importResult.failed.length > 0 && (
                <div className="text-xs text-red-400">
                  Failed: {importResult.failed.join(", ")}
                </div>
              )}

              {/* Delete imported from Chrome */}
              {importedUrls.length > 0 && (
                <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
                  <button
                    onClick={deleteFromChrome}
                    disabled={deleting}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-mono text-[10px] uppercase tracking-wider rounded-lg transition-colors disabled:opacity-40"
                  >
                    {deleting
                      ? "DELETING..."
                      : `DELETE ${importedUrls.length} FROM CHROME BOOKMARKS`}
                  </button>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Close Chrome first for best results
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {channel && (
          <>
            {/* Channel info */}
            <div className="mb-2">
              <div className="flex items-center gap-3 mb-0.5">
                <h2 className="text-2xl font-bold tracking-tight">
                  {channel.name}
                </h2>
                <button
                  onClick={handleToggleStar}
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
                  onClick={handleRescan}
                  disabled={rescanning}
                  className="text-[var(--text-muted)] hover:text-[var(--text)] text-xs uppercase tracking-[0.2em] transition-colors disabled:opacity-40"
                >
                  {rescanning ? "RESCANNING..." : "RESCAN"}
                </button>
              </div>
            </div>

            {/* Tags */}
            <div className="mb-3">
              <div className="flex flex-wrap gap-1.5">
                {GENRE_LABELS.map((label) => (
                  <button
                    key={label}
                    onClick={() => toggleLabel(label)}
                    className={`px-2.5 py-1 text-[10px] rounded-full transition-all duration-150 ${
                      selectedLabels.has(label)
                        ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-sm"
                        : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-secondary)] hover:text-[var(--text)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {selectedLabels.size > 0 && (
                <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                  {Array.from(selectedLabels).join("  \u00b7  ")}
                </p>
              )}
            </div>

            {/* Uploads */}
            <div className="pb-36">
              <h3 className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2">
                UPLOADS
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="rounded-lg overflow-hidden bg-[var(--bg-alt)]"
                  >
                    {playingVideoId === upload.id ? (
                      <div>
                        <div className="relative w-full aspect-video bg-black">
                          <iframe
                            src={`https://www.youtube.com/embed/${upload.id}?autoplay=1&rel=0`}
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                            className="absolute inset-0 w-full h-full"
                          />
                        </div>
                        <div className="flex items-center justify-between px-2 py-1.5">
                          <span className="text-[10px] leading-tight truncate flex-1 text-[var(--text-secondary)]">
                            {upload.title}
                          </span>
                          <button
                            onClick={() => setPlayingVideoId(null)}
                            className="shrink-0 ml-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                          >
                            STOP
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPlayingVideoId(upload.id)}
                        className="w-full text-left transition-all duration-200 group hover:ring-2 hover:ring-[var(--accent)]/20 rounded-lg"
                      >
                        <div className="relative w-full aspect-video overflow-hidden">
                          <img
                            src={upload.thumbnail}
                            alt={upload.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {upload.isTopViewed && (
                            <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 bg-amber-500 text-black font-mono text-[9px] font-bold uppercase tracking-wider">
                              TOP
                            </span>
                          )}
                          {upload.viewCount != null && upload.viewCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 bg-black/70 text-white font-mono text-[9px] rounded-sm backdrop-blur-sm inline-flex items-center gap-1">
                              <svg className="w-2.5 h-2.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              {upload.viewCount >= 1_000_000
                                ? `${(upload.viewCount / 1_000_000).toFixed(1)}M`
                                : upload.viewCount >= 1_000
                                  ? `${(upload.viewCount / 1_000).toFixed(0)}K`
                                  : upload.viewCount}
                            </span>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                            <span className="w-9 h-9 flex items-center justify-center bg-white/90 rounded-full text-black text-sm opacity-0 group-hover:opacity-100 transition-all duration-200 scale-90 group-hover:scale-100">
                              ▶
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-snug px-2 py-1.5 text-[var(--text-secondary)] line-clamp-2">
                          {upload.title}
                        </p>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {uploads.length === 0 && (
                <p className="text-[var(--text-muted)] text-sm py-4">
                  No uploads found for this channel
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Fixed bottom action bar */}
      {channel && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg)] border-t border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3">
            {/* Row 1: APPROVE + REJECT + UNSUB */}
            <div className="flex gap-3 mb-2">
              <button
                onClick={() => handleDecision("approve")}
                disabled={acting}
                className="relative flex-[2] flex items-center rounded-none bg-[var(--accent)] text-[var(--accent-text)] transition-all duration-100 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] active:scale-[0.93] active:shadow-none disabled:opacity-30 disabled:hover:shadow-none disabled:active:scale-100"
              >
                <div className="w-1.5 self-stretch bg-emerald-400 shrink-0" />
                <div className="flex-1 flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm font-bold uppercase tracking-[0.15em]">+ APPROVE</span>
                  <kbd className="text-[9px] font-normal opacity-60 border border-current/20 px-1.5 py-0.5">A</kbd>
                </div>
              </button>
              <button
                onClick={() => handleDecision("reject")}
                disabled={acting}
                className="relative flex-1 flex items-center rounded-none bg-[var(--bg-alt)] text-[var(--text-muted)] transition-all duration-100 hover:text-[var(--text)] hover:bg-[var(--border)] active:scale-[0.93] disabled:opacity-30 disabled:active:scale-100"
              >
                <div className="w-1 self-stretch bg-[var(--text-muted)] shrink-0" />
                <div className="flex-1 flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider">&times; REJECT</span>
                  <kbd className="text-[9px] font-normal opacity-40 border border-[var(--border)] px-1.5 py-0.5">R</kbd>
                </div>
              </button>
              <button
                onClick={() => handleDecision("unsubscribe")}
                disabled={acting}
                className="relative flex-1 flex items-center rounded-none bg-red-500/5 text-red-400 transition-all duration-100 hover:bg-red-500 hover:text-white active:scale-[0.93] disabled:opacity-30 disabled:active:scale-100"
              >
                <div className="w-1 self-stretch bg-red-500 shrink-0" />
                <div className="flex-1 flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider">&oslash; UNSUB</span>
                  <kbd className="text-[9px] font-normal opacity-40 border border-current/20 px-1.5 py-0.5">U</kbd>
                </div>
              </button>
            </div>
            {/* Row 2: SKIP + GO BACK + session info */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSkip}
                className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-[var(--text-muted)] rounded-none border border-transparent transition-all duration-100 hover:border-[var(--border)] hover:text-[var(--text)] active:scale-[0.93]"
              >
                <span className="inline-flex items-center gap-2">
                  SKIP <kbd className="text-[9px] opacity-40 border border-[var(--border)] px-1 py-0.5">S</kbd>
                </span>
              </button>
              <button
                onClick={handleGoBack}
                disabled={acting || history.length === 0}
                className="py-1.5 px-4 text-[11px] uppercase tracking-wider text-[var(--text-muted)] rounded-none border border-transparent transition-all duration-100 hover:border-[var(--border)] hover:text-[var(--text)] active:scale-[0.93] disabled:opacity-20 disabled:hover:border-transparent disabled:cursor-default"
              >
                <span className="inline-flex items-center gap-2">
                  GO BACK <kbd className="text-[9px] opacity-40 border border-[var(--border)] px-1 py-0.5">B</kbd>
                </span>
              </button>
              <div className="ml-auto flex items-center gap-3 text-[var(--text-muted)] text-[11px] tracking-wider uppercase">
                <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">A</kbd>Approve</span>
                <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">R</kbd>Reject</span>
                <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">U</kbd>Unsub</span>
                <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">S</kbd>Skip</span>
                <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">B</kbd>Back</span>
                <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">F</kbd>Flag</span>
                <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">X</kbd>Rescan</span>
                <span><kbd className="text-[9px] opacity-50 border border-[var(--border)] px-1 py-0.5 rounded-sm mr-1">ESC</kbd>Close</span>
                {history.length > 0 && (
                  <span className="text-[var(--text-secondary)] ml-1 tabular-nums">{history.length} reviewed</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
