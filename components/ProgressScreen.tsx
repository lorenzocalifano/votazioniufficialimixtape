"use client";

import { useEffect, useState } from "react";
import { estimateEndTime, formatClock, breakMinutesAfterPosition, ScheduleTrack, ScheduleState } from "@/lib/schedule";

export function ProgressScreen({
  tracks,
  state,
  statusTitle,
  statusSubtitle,
}: {
  tracks: ScheduleTrack[];
  state: ScheduleState;
  statusTitle: string;
  statusSubtitle?: string;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const total = tracks.length;
  const currentTrack = tracks.find((t) => t.id === state.current_track_id);
  const currentPosition = currentTrack?.position ?? (state.phase === "all_done" && !state.current_track_id ? total : 0);
  const endTime = total > 0 ? estimateEndTime(tracks, state) : null;

  return (
    <div className="enter neon-card w-full max-w-lg space-y-6 p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">{formatClock(now)}</p>

      <div>
        <p className="font-display text-2xl font-bold">{statusTitle}</p>
        {statusSubtitle && <p className="mt-1 text-sm text-white/60">{statusSubtitle}</p>}
      </div>

      {total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-white/50">
            <span>
              Traccia {currentPosition} di {total}
            </span>
            {endTime && <span>Fine prevista {formatClock(endTime)}</span>}
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan to-magenta transition-all"
              style={{ width: `${Math.min(100, (currentPosition / total) * 100)}%` }}
            />
            {tracks
              .filter((t) => breakMinutesAfterPosition(t.position) > 0)
              .map((t) => (
                <span
                  key={t.id}
                  className="absolute top-0 h-full w-px bg-gold/70"
                  style={{ left: `${(t.position / total) * 100}%` }}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
