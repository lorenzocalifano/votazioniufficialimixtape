import { cookies } from "next/headers";
import { verifySession, JUDGE_COOKIE, MASTER_COOKIE } from "@/lib/session";

export async function getJudgeId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(JUDGE_COOKIE)?.value;
  const payload = await verifySession(token);
  return payload && payload.role === "judge" ? payload.judgeId : null;
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
