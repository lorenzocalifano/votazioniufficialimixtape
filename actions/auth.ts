"use server";

import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { signSession, JUDGE_COOKIE, MASTER_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session";
import { getJudgeId } from "@/lib/auth-helpers";

export async function getMyJudgeId() {
  return getJudgeId();
}

function expiry() {
  return Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
}

/**
 * Riscatta un codice monouso (primo accesso o rientro dopo disconnessione)
 * e apre una sessione da giurato tramite cookie httpOnly firmato.
 */
export async function redeemCode(rawCode: string, nickname: string | null) {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { error: "Inserisci un codice." };

  const db = supabaseAdmin();

  const { data: codeRow, error: codeError } = await db
    .from("access_codes")
    .select("id, judge_id, used_at")
    .eq("code", code)
    .is("used_at", null)
    .maybeSingle();

  if (codeError) return { error: "Errore di connessione al database. Riprova." };
  if (!codeRow) return { error: "Codice non valido o già utilizzato. Chiedi all'organizzatore un nuovo codice." };

  let judgeId = codeRow.judge_id as string | null;

  if (!judgeId) {
    // Primo utilizzo di questo codice: nasce un nuovo giurato.
    const { data: newJudge, error: judgeError } = await db
      .from("judges")
      .insert({ nickname: nickname?.trim() || null, last_seen_at: new Date().toISOString() })
      .select("id")
      .single();

    if (judgeError || !newJudge) return { error: "Impossibile creare la sessione ascoltatore. Riprova." };
    judgeId = newJudge.id;
  } else {
    // Rientro dopo disconnessione: stesso giurato, si aggiorna solo last_seen_at.
    await db.from("judges").update({ last_seen_at: new Date().toISOString() }).eq("id", judgeId);
  }

  if (!judgeId) return { error: "Errore interno: ascoltatore non identificato." };

  await db.from("access_codes").update({ used_at: new Date().toISOString() }).eq("id", codeRow.id);

  const token = await signSession({ role: "judge", judgeId, exp: expiry() });
  (await cookies()).set(JUDGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return { ok: true };
}

export async function logoutJudge() {
  (await cookies()).delete(JUDGE_COOKIE);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function masterLogin(password: string) {
  const expected = process.env.MASTER_PASSWORD;
  if (!expected) return { error: "MASTER_PASSWORD non configurata sul server." };
  if (!password || !timingSafeEqual(password, expected)) {
    return { error: "Password errata." };
  }

  const token = await signSession({ role: "master", exp: expiry() });
  (await cookies()).set(MASTER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return { ok: true };
}

export async function logoutMaster() {
  (await cookies()).delete(MASTER_COOKIE);
}

/** Chiamato ogni ~15s dal client giurato per segnalarsi "online". */
export async function heartbeat(judgeId: string) {
  const db = supabaseAdmin();
  await db.from("judges").update({ last_seen_at: new Date().toISOString() }).eq("id", judgeId);
}
