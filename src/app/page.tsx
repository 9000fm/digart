import DiscoverGrid from "@/components/DiscoverGrid";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Superself</h1>
              <p className="text-[10px] text-zinc-500 -mt-0.5 uppercase tracking-widest">
                Music Discovery
              </p>
            </div>
          </div>
          <nav className="flex gap-6 text-sm text-zinc-500">
            <span className="text-emerald-400 font-medium">Discover</span>
            <span className="cursor-not-allowed opacity-40">My DNA</span>
            <span className="cursor-not-allowed opacity-40">DJ Prep</span>
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">
            Discover
          </h2>
          <p className="text-zinc-500 mt-1">
            Fresh recommendations, curated for you. Click to preview.
          </p>
        </div>
        <DiscoverGrid />
      </div>
    </main>
  );
}
