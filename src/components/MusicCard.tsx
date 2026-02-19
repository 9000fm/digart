"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { keyName } from "@/lib/spotify";

export interface CardData {
  id: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  imageSmall: string;
  previewUrl: string | null;
  spotifyUrl: string;
  uri: string;
  bpm: number | null;
  energy: number | null;
  danceability: number | null;
  valence: number | null;
  key: number | null;
}

function EnergyBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
      <span className="w-7 shrink-0">{label}</span>
      <div className="h-1 flex-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-6 text-right tabular-nums">{value}%</span>
    </div>
  );
}

export default function MusicCard({ card }: { card: CardData }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (!card.previewUrl) {
      window.open(card.spotifyUrl, "_blank");
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio && audio.duration) {
      setProgress((audio.currentTime / audio.duration) * 100);
    }
  };

  return (
    <div className="group relative rounded-2xl bg-zinc-900/80 border border-zinc-800/50 overflow-hidden hover:border-zinc-700/80 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/5 hover:-translate-y-1">
      {/* Album Art */}
      <div className="relative aspect-square cursor-pointer" onClick={togglePlay}>
        <Image
          src={card.image || "/placeholder.svg"}
          alt={`${card.name} by ${card.artist}`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
            {card.previewUrl ? (
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                {playing ? (
                  <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
              </div>
            )}
          </div>
        </div>
        {/* Progress bar */}
        {playing && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800">
            <div
              className="h-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5 space-y-2">
        <div>
          <h3 className="font-semibold text-sm text-white truncate leading-tight">
            {card.name}
          </h3>
          <p className="text-xs text-zinc-400 truncate mt-0.5">{card.artist}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {card.bpm && (
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-300 font-medium tabular-nums">
              {card.bpm} BPM
            </span>
          )}
          {card.key !== null && card.key >= 0 && (
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-300 font-medium">
              {keyName(card.key)}
            </span>
          )}
          {card.energy !== null && (
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-300 font-medium tabular-nums">
              ⚡ {card.energy}%
            </span>
          )}
        </div>

        {/* Energy bars */}
        {card.energy !== null && (
          <div className="space-y-1 pt-1">
            <EnergyBar value={card.energy!} label="NRG" />
            <EnergyBar value={card.danceability!} label="DNC" />
            <EnergyBar value={card.valence!} label="VIB" />
          </div>
        )}
      </div>

      {/* Audio element */}
      {card.previewUrl && (
        <audio
          ref={audioRef}
          src={card.previewUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
          }}
          preload="none"
        />
      )}
    </div>
  );
}
