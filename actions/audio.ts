"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { requireMaster } from "@/lib/auth-helpers";

const BUCKET = "track-audio";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 4; // dura più di una serata intera

function pathFor(trackId: string) {
  return `${trackId}.mp3`;
}

/**
 * Genera un "biglietto" di upload firmato: il browser userà questo token per
 * caricare il file DIRETTAMENTE su Supabase Storage, senza farlo transitare
 * dalla Server Action. Necessario perché Vercel limita a ~4.5MB il corpo
 * delle richieste alle funzioni serverless (un mp3 intero lo supera quasi
 * sempre) — passando dal server saremmo bloccati indipendentemente da
 * qualunque config di Next.js.
 */
export async function createAudioUploadTicket(trackId: string) {
  await requireMaster();
  if (!trackId) return { error: "Traccia non valida." };

  const db = supabaseAdmin();
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(pathFor(trackId), { upsert: true });

  if (error || !data) return { error: "Errore nella preparazione del caricamento." };
  return { ok: true, path: data.path, token: data.token };
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
