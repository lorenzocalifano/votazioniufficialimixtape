"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { requireMaster } from "@/lib/auth-helpers";
import { breakMinutesAfterPosition } from "@/lib/schedule";

// Un ascoltatore è considerato "online" se ha mandato un heartbeat negli
// ultimi 45s (heartbeat ogni ~15s dal client: tollera un po' di jitter di rete).
const ACTIVE_WINDOW_SECONDS = 45;

function activeSinceIso(): string {
  return new Date(Date.now() - ACTIVE_WINDOW_SECONDS * 1000).toISOString();
}

/** Id degli ascoltatori attualmente online, in base all'ultimo heartbeat ricevuto. */
async function getActiveJudgeIds(db: ReturnType<typeof supabaseAdmin>): Promise<string[]> {
  const { data } = await db.from("judges").select("id").gte("last_seen_at", activeSinceIso());
  return (data ?? []).map((j) => j.id);
}

/**
 * Dopo ogni voto: se tutti gli ascoltatori attualmente online hanno votato la
 * traccia corrente, la fase avanza. Se questa traccia è un punto di pausa
 * programmato (ogni 3 tracce, pausa più lunga dopo la decima) la fase diventa
 * "break" con un orario di fine pausa; altrimenti "all_done" per la breve
 * transizione automatica. L'update è condizionato su phase='voting' così
 * scatta una volta sola.
 */
export async function checkAndMaybeFinishVoting(trackId: string) {
  const db = supabaseAdmin();
  const activeIds = await getActiveJudgeIds(db);
  if (activeIds.length === 0) return;

  const { count } = await db
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("track_id", trackId)
    .in("judge_id", activeIds);

  if ((count ?? 0) < activeIds.length) return;

  const { data: track } = await db.from("tracks").select("position").eq("id", trackId).single();
  const breakMinutes = track ? breakMinutesAfterPosition(track.position) : 0;
  const now = new Date();

  const update = breakMinutes
    ? { phase: "break", break_until: new Date(now.getTime() + breakMinutes * 60_000).toISOString(), updated_at: now.toISOString() }
    : { phase: "all_done", updated_at: now.toISOString() };

  await db.from("session_state").update(update).eq("id", 1).eq("current_track_id", trackId).eq("phase", "voting");
}

/**
 * Master: riporta la sessione alla lobby (nessuna traccia corrente, in attesa
 * di avvio). Non tocca i voti già registrati né i codici/ascoltatori: serve
 * per "sbloccare" chi entra e si vede dire "serata conclusa" dopo un test,
 * non per azzerare i dati.
 */
