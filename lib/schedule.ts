/**
 * Regole delle pause programmate e stima dell'orario di fine serata.
 * Condiviso tra pannello Master (decide quando mettere in pausa) e app
 * ascoltatori (mostra la stessa stima nella schermata di avanzamento).
 */

const DEFAULT_TRACK_SECONDS = 210; // stima usata finché non è stato caricato l'mp3 (per avere comunque una stima)
const VOTE_BUFFER_SECONDS = 40; // margine per finire di votare dopo l'ascolto

/** Minuti di pausa dopo la traccia in questa posizione, o 0 se non è prevista. */
export function breakMinutesAfterPosition(position: number): number {
  if (position === 10) return 15;
  if (position % 3 === 0) return 5;
  return 0;
}

export type ScheduleTrack = { id: string; position: number; duration_seconds: number | null };
export type ScheduleState = {
  current_track_id: string | null;
  phase: "lobby" | "voting" | "all_done" | "break";
  track_started_at: string | null;
  break_until: string | null;
};

export function estimateEndTime(tracks: ScheduleTrack[], state: ScheduleState): Date {
  const now = Date.now();
  let remainingMs = 0;

  const currentTrack = tracks.find((t) => t.id === state.current_track_id) ?? null;
  const currentPosition = currentTrack?.position ?? 0;

  if (state.phase === "break" && state.break_until) {
    remainingMs += Math.max(0, new Date(state.break_until).getTime() - now);
  } else if (state.phase === "voting" && currentTrack && state.track_started_at) {
    const elapsedSeconds = (now - new Date(state.track_started_at).getTime()) / 1000;
    const duration = currentTrack.duration_seconds ?? DEFAULT_TRACK_SECONDS;
    remainingMs += Math.max(0, duration - elapsedSeconds) * 1000 + VOTE_BUFFER_SECONDS * 1000;
  }

  for (const t of tracks) {
    if (t.position <= currentPosition) continue;
    remainingMs += ((t.duration_seconds ?? DEFAULT_TRACK_SECONDS) + VOTE_BUFFER_SECONDS) * 1000;
    remainingMs += breakMinutesAfterPosition(t.position) * 60_000;
  }

  return new Date(now + remainingMs);
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}
