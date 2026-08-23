"use server";

import { del } from "@vercel/blob";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireMaster } from "@/lib/auth-helpers";

/**
 * Salva l'URL del file caricato dal browser direttamente su Vercel Blob
 * (l'upload stesso avviene client-side via /api/upload, questa funzione
 * riceve solo il link finale da persistere). Se sostituisce un file
 * precedente, lo rimuove: ogni upload usa un percorso univoco (mai lo stesso
 * URL riusato) per evitare risposte 416/range non valide dovute alla cache
 * del CDN sul vecchio file.
 */
export async function saveTrackAudioUrl(trackId: string, url: string) {
  await requireMaster();
  const db = supabaseAdmin();

  const { data: existing } = await db.from("tracks").select("audio_url").eq("id", trackId).single();
  if (existing?.audio_url && existing.audio_url !== url) {
    try {
      await del(existing.audio_url);
    } catch {
      // Se il vecchio file è già sparito, non è un errore bloccante.
    }
  }

  const { error } = await db.from("tracks").update({ audio_url: url }).eq("id", trackId);
  if (error) return { error: "Errore nel salvataggio dell'audio: " + error.message };
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
