"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getMyJudgeId, heartbeat, logoutJudge } from "@/actions/auth";
import { getSessionState, getTrackForJudge } from "@/actions/public-state";
import { submitVote } from "@/actions/votes";
import { ScoreSlider } from "@/components/ScoreSlider";

type SessionState = {
  current_track_id: string | null;
  phase: "lobby" | "voting" | "all_done";
  track_started_at: string | null;
};

type TrackData = Awaited<ReturnType<typeof getTrackForJudge>>;

const HEARTBEAT_MS = 15_000;
const STATE_POLL_FALLBACK_MS = 8_000;

export default function VoteSessionPage() {
  const router = useRouter();
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [generalScore, setGeneralScore] = useState(6);
  const [wouldRelisten, setWouldRelisten] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [sectionScores, setSectionScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const lineRefs = useRef<Record<number, HTMLParagraphElement | null>>({});
  const lastLineIndexRef = useRef(-1);

  // Identità giurato (dal cookie httpOnly, non leggibile lato client se non via server action).
  useEffect(() => {
    getMyJudgeId().then(setJudgeId);
  }, []);

  // Heartbeat periodico: mantiene il giurato "online" per il conteggio votanti attivi.
  useEffect(() => {
    if (!judgeId) return;
    heartbeat(judgeId);
    const interval = setInterval(() => heartbeat(judgeId), HEARTBEAT_MS);
    return () => clearInterval(interval);
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
      setWouldRelisten(null);
      setNotes("");
      const defaults: Record<string, number> = {};
      for (const s of data.sections) defaults[s.id] = 6;
      setSectionScores(defaults);
      setJustSubmitted(false);
      lastLineIndexRef.current = -1;
    });
  }, [sessionState?.current_track_id]);

  // Timer di riproduzione per lo scroll del testo sincronizzato.
  useEffect(() => {
    if (!sessionState?.track_started_at) {
      setElapsed(0);
      return;
    }
    const startedAt = new Date(sessionState.track_started_at).getTime();
    const tick = () => setElapsed((Date.now() - startedAt) / 1000);
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [sessionState?.track_started_at]);

  const currentLineIndex = useMemo(() => {
    if (!trackData?.lines?.length) return -1;
    let idx = -1;
    for (let i = 0; i < trackData.lines.length; i++) {
      if (trackData.lines[i].timestamp_seconds <= elapsed) idx = i;
      else break;
    }
    return idx;
  }, [trackData?.lines, elapsed]);

  useEffect(() => {
    if (currentLineIndex !== lastLineIndexRef.current && currentLineIndex >= 0) {
      lastLineIndexRef.current = currentLineIndex;
      lineRefs.current[currentLineIndex]?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [currentLineIndex]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (wouldRelisten === null || !trackData?.track) return;
    setSubmitting(true);
    setSubmitError(null);

    const result = await submitVote({
      trackId: trackData.track.id,
      generalScore,
      wouldRelisten,
      notes,
      sectionScores: Object.entries(sectionScores).map(([sectionId, score]) => ({ sectionId, score })),
    });

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
    if (sessionState.phase === "all_done") {
      return (
        <CenteredMessage title="Serata conclusa 🎉" subtitle="Grazie per aver votato tutte le tracce!">
          <LogoutButton onLogout={onLogout} />
        </CenteredMessage>
      );
    }
    return (
      <CenteredMessage
        title="In attesa…"
        subtitle="L'organizzatore sta per avviare la prima traccia. Resta su questa pagina."
      />
    );
  }

  if (!trackData?.track) {
    return <CenteredMessage title="Caricamento traccia…" />;
  }

  const hasVoted = trackData.hasVoted || justSubmitted;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-6">
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-cyan">Traccia in ascolto</p>
        <h1 className="glow-text text-3xl font-black">{trackData.track.title}</h1>
        <p className="mt-2 text-sm text-white/60">
          {trackData.credits.map((c) => c.name).join(" · ")}
        </p>
      </header>

      {sessionState.phase === "all_done" && (
        <div className="neon-card animate-pulseGlow border-acid/40 p-4 text-center text-acid">
          Tutti hanno votato! Si passa alla prossima traccia a breve.
        </div>
      )}

      {trackData.lines.length > 0 && (
        <div className="neon-card max-h-64 overflow-y-auto p-4">
          {trackData.lines.map((line, i) => (
            <p
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              className={
                i === currentLineIndex
                  ? "glow-text py-1 text-lg font-bold text-white transition-colors"
                  : "py-1 text-white/40 transition-colors"
              }
            >
              {line.text}
            </p>
          ))}
        </div>
      )}

      {hasVoted ? (
        <div className="neon-card p-6 text-center">
          <p className="text-lg font-semibold text-acid">Hai votato ✓</p>
          <p className="mt-1 text-sm text-white/60">In attesa che tutti gli altri giurati finiscano di votare…</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="neon-card space-y-6 p-6">
          <ScoreSlider label="Voto generale" value={generalScore} onChange={setGeneralScore} />

          <div>
            <p className="mb-2 font-medium">La riascolteresti?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWouldRelisten(true)}
                className={`flex-1 rounded-lg py-2 font-semibold ${
                  wouldRelisten === true ? "btn-glow" : "neon-card text-white/70"
                }`}
              >
                Sì
              </button>
              <button
                type="button"
                onClick={() => setWouldRelisten(false)}
                className={`flex-1 rounded-lg py-2 font-semibold ${
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
              className="input-dark w-full rounded-lg px-4 py-3"
            />
          </div>

          {submitError && <p className="text-center text-sm text-magenta">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting || wouldRelisten === null}
            className="btn-glow w-full rounded-lg py-3 text-lg"
          >
            {submitting ? "Invio…" : "Invia voto"}
          </button>
        </form>
      )}

      <LogoutButton onLogout={onLogout} />
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
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
