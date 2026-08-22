"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { requireJudgeId } from "@/lib/auth-helpers";

export async function getSessionState() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("session_state")
    .select("current_track_id, phase, track_started_at, is_paused, paused_position_seconds, break_until")
    .eq("id", 1)
    .single();
  return data;
}

/** Elenco tracce (posizione + durata) per calcolare la stima di fine serata. */
export async function getScheduleTracks() {
  const db = supabaseAdmin();
  const { data } = await db.from("tracks").select("id, position, duration_seconds").order("position");
  return data ?? [];
}

export async function getTrackForJudge(trackId: string) {
  const judgeId = await requireJudgeId();
  const db = supabaseAdmin();

  const [{ data: track }, { data: credits }, { data: sections }, { data: lines }, { data: existingVote }] =
    await Promise.all([
      db.from("tracks").select("id, title, position").eq("id", trackId).single(),
      db.from("track_credits").select("role, name").eq("track_id", trackId).order("position"),
      db.from("track_sections").select("id, position, label, artist_name").eq("track_id", trackId).order("position"),
      db
        .from("track_lyrics_lines")
        .select("position, text, timestamp_seconds")
        .eq("track_id", trackId)
        .order("position"),
      db.from("votes").select("id").eq("judge_id", judgeId).eq("track_id", trackId).maybeSingle(),
    ]);

  return {
    track,
    credits: credits ?? [],
    sections: sections ?? [],
    lines: lines ?? [],
    hasVoted: !!existingVote,
  };
}
