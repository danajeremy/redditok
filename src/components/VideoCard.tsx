import type { NormalizedRedditVideo } from "@/lib/reddit";
import { getMediaKind } from "@/lib/reddit";
import { MediaTypeBadge } from "./MediaTypeBadge";
import { useEffect, useRef } from "react";

type Props = {
  item: NormalizedRedditVideo;
  active: boolean;
};

export function VideoCard({ item, active }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      const play = async () => {
        try {
          await el.play();
        } catch {
          // autoplay might be blocked; ignore
        }
      };
      void play();
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [active]);

  const isRedditVideo = item.provider === "reddit" || item.provider === "gallery";
  const isExternal = item.provider === "redgifs";
  const mediaKind = getMediaKind(item);

  return (
    <article className="flex h-screen w-full snap-start flex-col items-center justify-center bg-black">
      <div className="relative flex h-full w-full max-w-md flex-col items-center justify-center">
        <div className="pointer-events-none absolute right-2 top-2 z-10">
          <MediaTypeBadge kind={mediaKind} />
        </div>

        {isRedditVideo && (
          <video
            ref={videoRef}
            src={item.videoUrl}
            poster={item.posterUrl}
            muted
            loop
            playsInline
            className="h-full w-full object-contain"
          />
        )}

        {isExternal && (
          <div className="h-full w-full">
            <iframe
              src={item.videoUrl.replace("/watch/", "/ifr/")}
              className="h-full w-full"
              allow="autoplay; fullscreen"
              loading="lazy"
            />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 text-sm">
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span className="font-semibold">{item.subreddit}</span>
            <span className="text-gray-400">u/{item.author}</span>
          </div>
          <h2 className="text-sm font-medium text-white">{item.title}</h2>
          <div className="mt-1 text-[11px] text-gray-400">
            Score {item.score.toLocaleString()} •{" "}
            <a
              className="underline hover:text-gray-200"
              href={item.permalink}
              target="_blank"
              rel="noreferrer"
            >
              View on Reddit
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

