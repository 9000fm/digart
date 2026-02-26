/**
 * YouTube IFrame Player API wrapper.
 * Loads the API once, creates/reuses a single player instance.
 * Provides seekTo, play, pause, getCurrentTime without iframe reloads.
 */

let apiReady = false;
let apiPromise: Promise<void> | null = null;

interface YTPlayer {
  loadVideoById: (opts: { videoId: string; startSeconds?: number }) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function loadApi(): Promise<void> {
  if (apiReady) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    if (typeof window === "undefined") return;

    // If API already loaded by another script
    if (window.YT && window.YT.Player) {
      apiReady = true;
      resolve();
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      apiReady = true;
      resolve();
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });

  return apiPromise;
}

export async function createPlayer(
  elementId: string,
  onStateChange?: (state: number) => void,
  onReady?: () => void
): Promise<YTPlayer> {
  await loadApi();

  return new Promise((resolve) => {
    const player = new window.YT.Player(elementId, {
      height: "1",
      width: "1",
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          // iOS Safari: must start muted for autoplay policy
          try {
            (player as YTPlayer).mute();
            (player as YTPlayer).playVideo();
            setTimeout(() => {
              (player as YTPlayer).unMute();
            }, 300);
          } catch { /* ignore */ }
          onReady?.();
          resolve(player as YTPlayer);
        },
        onStateChange: (event: { data: number }) => {
          onStateChange?.(event.data);
        },
      },
    });
  });
}

// Player state constants matching YT.PlayerState
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;
