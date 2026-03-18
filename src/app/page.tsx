"use client";

import { useEffect, useState } from "react";
import type { NormalizedRedditVideo } from "@/lib/reddit";
import { useSubredditConfig } from "@/hooks/useSubredditConfig";
import { VideoFeed } from "@/components/VideoFeed";
import { SubredditSettings } from "@/components/SubredditSettings";

type CursorState = Record<string, string | null>;

export default function Page() {
  const { ready, subreddits } = useSubredditConfig();
  const [history, setHistory] = useState<NormalizedRedditVideo[]>([]);
  const [windowStart, setWindowStart] = useState(0);
  const windowSize = 10;
  const [globalActiveIndex, setGlobalActiveIndex] = useState(0);
  const [cursors, setCursors] = useState<CursorState>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setHistory([]);
    setWindowStart(0);
    setCursors({});
    setError(null);
    void loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, subreddits.join(",")]);

  async function loadMore(reset = false) {
    if (!ready || !subreddits.length || loading) return;
    // eslint-disable-next-line no-console
    console.log("LOGGING DEBUG [Page] loadMore start", {
      reset,
      ready,
      subreddits,
      loading
    });
    setLoading(true);
    try {
      const res = await fetch("/api/reddit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          subreddits,
          cursors: reset ? {} : cursors
        })
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        const msg = data.error || `Request failed with ${res.status}`;
        throw new Error(msg);
      }

      const data = (await res.json()) as {
        combined: NormalizedRedditVideo[];
        nextCursors: Record<string, string | null>;
      };

      const { combined, nextCursors } = data;
      setCursors(nextCursors);
      if (reset) {
        // Reset history with a fresh, de-duplicated batch
        const seen = new Set<string>();
        const unique = combined.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
        // eslint-disable-next-line no-console
        console.log(
          "LOGGING DEBUG [Page] initial combined unique IDs:",
          unique.map((it) => it.id)
        );
        setHistory(unique);
        setWindowStart(Math.max(0, unique.length - windowSize));
        if (!unique.length) {
          setError(
            "No playable video posts were found for your current subreddits."
          );
        }
      } else {
        setHistory((prev) => {
          const seen = new Set(prev.map((it) => it.id));
          const next = [
            ...prev,
            ...combined.filter((item) => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            })
          ];
          return next;
        });
      }
      // eslint-disable-next-line no-console
      console.log("LOGGING DEBUG [Page] loadMore success", {
        reset,
        combinedLength: combined.length
      });
    } catch (e) {
      const rawMsg =
        e instanceof Error ? e.message : "Failed to load subreddit feeds.";

      let friendly = rawMsg;
      if (rawMsg.includes("Missing Reddit API credentials")) {
        friendly =
          "Backend needs Reddit API credentials. Add `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` (and `REDDIT_USER_AGENT`) as environment variables, then restart the server.";
      } else if (rawMsg.includes("403")) {
        friendly =
          "Reddit is temporarily blocking listing requests (403). Please try again later or change subreddits.";
      } else if (rawMsg.includes("Rate limited")) {
        friendly =
          "Too many requests in a short time. Please wait a few seconds and try again.";
      }

      setError(friendly);
      setRetryCount((prev) => prev + 1);
      // eslint-disable-next-line no-console
      console.log("LOGGING DEBUG [Page] loadMore error", e);
    } finally {
      setLoading(false);
      // eslint-disable-next-line no-console
      console.log("LOGGING DEBUG [Page] loadMore finished");
    }
  }

  const hasContent = history.length > 0;
  const windowItems = history.slice(windowStart, windowStart + windowSize);

  function handleActiveIndexChange(localIndex: number) {
    if (!Number.isFinite(localIndex)) return;
    const globalIndex = windowStart + localIndex;
    setGlobalActiveIndex(globalIndex);
  }

  useEffect(() => {
    if (!hasContent) return;

    const bottomThreshold = windowSize - 2; // slightly more conservative
    const topThreshold = 1;

    const currentLocalIndex = Math.min(
      Math.max(globalActiveIndex - windowStart, 0),
      Math.max(windowItems.length - 1, 0)
    );

    let nextWindowStart = windowStart;

    // Ensure the window always contains the globalActiveIndex
    if (globalActiveIndex < windowStart) {
      nextWindowStart = globalActiveIndex;
    } else if (globalActiveIndex >= windowStart + windowSize) {
      nextWindowStart = globalActiveIndex - windowSize + 1;
    }

    // Slide down when we approach the bottom of the window
    if (
      currentLocalIndex >= bottomThreshold &&
      nextWindowStart + windowSize < history.length
    ) {
      nextWindowStart = Math.min(
        nextWindowStart + 1,
        Math.max(history.length - windowSize, 0)
      );
    }

    // Slide up when we approach the top of the window
    if (currentLocalIndex <= topThreshold && nextWindowStart > 0) {
      nextWindowStart = Math.max(nextWindowStart - 1, 0);
    }

    if (nextWindowStart !== windowStart) {
      setWindowStart(nextWindowStart);
      // eslint-disable-next-line no-console
      console.log(
        "LOGGING DEBUG [Page] window slide",
        "globalActiveIndex=",
        globalActiveIndex,
        "windowStart=",
        nextWindowStart,
        "windowItems IDs=",
        history
          .slice(nextWindowStart, nextWindowStart + windowSize)
          .map((it) => it.id)
      );
    }

    // Prefetch more when near the end of known history
    const remaining = history.length - 1 - globalActiveIndex;
    if (remaining <= 3 && !loading) {
      void loadMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalActiveIndex, history.length]);

  return (
    <main className="relative min-h-screen bg-black text-white">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 text-xs text-gray-300">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">Redditok</span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="max-w-xs truncate text-[11px] text-red-400">
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="rounded-full bg-neutral-900/80 px-3 py-1 text-[11px] text-gray-200 ring-1 ring-neutral-700 hover:bg-neutral-800"
          >
            Settings
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="absolute right-0 top-10 z-30 h-[80vh] w-full max-w-xs overflow-hidden rounded-l-xl border-l border-neutral-800 bg-neutral-900/95 shadow-xl backdrop-blur">
          <SubredditSettings onClose={() => setShowSettings(false)} />
        </div>
      )}

      <div>
        {hasContent ? (
          <VideoFeed
            items={windowItems}
            loading={loading}
            onActiveIndexChange={handleActiveIndexChange}
          />
        ) : error ? (
          <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-red-300 px-6 text-center">
            <p className="font-medium">Failed to load videos from Reddit.</p>
            <p className="text-xs text-red-400">{error}</p>
            <p className="text-[11px] text-red-300/80">
              Current subreddits:{" "}
              {subreddits.length
                ? subreddits.map((s) => `r/${s}`).join(", ")
                : "none"}
            </p>
            {error.includes("No playable video posts") && (
              <p className="text-[11px] text-red-200/90">
                Try adding more video-heavy subreddits in Settings
                (e.g. r/gifs, r/funny, r/interestingasfuck).
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                const delay =
                  retryCount <= 0
                    ? 0
                    : retryCount === 1
                    ? 1000
                    : retryCount === 2
                    ? 3000
                    : 10_000;
                setTimeout(() => {
                  void loadMore(true);
                }, delay);
              }}
              className="mt-2 rounded-full bg-neutral-900 px-4 py-2 text-xs text-gray-200 ring-1 ring-neutral-700 hover:bg-neutral-800"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-gray-300">
            <div className="h-32 w-32 animate-pulse rounded-full bg-neutral-900" />
            <p>Loading videos from Reddit JSON feeds…</p>
            <p className="text-xs text-gray-500">
              Make sure NSFW content is allowed in your Reddit preferences.
            </p>
          </div>
        )}
      </div>

      {loading && hasContent && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-neutral-900/80 px-3 py-1 text-[11px] text-gray-300">
          Loading more…
        </div>
      )}
    </main>
  );
}

