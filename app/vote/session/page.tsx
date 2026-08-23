"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getMyJudgeId, heartbeat, logoutJudge } from "@/actions/auth";
import { getSessionState, getTrackForJudge, getScheduleTracks } from "@/actions/public-state";
import { submitVote } from "@/actions/votes";
import { ScoreSlider } from "@/components/ScoreSlider";
import { ProgressScreen } from "@/components/ProgressScreen";
import { LyricsScroller } from "@/components/LyricsScroller";
import { formatClock, ScheduleTrack } from "@/lib/schedule";

type SessionState = {
  current_track_id: string | null;
  phase: "lobby" | "voting" | "all_done" | "break";
  track_started_at: string | null;
  is_paused: boolean;
  paused_position_seconds: number | null;
  break_until: string | null;
};

type TrackData = Awaited<ReturnType<typeof getTrackForJudge>>;

const HEARTBEAT_MS = 15_000;
const STATE_POLL_FALLBACK_MS = 8_000;

export default function VoteSessionPage() {
  const router = useRouter();
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [scheduleTracks, setScheduleTracks] = useState<ScheduleTrack[]>([]);
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [generalScore, setGeneralScore] = useState(6);
  const [productionScore, setProductionScore] = useState(6);
  const [wouldRelisten, setWouldRelisten] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [sectionScores, setSectionScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Identità ascoltatore (dal cookie httpOnly, non leggibile lato client se non via server action).
  useEffect(() => {
    getMyJudgeId().then(setJudgeId);
  }, []);

  // Elenco tracce con durate: serve solo per la barra di avanzamento, è statico.
  useEffect(() => {
    getScheduleTracks().then(setScheduleTracks);
  }, []);

  // Heartbeat periodico: mantiene l'ascoltatore "online" per il conteggio
  // votanti attivi. Se il Master ha disconnesso forzatamente la sessione,
  // l'heartbeat fallisce e si torna al login.
  useEffect(() => {
    if (!judgeId) return;
    const ping = () => heartbeat().catch(() => router.push("/vote/login"));
    ping();
    const interval = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judgeId]);

  // Stato sessione: realtime (istantaneo) + poll di sicurezza a bassa frequenza.
  useEffect(() => {
    let active = true;
    getSessionState().then((s) => active && setSessionState(s as SessionState));

    const client = supabaseBrowser();
    const channel = client
      .channel("session_state_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "session_state" },
        (payload) => setSessionState(payload.new as SessionState)
      )
      .subscribe();

    const poll = setInterval(() => {
      getSessionState().then((s) => active && setSessionState(s as SessionState));
    }, STATE_POLL_FALLBACK_MS);

    return () => {
      active = false;
      client.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  // Quando cambia la traccia corrente, carica crediti/sezioni/testo e resetta il form.
  useEffect(() => {
    const trackId = sessionState?.current_track_id;
    if (!trackId) {
      setTrackData(null);
      return;
    }
    getTrackForJudge(trackId).then((data) => {
      setTrackData(data);
      setGeneralScore(6);
      setProductionScore(6);
      setWouldRelisten(null);
      setNotes("");
      const defaults: Record<string, number> = {};
      for (const s of data.sections) defaults[s.id] = 6;
      setSectionScores(defaults);
      setJustSubmitted(false);
      setShowConfirm(false);
    }).catch(() => router.push("/vote/login"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState?.current_track_id]);

  // Timer di riproduzione per lo scroll del testo sincronizzato. Quando il
  // Master mette in pausa l'audio, il testo si ferma sulla stessa posizione.
  useEffect(() => {
    if (sessionState?.is_paused) {
      setElapsed(sessionState.paused_position_seconds ?? 0);
      return;
    }
    if (!sessionState?.track_started_at) {
      setElapsed(0);
      return;
    }
    const startedAt = new Date(sessionState.track_started_at).getTime();
    const tick = () => setElapsed((Date.now() - startedAt) / 1000);
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [sessionState?.track_started_at, sessionState?.is_paused, sessionState?.paused_position_seconds]);

  function onRequestVote(e: React.FormEvent) {
    e.preventDefault();
    if (wouldRelisten === null) return;
    setShowConfirm(true);
  }

  async function onConfirmVote() {
    if (!trackData?.track) return;
    setShowConfirm(false);
    setSubmitting(true);
    setSubmitError(null);

    let result;
    try {
      result = await submitVote({
        trackId: trackData.track.id,
        generalScore,
        productionScore,
        wouldRelisten: wouldRelisten!,
        notes,
        sectionScores: Object.entries(sectionScores).map(([sectionId, score]) => ({ sectionId, score })),
      });
    } catch {
      router.push("/vote/login");
      return;
    }

    setSubmitting(false);
    if (result.error) {
      setSubmitError(result.error);
      return;
    }
    setJustSubmitted(true);
  }

  async function onLogout() {
    await logoutJudge();
    router.push("/vote/login");
  }

  if (!sessionState) {
    return <CenteredMessage title="Caricamento…" />;
  }

  if (!sessionState.current_track_id) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <ProgressScreen
          tracks={scheduleTracks}
          state={sessionState}
          statusTitle={sessionState.phase === "all_done" ? "Serata conclusa 🎉" : "In attesa…"}
          statusSubtitle={
            sessionState.phase === "all_done"
              ? "Grazie per aver votato tutte le tracce!"
              : "L'organizzatore sta per avviare la prima traccia."
          }
        />
        {sessionState.phase === "all_done" && <LogoutButton onLogout={onLogout} />}
      </main>
    );
  }

  if (!trackData?.track) {
    return <CenteredMessage title="Caricamento traccia…" />;
  }

  const hasVoted = trackData.hasVoted || justSubmitted;
  const showProgressScreen = sessionState.phase !== "voting" || hasVoted;

  if (showProgressScreen) {
    let title = "Hai votato ✓";
    let subtitle = "In attesa che gli altri ascoltatori finiscano di votare…";
    if (sessionState.phase === "break") {
      title = "Pausa ☕";
      subtitle = sessionState.break_until
        ? `Si riprende alle ${formatClock(new Date(sessionState.break_until))}`
        : "Si riprende a breve";
    } else if (sessionState.phase === "all_done") {
      title = "Tutti hanno votato 🎉";
      subtitle = "Si passa alla prossima traccia a breve";
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <ProgressScreen tracks={scheduleTracks} state={sessionState} statusTitle={title} statusSubtitle={subtitle} />
        <LogoutButton onLogout={onLogout} />
      </main>
    );
  }

  const producerNames = trackData.credits
    .filter((c) => c.role === "producer")
    .map((c) => c.name)
    .join(", ");

  return (
    <main key={trackData.track.id} className="enter mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-6">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Traccia in ascolto</p>
        <h1 className="glow-text text-3xl font-bold">{trackData.track.title}</h1>
        <p className="mt-2 text-sm text-white/60">{trackData.credits.map((c) => c.name).join(" · ")}</p>
      </header>

      <LyricsScroller lines={trackData.lines} elapsed={elapsed} />

      <form onSubmit={onRequestVote} className="neon-card space-y-6 p-6">
        <ScoreSlider label="Voto generale" value={generalScore} onChange={setGeneralScore} />
        <ScoreSlider
          label="Voto produzione (beat)"
          sublabel={producerNames || undefined}
          value={productionScore}
          onChange={setProductionScore}
        />

        <div>
          <p className="mb-2 font-medium">La riascolteresti?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setWouldRelisten(true)}
              className={`flex-1 rounded-2xl py-2 font-semibold ${
                wouldRelisten === true ? "btn-glow" : "neon-card text-white/70"
              }`}
            >
              Sì
            </button>
            <button
              type="button"
              onClick={() => setWouldRelisten(false)}
              className={`flex-1 rounded-2xl py-2 font-semibold ${
                wouldRelisten === false ? "bg-magenta text-void" : "neon-card text-white/70"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {trackData.sections.length > 0 && (
          <div className="space-y-4 border-t border-white/10 pt-4">
            <p className="text-sm uppercase tracking-widest text-white/50">Voti per sezione</p>
            {trackData.sections.map((s) => (
              <ScoreSlider
                key={s.id}
                label={s.label}
                sublabel={s.artist_name}
                value={sectionScores[s.id] ?? 6}
                onChange={(v) => setSectionScores((prev) => ({ ...prev, [s.id]: v }))}
              />
            ))}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm text-white/70">
            Note (facoltativo)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Consigli, correzioni al testo, feedback libero…"
            className="input-dark w-full rounded-2xl px-4 py-3"
          />
        </div>

        {submitError && <p className="text-center text-sm text-magenta">{submitError}</p>}

        <button type="submit" disabled={submitting || wouldRelisten === null} className="btn-glow w-full rounded-2xl py-3 text-lg">
          {submitting ? "Invio…" : "Vota"}
        </button>
      </form>

      <LogoutButton onLogout={onLogout} />

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="enter neon-card w-full max-w-sm space-y-5 p-6 text-center">
            <p className="text-lg font-bold">Confermi il voto?</p>
            <p className="text-sm text-white/60">Dopo la conferma non potrai più modificarlo per questa traccia.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="neon-card flex-1 rounded-2xl py-2 text-white/80">
                No
              </button>
              <button onClick={onConfirmVote} className="btn-glow flex-1 rounded-2xl py-2">
                Sì
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function CenteredMessage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="enter flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="glow-text text-2xl font-bold">{title}</h1>
      {subtitle && <p className="max-w-sm text-white/60">{subtitle}</p>}
      {children}
    </main>
  );
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <button onClick={onLogout} className="mx-auto text-sm text-white/40 underline hover:text-white/70">
      Esci
    </button>
  );
}
