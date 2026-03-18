/* eslint-disable @typescript-eslint/no-use-before-define */
"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "redditok.subreddits";
const DEFAULT_SUBREDDITS = ["GOONED"];

function normalizeName(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  const withoutPrefix = trimmed.startsWith("r/") ? trimmed.slice(2) : trimmed;
  if (!withoutPrefix) return null;
  return withoutPrefix;
}

export function useSubredditConfig() {
  const [subreddits, setSubreddits] = useState<string[]>(DEFAULT_SUBREDDITS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(DEFAULT_SUBREDDITS)
        );
        setSubreddits(DEFAULT_SUBREDDITS);
      } else {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          const normalized = Array.from(
            new Set(
              parsed
                .map((s) => normalizeName(String(s)))
                .filter((v): v is string => Boolean(v))
            )
          );
          setSubreddits(normalized.length ? normalized : DEFAULT_SUBREDDITS);
        } else {
          setSubreddits(DEFAULT_SUBREDDITS);
        }
      }
    } catch {
      setSubreddits(DEFAULT_SUBREDDITS);
    } finally {
      setReady(true);
      // eslint-disable-next-line no-console
      console.log("LOGGING DEBUG [SubredditConfig] ready", {
        subreddits: JSON.stringify(subreddits),
        raw: window.localStorage.getItem(STORAGE_KEY)
      });
    }
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subreddits));
    } catch {
      // ignore
    }
  }, [subreddits, ready]);

  function addSubreddit(input: string) {
    const normalized = normalizeName(input);
    if (!normalized) return;
    setSubreddits((prev) =>
      prev.includes(normalized) ? prev : [...prev, normalized]
    );
  }

  function removeSubreddit(name: string) {
    setSubreddits((prev) =>
      prev.length <= 1 ? prev : prev.filter((s) => s !== name)
    );
  }

  function resetToDefaults() {
    setSubreddits(DEFAULT_SUBREDDITS);
  }

  return {
    ready,
    subreddits,
    addSubreddit,
    removeSubreddit,
    resetToDefaults
  };
}

