"use server";

import { del } from "@vercel/blob";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireMaster } from "@/lib/auth-helpers";

/**
 * Salva l'URL del file caricato dal browser direttamente su Vercel Blob
 * (l'upload stesso avviene client-side via /api/upload, questa funzione
 * riceve solo il link finale da persistere).
 */
export async function saveTrackAudioUrl(trackId: string, url: string) {
  await requireMaster();
  const db = supabaseAdmin();
  const { error } = await db.from("tracks").update({ audio_url: url }).eq("id", trackId);
  if (error) return { error: "Errore nel salvataggio dell'audio." };
  return { ok: true };
}

export async function getTrackAudioUrl(trackId: string) {
  await requireMaster();
  const db = supabaseAdmin();
  const { data } = await db.from("tracks").select("audio_url").eq("id", trackId).single();
  return { url: data?.audio_url ?? null };
}

export async function deleteTrackAudio(trackId: string) {
  await requireMaster();
  const db = supabaseAdmin();

  const { data } = await db.from("tracks").select("audio_url").eq("id", trackId).single();
  if (data?.audio_url) {
    try {
      await del(data.audio_url);
    } catch {
      // Se il file è già stato rimosso lato Vercel Blob, non è un errore bloccante.
    }
  }

  const { error } = await db.from("tracks").update({ audio_url: null }).eq("id", trackId);
  if (error) return { error: "Errore nella rimozione dell'audio." };
  return { ok: true };
}
