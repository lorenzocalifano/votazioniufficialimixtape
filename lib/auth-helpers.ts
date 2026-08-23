import { cookies } from "next/headers";
import { verifySession, JUDGE_COOKIE, MASTER_COOKIE } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Valida il cookie E che l'epoch firmato coincida ancora con quello salvato
 * sul giurato: il Master può forzare la disconnessione incrementando
 * `session_epoch`, il che invalida istantaneamente ogni cookie emesso prima.
 */
export async function getJudgeId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(JUDGE_COOKIE)?.value;
  const payload = await verifySession(token);
  if (!payload || payload.role !== "judge") return null;

  const db = supabaseAdmin();
  const { data } = await db.from("judges").select("session_epoch").eq("id", payload.judgeId).maybeSingle();
  if (!data || data.session_epoch !== payload.epoch) return null;

  return payload.judgeId;
}

export async function requireJudgeId(): Promise<string> {
  const judgeId = await getJudgeId();
  if (!judgeId) throw new Error("Sessione ascoltatore non valida o scaduta.");
  return judgeId;
}

export async function isMaster(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(MASTER_COOKIE)?.value;
  const payload = await verifySession(token);
  return !!payload && payload.role === "master";
}

export async function requireMaster(): Promise<void> {
  if (!(await isMaster())) throw new Error("Sessione organizzatore non valida o scaduta.");
}
