export interface CardData {
  id: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  imageSmall: string;
  youtubeUrl: string | null;
  videoId: string | null;
  source: "youtube";
  duration: number | null;
  viewCount: number | null;
  genres: string[];
  channelLabels: string[];
}
