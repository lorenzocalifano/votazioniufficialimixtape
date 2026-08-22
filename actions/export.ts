"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { requireMaster } from "@/lib/auth-helpers";

/**
 * Dump completo e già incrociato (tracce + crediti + sezioni con i voti
 * individuali per strofa/ritornello + voti generali + severità per
 * ascoltatore), pronto per essere passato a un'IA esterna senza dover
 * ricostruire i join a mano.
 */
export async function exportAllData() {
  await requireMaster();
  const db = supabaseAdmin();

  const [tracksRes, creditsRes, sectionsRes, lyricsRes, judgesRes, votesRes, sectionVotesRes] = await Promise.all([
    db.from("tracks").select("*").order("position"),
    db.from("track_credits").select("*").order("position"),
    db.from("track_sections").select("*").order("position"),
    db.from("track_lyrics_lines").select("*").order("position"),
    db.from("judges").select("id, nickname, created_at"),
    db.from("votes").select("*"),
    db.from("section_votes").select("*"),
  ]);

  const tracks = tracksRes.data ?? [];
  const credits = creditsRes.data ?? [];
  const sections = sectionsRes.data ?? [];
  const lyrics = lyricsRes.data ?? [];
  const judges = judgesRes.data ?? [];
  const votes = votesRes.data ?? [];
  const sectionVotes = sectionVotesRes.data ?? [];

  const listenerName = (judgeId: string) => {
    const j = judges.find((x) => x.id === judgeId);
    return j?.nickname || `Ascoltatore ${judgeId.slice(0, 8)}`;
  };

  const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

  const enrichedTracks = tracks.map((t) => {
    const trackVotes = votes.filter((v) => v.track_id === t.id);
    const trackSections = sections
      .filter((s) => s.track_id === t.id)
      .map((s) => {
        const votesForSection = sectionVotes
          .filter((sv) => sv.section_id === s.id)
          .map((sv) => ({ listener: listenerName(sv.judge_id), score: Number(sv.score) }));
        return {
          label: s.label,
          artistName: s.artist_name,
          position: s.position,
          votes: votesForSection,
          averageScore: avg(votesForSection.map((v) => v.score)),
        };
      });

    return {
      id: t.id,
      position: t.position,
      title: t.title,
      credits: credits.filter((c) => c.track_id === t.id).map((c) => ({ role: c.role, name: c.name })),
      lyricsLineCount: lyrics.filter((l) => l.track_id === t.id).length,
      sections: trackSections,
      generalVotes: trackVotes.map((v) => ({
        listener: listenerName(v.judge_id),
        generalScore: Number(v.general_score),
        wouldRelisten: v.would_relisten,
        notes: v.notes,
      })),
      generalAverage: avg(trackVotes.map((v) => Number(v.general_score))),
      generalVotesCount: trackVotes.length,
      relistenYesCount: trackVotes.filter((v) => v.would_relisten).length,
      relistenNoCount: trackVotes.filter((v) => !v.would_relisten).length,
    };
  });

  const listenerSummary = judges.map((j) => {
    const given = votes.filter((v) => v.judge_id === j.id).map((v) => Number(v.general_score));
    return {
      listener: j.nickname || `Ascoltatore ${j.id.slice(0, 8)}`,
      tracksVoted: given.length,
      averageScoreGiven: avg(given),
    };
  });

  return {
    exportedAt: new Date().toISOString(),
    tracks: enrichedTracks,
    listenerSummary,
    raw: {
      tracks,
      trackCredits: credits,
      trackSections: sections,
      trackLyricsLines: lyrics,
      judges,
      votes,
      sectionVotes,
    },
  };
}
