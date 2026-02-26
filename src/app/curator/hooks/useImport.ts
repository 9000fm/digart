import { useState, useCallback } from "react";
import type { BookmarkEntry } from "../types";

interface UseImportProps {
  fetchNext: () => Promise<unknown>;
  fetchStats: () => Promise<void>;
}

export function useImport({ fetchNext, fetchStats }: UseImportProps) {
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    added: string[];
    failed: string[];
  } | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[] | null>(null);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [selectedBookmarks, setSelectedBookmarks] = useState<Set<string>>(
    new Set()
  );
  const [importedUrls, setImportedUrls] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [reimporting, setReimporting] = useState(false);
  const [reimportResult, setReimportResult] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
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
      fetchStats();
    }
  }, [importText, importing, fetchNext, fetchStats]);

  const loadBookmarks = useCallback(async () => {
    setLoadingBookmarks(true);
    const res = await fetch("/api/curator/bookmarks");
    const json = await res.json();
    setBookmarks(json.bookmarks || []);
    setSelectedBookmarks(new Set());
    setLoadingBookmarks(false);
  }, []);

  const toggleBookmark = useCallback((url: string) => {
    setSelectedBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const selectAllBookmarks = useCallback(() => {
    if (!bookmarks) return;
    setSelectedBookmarks((prev) => {
      if (prev.size === bookmarks.length) return new Set();
      return new Set(bookmarks.map((b) => b.url));
    });
  }, [bookmarks]);

  const importSelectedBookmarks = useCallback(async () => {
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
        (prev) => prev?.filter((b) => !selectedBookmarks.has(b.url)) ?? null
      );
      setSelectedBookmarks(new Set());
      fetchNext();
      fetchStats();
    }
  }, [selectedBookmarks, importing, fetchNext, fetchStats]);

  const deleteFromChrome = useCallback(async () => {
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
  }, [importedUrls, deleting]);

  const handleReimport = useCallback(async () => {
    if (reimporting) return;
    setReimporting(true);
    setReimportResult(null);
    try {
      const bmRes = await fetch("/api/curator/bookmarks");
      const bmJson = await bmRes.json();
      const bookmarkUrls = (bmJson.bookmarks || []).map(
        (b: BookmarkEntry) => b.url
      );
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
      setReimportResult(
        added > 0
          ? `Added ${added} new channel${added === 1 ? "" : "s"}`
          : "All up to date"
      );
      if (added > 0) {
        fetchNext();
        fetchStats();
      }
    } catch {
      setReimportResult("Import failed");
    }
    setReimporting(false);
  }, [reimporting, fetchNext, fetchStats]);

  return {
    importText,
    setImportText,
    importing,
    importResult,
    bookmarks,
    loadingBookmarks,
    selectedBookmarks,
    importedUrls,
    deleting,
    reimporting,
    reimportResult,
    handleImport,
    loadBookmarks,
    toggleBookmark,
    selectAllBookmarks,
    importSelectedBookmarks,
    deleteFromChrome,
    handleReimport,
  };
}
