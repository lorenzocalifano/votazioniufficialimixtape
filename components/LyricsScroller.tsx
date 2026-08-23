"use client";

import { useEffect, useMemo, useRef } from "react";

/** Testo con la riga corrente evidenziata, identico a quello che vede l'ascoltatore. */
export function LyricsScroller({
  lines,
  elapsed,
}: {
  lines: { text: string; timestamp_seconds: number }[];
  elapsed: number;
}) {
  const lineRefs = useRef<Record<number, HTMLParagraphElement | null>>({});
  const lastLineIndexRef = useRef(-1);

  const currentLineIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].timestamp_seconds <= elapsed) idx = i;
      else break;
    }
    return idx;
  }, [lines, elapsed]);

  useEffect(() => {
    if (currentLineIndex !== lastLineIndexRef.current && currentLineIndex >= 0) {
      lastLineIndexRef.current = currentLineIndex;
      lineRefs.current[currentLineIndex]?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [currentLineIndex]);

  if (lines.length === 0) return null;

  return (
    <div className="neon-card max-h-64 overflow-y-auto p-4">
      {lines.map((line, i) => (
        <p
          key={i}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
          className={
            i === currentLineIndex
              ? "glow-text py-1 text-lg font-bold text-white transition-colors"
              : "py-1 text-white/40 transition-colors"
          }
        >
          {line.text}
        </p>
      ))}
    </div>
  );
}
