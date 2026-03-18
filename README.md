# redditok

A TikTok-style vertical scroller for Reddit communities with video/GIF posts.

This project is a Next.js app (App Router) that:
- Lets users choose which subreddits to load (saved in `localStorage`)
- Maintains a small sliding window of posts so scrolling stays performant
- Uses Reddit OAuth (server-side) to fetch subreddit listings and avoid public `/.json` listing endpoints

## Features

- Mobile-first vertical feed (`scroll-snap`)
- Auto-play for the focused post
- Sliding window + history buffer (old posts unmount; previously seen posts restore when scrolling back)
- Keyboard navigation:
  - `ArrowDown` / `j` to advance
  - `ArrowUp` / `k` to go back
- Infinite-ish loading:
  - App loads more as you approach the end of the already-fetched history

## Requirements

You must provide Reddit API credentials as environment variables. Without them, the backend will return an error and the feed will not load.

## Setup

1. Install dependencies

```bash
npm install
```

2. Add environment variables

Create a file named `.env.local` in the project root with at least:

```bash
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT=your_user_agent
REDDIT_DEVICE_ID=optional_device_id_for_installed_client
```

3. Run the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## How Reddit OAuth works here

The backend fetches subreddit listings using app-only access via:

- OAuth grant: `https://oauth.reddit.com/grants/installed_client`
- Listing endpoint: `https://oauth.reddit.com/r/<subreddit>/hot`
- Query params: `limit=10` and `over18=1`

## Configuration / Subreddits

Subreddit selection is controlled via the in-app **Settings** panel and persisted in `localStorage` under:
- `redditok.subreddits`

## Troubleshooting

If you see “missing credentials” or “failed to load”:
- Verify `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_USER_AGENT` are set on the machine running the Next.js server.
- Check the server logs (the `/api/reddit` route logs request details and Reddit fetch failures).

If you see “No playable video posts…”:
- It likely means the fetched posts didn’t match the app’s media extraction rules (native Reddit videos, RedGIFs rich:video, or animated gallery items).
- Try different subreddits in Settings.

## License

MIT

