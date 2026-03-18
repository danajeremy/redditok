"use client";

import { useState, FormEvent } from "react";
import { useSubredditConfig } from "@/hooks/useSubredditConfig";

type Props = {
  onClose?: () => void;
};

export function SubredditSettings({ onClose }: Props) {
  const { ready, subreddits, addSubreddit, removeSubreddit, resetToDefaults } =
    useSubredditConfig();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!ready) {
    return (
      <div className="p-4 text-sm text-gray-300">
        Loading subreddit settings...
      </div>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) {
      setError("Enter a subreddit name.");
      return;
    }
    setError(null);
    addSubreddit(input);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col gap-4 bg-neutral-900 p-4 text-sm text-gray-100">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Subreddits</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-xs text-gray-300 hover:bg-neutral-800"
          >
            Close
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Videos are pulled from the JSON feeds of these subreddits. Names are
        stored locally in your browser.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 rounded-md bg-neutral-800 px-3 py-2 text-sm outline-none ring-1 ring-neutral-700 focus:ring-neutral-400"
          placeholder="Add subreddit (e.g. GOONED)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-md bg-white px-3 py-2 text-xs font-medium text-black hover:bg-neutral-200"
        >
          Add
        </button>
      </form>

      {error && <div className="text-xs text-red-400">{error}</div>}

      <div className="mt-2 space-y-2">
        {subreddits.map((name) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-md bg-neutral-800 px-3 py-2"
          >
            <span className="text-xs font-medium text-gray-100">r/{name}</span>
            <button
              type="button"
              disabled={subreddits.length <= 1}
              onClick={() => removeSubreddit(name)}
              className="text-xs text-gray-400 hover:text-red-400 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-neutral-800 pt-3">
        <button
          type="button"
          onClick={resetToDefaults}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}

