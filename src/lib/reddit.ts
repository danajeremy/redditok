export type RawRedditListing = {
  kind: string;
  data: {
    after: string | null;
    children: Array<{
      kind: "t3";
      data: any;
    }>;
  };
};

export type MediaKind = "video" | "gif" | "image";

export type NormalizedRedditVideo = {
  id: string;
  permalink: string;
  title: string;
  author: string;
  subreddit: string;
  createdUtc: number;
  over18: boolean;
  score: number;
  provider: "reddit" | "redgifs" | "gallery";
  videoUrl: string;
  isGifLike: boolean;
  posterUrl?: string;
};

export function getMediaKind(item: NormalizedRedditVideo): MediaKind {
  if (item.isGifLike) return "gif";
  return "video";
}

export type SubredditPage = {
  subreddit: string;
  after: string | null;
  items: NormalizedRedditVideo[];
};

const REDDIT_ENV_ERROR =
  "Missing Reddit API credentials: set REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET/REDDIT_USER_AGENT";

let accessToken: string | null = null;
let accessTokenExpiresAt = 0; // epoch ms
let deviceId: string | null = null; // generated once per server instance

function getRedditDeviceId(): string {
  if (process.env.REDDIT_DEVICE_ID) return process.env.REDDIT_DEVICE_ID;
  if (deviceId) return deviceId;
  deviceId = `redditok_dev_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return deviceId;
}

export async function getRedditAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT;

  if (!clientId || !clientSecret || !userAgent) {
    throw new Error(REDDIT_ENV_ERROR);
  }

  // Reuse cached token if still valid.
  if (accessToken && Date.now() < accessTokenExpiresAt - 60_000) {
    return accessToken;
  }

  // For "installed_client", Basic auth uses an empty-string password.
  // username = client_id, password = "".
  const basicAuth = Buffer.from(`${clientId}:`, "utf8").toString("base64");
  const form = new URLSearchParams({
    grant_type: "https://oauth.reddit.com/grants/installed_client",
    device_id: getRedditDeviceId()
  });

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
      Accept: "application/json"
    },
    body: form.toString()
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to get Reddit OAuth access token (${res.status}): ${text.slice(
        0,
        400
      )}`
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token || !data.expires_in) {
    throw new Error("Reddit OAuth access token response missing fields");
  }

  accessToken = data.access_token;
  accessTokenExpiresAt = Date.now() + Number(data.expires_in) * 1000;
  return accessToken;
}

function buildListingUrl(subreddit: string, after?: string | null) {
  const params = new URLSearchParams({
    limit: "10",
    over18: "1"
  });
  if (after) params.set("after", after);
  // Use OAuth listing endpoint (hot) to mimic previous default behavior.
  return `https://oauth.reddit.com/r/${encodeURIComponent(
    subreddit
  )}/hot?${params.toString()}`;
}

