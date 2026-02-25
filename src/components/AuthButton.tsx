"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (session?.user) {
    return (
      <button
        onClick={() => signOut()}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-alt)] transition-all duration-200 group"
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt=""
            className="w-8 h-8 rounded-full shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--bg-alt)] shrink-0 flex items-center justify-center text-xs font-bold">
            {session.user.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <span className="text-[10px] font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
          Sign out
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => signIn("google")}
      className="w-12 h-12 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-alt)] transition-all duration-200"
      title="Sign in"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </button>
  );
}
