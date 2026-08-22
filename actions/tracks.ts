"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { requireMaster } from "@/lib/auth-helpers";

export async function listTracks() {
  await requireMaster();
  const db = supabaseAdmin();
  const { data } = await db.from("tracks").select("id, position, title").order("position", { ascending: true });
  return data ?? [];
}

export async function createTrack(title: string) {
  await requireMaster();
  if (!title.trim()) return { error: "Il titolo è obbligatorio." };

  const db = supabaseAdmin();
  const { data: last } = await db
    .from("tracks")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? 0) + 1;
  const { data, error } = await db.from("tracks").insert({ title: title.trim(), position: nextPosition }).select("id").single();
  if (error) return { error: "Errore nella creazione della traccia." };
  return { ok: true, id: data.id };
}

export async function updateTrackTitle(trackId: string, title: string) {
  await requireMaster();
  if (!title.trim()) return { error: "Il titolo è obbligatorio." };
  const db = supabaseAdmin();
  await db.from("tracks").update({ title: title.trim() }).eq("id", trackId);
  return { ok: true };
}

export async function deleteTrack(trackId: string) {
  await requireMaster();
  const db = supabaseAdmin();
  await db.from("tracks").delete().eq("id", trackId);
  return { ok: true };
}

export async function getTrackDetail(trackId: string) {
  await requireMaster();
  const db = supabaseAdmin();

  const [{ data: track }, { data: credits }, { data: sections }, { data: lines }] = await Promise.all([
    db.from("tracks").select("id, title, position").eq("id", trackId).single(),
    db.from("track_credits").select("id, role, position, name").eq("track_id", trackId).order("position"),
    db.from("track_sections").select("id, position, label, artist_name").eq("track_id", trackId).order("position"),
    db.from("track_lyrics_lines").select("id, position, text, timestamp_seconds").eq("track_id", trackId).order("position"),
  ]);

  return { track, credits: credits ?? [], sections: sections ?? [], lines: lines ?? [] };
}

export async function addCredit(trackId: string, role: "producer" | "artist", name: string) {
  await requireMaster();
  if (!name.trim()) return { error: "Il nome è obbligatorio." };

  const db = supabaseAdmin();
  const { count } = await db
    .from("track_credits")
    .select("id", { count: "exact", head: true })
    .eq("track_id", trackId);

  await db.from("track_credits").insert({ track_id: trackId, role, name: name.trim(), position: count ?? 0 });
  return { ok: true };
}

export async function deleteCredit(creditId: string) {
  await requireMaster();
  const db = supabaseAdmin();
  await db.from("track_credits").delete().eq("id", creditId);
  return { ok: true };
}

export async function addSection(trackId: string, label: string, artistName: string) {
  await requireMaster();
  if (!label.trim() || !artistName.trim()) return { error: "Sezione e artista sono obbligatori." };

  const db = supabaseAdmin();
  const { count } = await db
    .from("track_sections")
    .select("id", { count: "exact", head: true })
    .eq("track_id", trackId);

  await db.from("track_sections").insert({
    track_id: trackId,
    label: label.trim(),
    artist_name: artistName.trim(),
    position: count ?? 0,
  });
  return { ok: true };
}

export async function deleteSection(sectionId: string) {
  await requireMaster();
  const db = supabaseAdmin();
  await db.from("track_sections").delete().eq("id", sectionId);
  return { ok: true };
}

/** Sostituisce integralmente le righe di testo sincronizzate di una traccia. */
export async function saveLyricsLines(trackId: string, lines: { text: string; timestampSeconds: number }[]) {
  await requireMaster();
  const db = supabaseAdmin();

  await db.from("track_lyrics_lines").delete().eq("track_id", trackId);

  if (lines.length === 0) return { ok: true };

  const rows = lines.map((l, i) => ({
    track_id: trackId,
    position: i,
    text: l.text,
    timestamp_seconds: l.timestampSeconds,
  }));

  const { error } = await db.from("track_lyrics_lines").insert(rows);
  if (error) return { error: "Errore nel salvataggio del testo." };
  return { ok: true };
}
