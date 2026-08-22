"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { requireMaster } from "@/lib/auth-helpers";

/** Dump completo di tutti i dati grezzi, pronto per essere passato a un'IA esterna. */
export async function exportAllData() {
  await requireMaster();
  const db = supabaseAdmin();

  const [tracks, credits, sections, lyrics, judges, votes, sectionVotes] = await Promise.all([
    db.from("tracks").select("*").order("position"),
    db.from("track_credits").select("*"),
    db.from("track_sections").select("*"),
    db.from("track_lyrics_lines").select("*"),
    db.from("judges").select("id, nickname, created_at"),
    db.from("votes").select("*"),
    db.from("section_votes").select("*"),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    tracks: tracks.data ?? [],
    trackCredits: credits.data ?? [],
    trackSections: sections.data ?? [],
    trackLyricsLines: lyrics.data ?? [],
    judges: judges.data ?? [],
    votes: votes.data ?? [],
    sectionVotes: sectionVotes.data ?? [],
  };
}
