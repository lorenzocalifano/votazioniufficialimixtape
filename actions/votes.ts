"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { requireJudgeId } from "@/lib/auth-helpers";
import { checkAndMaybeFinishVoting } from "@/actions/session-state";

export type SectionScoreInput = { sectionId: string; score: number };

export async function submitVote(input: {
  trackId: string;
  generalScore: number;
  wouldRelisten: boolean;
  notes: string;
  sectionScores: SectionScoreInput[];
}) {
  const judgeId = await requireJudgeId();
  const db = supabaseAdmin();

  if (input.generalScore < 1 || input.generalScore > 10) {
    return { error: "Il voto generale deve essere tra 1 e 10." };
  }

  const { data: existing } = await db
    .from("votes")
    .select("id")
    .eq("judge_id", judgeId)
    .eq("track_id", input.trackId)
    .maybeSingle();

  if (existing) return { error: "Hai già votato questa traccia." };

  const { error: voteError } = await db.from("votes").insert({
    judge_id: judgeId,
    track_id: input.trackId,
    general_score: input.generalScore,
    would_relisten: input.wouldRelisten,
    notes: input.notes.trim() || null,
  });

  if (voteError) return { error: "Errore nel salvataggio del voto. Riprova." };

  if (input.sectionScores.length > 0) {
    const rows = input.sectionScores
      .filter((s) => s.score >= 1 && s.score <= 10)
      .map((s) => ({ judge_id: judgeId, section_id: s.sectionId, score: s.score }));
    if (rows.length > 0) await db.from("section_votes").insert(rows);
  }

  await checkAndMaybeFinishVoting(input.trackId);

  return { ok: true };
}

export async function hasVotedForTrack(trackId: string) {
  const judgeId = await requireJudgeId();
  const db = supabaseAdmin();
  const { data } = await db.from("votes").select("id").eq("judge_id", judgeId).eq("track_id", trackId).maybeSingle();
  return !!data;
}
