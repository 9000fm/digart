"use client";

import type { BookmarkEntry } from "../types";

interface ImportToolsProps {
  importText: string;
  setImportText: (text: string) => void;
  importing: boolean;
  importResult: { added: string[]; failed: string[] } | null;
  handleImport: () => void;
  // Bookmarks
  bookmarks: BookmarkEntry[] | null;
  loadingBookmarks: boolean;
  selectedBookmarks: Set<string>;
  importedUrls: string[];
  deleting: boolean;
  loadBookmarks: () => void;
  toggleBookmark: (url: string) => void;
  selectAllBookmarks: () => void;
  importSelectedBookmarks: () => void;
  deleteFromChrome: () => void;
}

export function ImportTools({
  importText,
  setImportText,
  importing,
  importResult,
  handleImport,
  bookmarks,
  loadingBookmarks,
  selectedBookmarks,
  importedUrls,
  deleting,
  loadBookmarks,
  toggleBookmark,
  selectAllBookmarks,
  importSelectedBookmarks,
  deleteFromChrome,
}: ImportToolsProps) {
  return (
    <div className="space-y-6">
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
                      {b.path} &middot; {b.url}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={selectAllBookmarks}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] uppercase tracking-wider transition-colors"
              >
                {bookmarks &&
                selectedBookmarks.size === bookmarks.length
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
  );
}
