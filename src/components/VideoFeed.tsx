"use client";

import { useEffect, useRef, useState } from "react";
import type { NormalizedRedditVideo } from "@/lib/reddit";
import { VideoCard } from "./VideoCard";

type Props = {
  items: NormalizedRedditVideo[];
  onActiveIndexChange?: (localIndex: number) => void;
  loading?: boolean;
};

export function VideoFeed({ items, onActiveIndexChange, loading = false }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeObserver = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the highest intersection ratio
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }

        if (best && best.target instanceof HTMLElement) {
          const idxAttr = best.target.dataset.cardIndex;
          if (idxAttr != null) {
            const idx = Number(idxAttr);
            if (!Number.isNaN(idx) && idx !== activeIndex) {
              setActiveIndex(idx);
              if (onActiveIndexChange) {
                // Defer to next frame so layout can settle after window shifts
                window.requestAnimationFrame(() => {
                  onActiveIndexChange(idx);
                });
              }
            }
          }
        }
      },
      {
        root: container,
        threshold: 0.6
      }
    );

    const children = Array.from(
      container.querySelectorAll<HTMLElement>("[data-card-index]")
    );

    for (const el of children) {
      activeObserver.observe(el);
    }

    return () => activeObserver.disconnect();
  }, [items.length, onActiveIndexChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "j") {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = Math.min(prev + 1, items.length - 1);
          if (onActiveIndexChange) {
            onActiveIndexChange(next);
          }
          return next;
        });
      }
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          if (onActiveIndexChange) {
            onActiveIndexChange(next);
          }
          return next;
        });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items.length]);

  return (
    <div
      ref={containerRef}
      className="flex h-screen snap-y snap-mandatory flex-col overflow-y-scroll"
    >
      {items.map((item, idx) => (
        <div key={item.id} data-card-index={idx}>
          <VideoCard item={item} active={idx === activeIndex} />
        </div>
      ))}
    </div>
  );
}

