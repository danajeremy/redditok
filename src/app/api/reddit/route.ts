import { NextResponse } from "next/server";
import { fetchCombinedSubreddits, getRedditAccessToken } from "@/lib/reddit";

type RedditResult = Awaited<ReturnType<typeof fetchCombinedSubreddits>>;

const CACHE_TTL_MS = 30_000; // 30 seconds
const MIN_INTERVAL_MS = 3_000; // 3 seconds between calls per subredditKey

const cache = new Map<string, { data: RedditResult; expiresAt: number }>();
const lastCallAt = new Map<string, number>();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      subreddits?: string[];
      cursors?: Record<string, string | null>;
    };

    const subreddits = Array.isArray(body.subreddits) ? body.subreddits : [];

    const cursors = body.cursors ?? {};

    // eslint-disable-next-line no-console
    console.log("LOGGING DEBUG [API /api/reddit] body", {
      subreddits,
      cursors
    });

    if (!subreddits.length) {
      return NextResponse.json(
        { error: "No subreddits specified" },
        { status: 400 }
      );
    }

    const missingCreds =
      !process.env.REDDIT_CLIENT_ID ||
      !process.env.REDDIT_CLIENT_SECRET ||
      !process.env.REDDIT_USER_AGENT;
    if (missingCreds) {
      return NextResponse.json(
        {
          error:
            "Missing Reddit API credentials: set REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET/REDDIT_USER_AGENT"
        },
        { status: 500 }
      );
    }

    const subredditKey = subreddits.join(",");
    const cacheKey = `${subredditKey}|${JSON.stringify(cursors)}`;
    const now = Date.now();

    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      // eslint-disable-next-line no-console
      console.log("LOGGING DEBUG [API /api/reddit] cache hit", { cacheKey });
      return NextResponse.json(cached.data, { status: 200 });
    }

    const last = lastCallAt.get(subredditKey) ?? 0;
    if (now - last < MIN_INTERVAL_MS) {
      const stale = cached?.data ?? null;
      if (stale) {
        // eslint-disable-next-line no-console
        console.log(
          "LOGGING DEBUG [API /api/reddit] rate-limited, serving stale cache",
          { subredditKey }
        );
        return NextResponse.json(stale, { status: 200 });
      }
      // eslint-disable-next-line no-console
      console.log("LOGGING DEBUG [API /api/reddit] rate-limited, no cache", {
        subredditKey
      });
      return NextResponse.json(
        { error: "Rate limited, try again soon." },
        { status: 429 }
      );
    }

    lastCallAt.set(subredditKey, now);

    const accessToken = await getRedditAccessToken();
    const result = await fetchCombinedSubreddits(
      subreddits,
      cursors,
      accessToken
    );

    cache.set(cacheKey, { data: result, expiresAt: now + CACHE_TTL_MS });

    return NextResponse.json(result, {
      status: 200
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unknown error fetching Reddit feeds";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