export async function resetSessionToLobby() {
  await requireMaster();
  const db = supabaseAdmin();

  const { error } = await db
    .from("session_state")
    .update({
      current_track_id: null,
      phase: "lobby",
      track_started_at: null,
      is_paused: false,
      paused_position_seconds: null,
      break_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return { error: "Impossibile resettare la sessione." };
  return { ok: true };
}

/**
 * Master: imposta la traccia indicata come corrente e apre le votazioni.
 * track_started_at è l'"ancora" da cui i client calcolano la posizione del
 * testo scorrevole (elapsed = now - track_started_at); dato che la traccia
 * riparte sempre da 0, l'ancora coincide con l'istante corrente.
 */
export async function playTrack(trackId: string) {
  await requireMaster();
  const db = supabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await db
    .from("session_state")
    .update({
      current_track_id: trackId,
      phase: "voting",
      track_started_at: now,
      is_paused: false,
      paused_position_seconds: null,
      break_until: null,
      updated_at: now,
    })
    .eq("id", 1);

  if (error) return { error: "Impossibile avviare la traccia." };
  return { ok: true };
}

/** Master: mette in pausa la riproduzione alla posizione indicata (secondi). */
export async function pausePlayback(currentTimeSeconds: number) {
  await requireMaster();
  const db = supabaseAdmin();

  const { error } = await db
    .from("session_state")
    .update({ is_paused: true, paused_position_seconds: currentTimeSeconds, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) return { error: "Impossibile mettere in pausa." };
  return { ok: true };
}

/**
 * Master: riprende la riproduzione dalla posizione indicata, ricalcolando
 * l'ancora così che elapsed = now - track_started_at torni a coincidere con
 * la posizione reale dell'audio.
 */
export async function resumePlayback(currentTimeSeconds: number) {
  await requireMaster();
  const db = supabaseAdmin();
  const anchor = new Date(Date.now() - currentTimeSeconds * 1000).toISOString();

  const { error } = await db
    .from("session_state")
    .update({
      is_paused: false,
      paused_position_seconds: null,
      track_started_at: anchor,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return { error: "Impossibile riprendere la riproduzione." };
  return { ok: true };
}

/**
 * Passa alla traccia successiva per posizione. Se non ce ne sono altre, chiude
 * la serata (current_track_id = null, phase = 'all_done').
 * Chiamata sia dal countdown automatico lato Master sia da un comando manuale.
 */
export async function advanceToNextTrack() {
  await requireMaster();
  const db = supabaseAdmin();

  const { data: state } = await db.from("session_state").select("current_track_id").eq("id", 1).single();
  if (!state?.current_track_id) return { error: "Nessuna traccia attiva." };

  const { data: currentTrack } = await db.from("tracks").select("position").eq("id", state.current_track_id).single();
  if (!currentTrack) return { error: "Traccia corrente non trovata." };

  const { data: nextTrack } = await db
    .from("tracks")
    .select("id")
    .gt("position", currentTrack.position)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();

  if (nextTrack) {
    await db
      .from("session_state")
      .update({
        current_track_id: nextTrack.id,
        phase: "voting",
        track_started_at: now,
        is_paused: false,
        paused_position_seconds: null,
        break_until: null,
        updated_at: now,
      })
      .eq("id", 1);
  } else {
    await db
      .from("session_state")
      .update({
        current_track_id: null,
        phase: "all_done",
        track_started_at: null,
        is_paused: false,
        paused_position_seconds: null,
        break_until: null,
        updated_at: now,
      })
      .eq("id", 1);
  }

  return { ok: true };
}

export async function getDashboardSnapshot() {
  await requireMaster();
  const db = supabaseAdmin();

  const [{ data: state }, { data: tracks }, { data: judges }] = await Promise.all([
    db.from("session_state").select("*").eq("id", 1).single(),
    db.from("tracks").select("id, position, title, duration_seconds").order("position", { ascending: true }),
    db.from("judges").select("id, nickname, last_seen_at").order("created_at", { ascending: true }),
  ]);

  const activeSince = activeSinceIso();
  const judgesWithStatus = (judges ?? []).map((j) => ({
    ...j,
    online: !!j.last_seen_at && j.last_seen_at >= activeSince,
  }));
  const activeCount = judgesWithStatus.filter((j) => j.online).length;

  const { data: allVotes } = await db.from("votes").select("track_id, judge_id, general_score");

  const votesByTrack = new Map<string, { sum: number; count: number; judgeIds: Set<string> }>();
  for (const v of allVotes ?? []) {
    const entry = votesByTrack.get(v.track_id) ?? { sum: 0, count: 0, judgeIds: new Set<string>() };
    entry.sum += Number(v.general_score);
    entry.count += 1;
    entry.judgeIds.add(v.judge_id);
    votesByTrack.set(v.track_id, entry);
  }

  const ranking = (tracks ?? [])
    .map((t) => {
      const entry = votesByTrack.get(t.id);
      return {
        id: t.id,
        title: t.title,
        position: t.position,
        votesCount: entry?.count ?? 0,
        average: entry ? entry.sum / entry.count : null,
      };
    })
    .sort((a, b) => (b.average ?? -1) - (a.average ?? -1));

  const currentTrackVotedCount = state?.current_track_id
    ? votesByTrack.get(state.current_track_id)?.judgeIds.size ?? 0
    : 0;

  return {
    state,
    tracks: tracks ?? [],
    judges: judgesWithStatus,
    activeCount,
    currentTrackVotedCount,
    ranking,
  };
}
