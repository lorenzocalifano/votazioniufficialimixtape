"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { requireMaster } from "@/lib/auth-helpers";

const BUCKET = "track-audio";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 4; // dura più di una serata intera

function pathFor(trackId: string) {
  return `${trackId}.mp3`;
}

/**
 * Carica il file audio di una traccia. Il bucket è privato: l'unico modo per
 * ottenere un URL riproducibile è passare da getTrackAudioUrl (Master-only),
 * quindi il file non è mai raggiungibile dal telefono degli ascoltatori.
 */
export async function uploadTrackAudio(formData: FormData) {
  await requireMaster();

  const trackId = formData.get("trackId");
  const file = formData.get("file");

  if (typeof trackId !== "string" || !trackId) return { error: "Traccia non valida." };
  if (!(file instanceof File)) return { error: "Nessun file ricevuto." };
  if (!file.type.startsWith("audio/")) return { error: "Il file deve essere un audio (mp3)." };

  const db = supabaseAdmin();
  const { error } = await db.storage.from(BUCKET).upload(pathFor(trackId), file, {
    upsert: true,
    contentType: file.type || "audio/mpeg",
  });

  if (error) return { error: "Errore nel caricamento dell'audio." };
  return { ok: true };
}

export async function getTrackAudioUrl(trackId: string) {
  await requireMaster();
  const db = supabaseAdmin();

  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(pathFor(trackId), SIGNED_URL_TTL_SECONDS);
  if (error || !data) return { url: null };
  return { url: data.signedUrl };
}

export async function deleteTrackAudio(trackId: string) {
  await requireMaster();
  const db = supabaseAdmin();
  const { error } = await db.storage.from(BUCKET).remove([pathFor(trackId)]);
  if (error) return { error: "Errore nella rimozione dell'audio." };
  return { ok: true };
}
