"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { requireMaster } from "@/lib/auth-helpers";

// Alfabeto senza caratteri ambigui (niente 0/O, 1/I/L) per essere leggibili ad alta voce.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Genera un batch di codici anonimi per l'ingresso iniziale della serata. */
export async function generateInitialCodes(count: number) {
  await requireMaster();
  if (count < 1 || count > 200) return { error: "Numero non valido (1-200)." };

  const db = supabaseAdmin();
  const rows = Array.from({ length: count }, () => ({ code: generateCode() }));

  const { error } = await db.from("access_codes").insert(rows);
  if (error) return { error: "Errore nella generazione dei codici." };
  return { ok: true };
}

/** Genera un nuovo codice monouso per far rientrare un giurato già esistente. */
export async function regenerateCodeForJudge(judgeId: string) {
  await requireMaster();
  const db = supabaseAdmin();

  const code = generateCode();
  const { error } = await db.from("access_codes").insert({ code, judge_id: judgeId });
  if (error) return { error: "Errore nella generazione del codice." };
  return { ok: true, code };
}

/**
 * Disconnette forzatamente un ascoltatore: incrementa il suo session_epoch,
 * invalidando all'istante il cookie che ha in mano (il prossimo heartbeat o
 * caricamento traccia fallisce e viene rimandato al login). Il vecchio
 * codice resta comunque inutilizzabile: per farlo rientrare serve
 * "Rigenera codice".
 */
export async function disconnectJudge(judgeId: string) {
  await requireMaster();
  const db = supabaseAdmin();

  const { data: judge } = await db.from("judges").select("session_epoch").eq("id", judgeId).single();
  if (!judge) return { error: "Ascoltatore non trovato." };

  const { error } = await db
    .from("judges")
    .update({ session_epoch: judge.session_epoch + 1, last_seen_at: null })
    .eq("id", judgeId);

  if (error) return { error: "Errore nella disconnessione." };
  return { ok: true };
}

/** Cancella i codici generati ma mai distribuiti/usati (non tocca quelli già legati a un ascoltatore). */
export async function clearAvailableCodes() {
  await requireMaster();
  const db = supabaseAdmin();

  const { error } = await db.from("access_codes").delete().is("judge_id", null).is("used_at", null);
  if (error) return { error: "Errore nella cancellazione dei codici." };
  return { ok: true };
}

export async function getCodesOverview() {
  await requireMaster();
  const db = supabaseAdmin();

  const { data: available } = await db
    .from("access_codes")
    .select("id, code, created_at")
    .is("judge_id", null)
    .is("used_at", null)
    .order("created_at", { ascending: true });

  const { data: pending } = await db
    .from("access_codes")
    .select("id, code, created_at, judges(nickname)")
    .not("judge_id", "is", null)
    .is("used_at", null)
    .order("created_at", { ascending: true });

  return {
    available: available ?? [],
    pending:
      (pending ?? []).map((p: any) => ({
        id: p.id,
        code: p.code,
        createdAt: p.created_at,
        judgeNickname: p.judges?.nickname ?? null,
      })) ?? [],
  };
}