export async function fetchSubredditPage(
  subreddit: string,
  after: string | null | undefined,
  accessToken: string
): Promise<SubredditPage> {
  const url = buildListingUrl(subreddit, after);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": process.env.REDDIT_USER_AGENT ?? "",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/`
    }
  });

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.log("LOGGING DEBUG [reddit] fetchSubredditPage failure", {
      subreddit,
      after,
      url,
      status: res.status
    });
    throw new Error(`Failed to fetch ${subreddit} feed (${res.status})`);
  }

  const json = (await res.json()) as RawRedditListing;
  const children = json?.data?.children ?? [];

  const items: NormalizedRedditVideo[] = [];

  for (const child of children) {
    const d = child.data;
    if (!d || child.kind !== "t3") continue;

    // Skip obvious non-media
    if (d.stickied || d.is_self) continue;

    const base = {
      id: d.id as string,
      permalink: `https://www.reddit.com${d.permalink as string}`,
      title: (d.title as string) ?? "",
      author: (d.author as string) ?? "",
      subreddit: (d.subreddit as string) ?? subreddit,
      createdUtc: Number(d.created_utc ?? Date.now() / 1000),
      over18: Boolean(d.over_18),
      score: Number(d.score ?? 0)
    };

    // 1) Native Reddit video
    const redditVideo =
      d.media?.reddit_video ??
      d.secure_media?.reddit_video ??
      d.reddit_video_preview;

    if (redditVideo && typeof redditVideo.fallback_url === "string") {
      const poster = d.preview?.images?.[0]?.source?.url as string | undefined;
      items.push({
        ...base,
        provider: "reddit",
        videoUrl: redditVideo.fallback_url as string,
        isGifLike: Boolean(redditVideo.is_gif),
        posterUrl: poster
      });
      continue;
    }

    // 2) RedGIFs / other oEmbed rich:video
    const isRichVideo = d.post_hint === "rich:video";
    const redgifsType =
      d.secure_media?.type === "redgifs.com" ||
      d.media?.type === "redgifs.com" ||
      (d.domain && String(d.domain).includes("redgifs.com"));

    if (isRichVideo && redgifsType) {
      let watchUrl =
        (d.url_overridden_by_dest as string | undefined) ??
        (d.url as string | undefined);

      // Fallback: derive from embed iframe html if available
      if (!watchUrl) {
        const html =
          d.secure_media?.oembed?.html ?? d.media?.oembed?.html ?? "";
        const match = html.match(/src=\"https:\/\/www\.redgifs\.com\/ifr\/([^\"?]+)/);
        if (match?.[1]) {
          watchUrl = `https://www.redgifs.com/watch/${match[1]}`;
        }
      }

      if (watchUrl && watchUrl.includes("redgifs.com")) {
        const poster =
          (d.secure_media?.oembed?.thumbnail_url as string | undefined) ??
          (d.media?.oembed?.thumbnail_url as string | undefined) ??
          (d.preview?.images?.[0]?.source?.url as string | undefined);

        items.push({
          ...base,
          provider: "redgifs",
          videoUrl: watchUrl,
          isGifLike: true,
          posterUrl: poster
        });
        continue;
      }
    }

    // 3) Gallery with animated media
    if (d.is_gallery && d.media_metadata && d.gallery_data) {
      const galleryItems = d.gallery_data.items as Array<{
        media_id: string;
      }>;

      for (const g of galleryItems) {
        const meta = d.media_metadata[g.media_id];
        if (!meta) continue;

        const isAnimated = meta.e === "AnimatedImage";
        const sourceMp4 = meta.s?.mp4 as string | undefined;
        const sourceGif = meta.s?.gif as string | undefined;

        if (!isAnimated && !sourceMp4 && !sourceGif) continue;

        const url = sourceMp4 ?? sourceGif;
        if (!url) continue;

        const poster = meta.s?.u as string | undefined;

        items.push({
          ...base,
          provider: "gallery",
          videoUrl: url,
          isGifLike: true,
          posterUrl: poster
        });
      }
    }
  }

  return {
    subreddit,
    after: json.data.after,
    items
  };
}

export async function fetchCombinedSubreddits(
  subreddits: string[],
  cursors: Record<string, string | null> = {},
  accessToken: string
): Promise<{
  pages: SubredditPage[];
  combined: NormalizedRedditVideo[];
  nextCursors: Record<string, string | null>;
}> {
  const results = await Promise.allSettled(
    subreddits.map((name) =>
      fetchSubredditPage(name, cursors[name] ?? null, accessToken)
    )
  );

  const pages: SubredditPage[] = [];
  const nextCursors: Record<string, string | null> = {};

  for (let i = 0; i < subreddits.length; i++) {
    const sub = subreddits[i];
    const r = results[i];
    if (r.status === "fulfilled") {
      pages.push(r.value);
      nextCursors[sub] = r.value.after;
    } else {
      nextCursors[sub] = cursors[sub] ?? null;
    }
  }

  const combinedRaw = [...pages.flatMap((p) => p.items)];

  // Deduplicate by Reddit post id across all subreddits / pages
  const seenIds = new Set<string>();
  const combined: NormalizedRedditVideo[] = [];
  for (const item of combinedRaw) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    combined.push(item);
  }

  combined.sort((a, b) => b.createdUtc - a.createdUtc);

  return { pages, combined, nextCursors };
}

