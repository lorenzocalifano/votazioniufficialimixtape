"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDashboardSnapshot, playTrack, advanceToNextTrack, pausePlayback, resumePlayback } from "@/actions/session-state";
import { generateInitialCodes, regenerateCodeForJudge, getCodesOverview } from "@/actions/codes";
import { getTrackAudioUrl } from "@/actions/audio";
import { exportAllData } from "@/actions/export";
import { logoutMaster } from "@/actions/auth";

type Snapshot = Awaited<ReturnType<typeof getDashboardSnapshot>>;
type CodesOverview = Awaited<ReturnType<typeof getCodesOverview>>;

const POLL_MS = 4000;

export default function MasterDashboardPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [codes, setCodes] = useState<CodesOverview | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [newCodesCount, setNewCodesCount] = useState(45);
  const [regenerated, setRegenerated] = useState<Record<string, string>>({});
  const [countdown, setCountdown] = useState<number | null>(null);
  const [audioMissing, setAudioMissing] = useState(false);
  const advancingRef = useRef(false);
  const snapshotRef = useRef<Snapshot | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadedTrackIdRef = useRef<string | null>(null);

  snapshotRef.current = snapshot;

  async function refresh() {
    const [s, c] = await Promise.all([getDashboardSnapshot(), getCodesOverview()]);
    setSnapshot(s);
    setCodes(c);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Countdown automatico quando tutti gli ascoltatori attivi hanno votato.
  const phaseKey = `${snapshot?.state?.phase}-${snapshot?.state?.current_track_id}`;
  useEffect(() => {
    if (snapshot?.state?.phase === "all_done" && snapshot.state.current_track_id) {
      advancingRef.current = false;
      setCountdown(5);
    } else {
      setCountdown(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (!advancingRef.current) {
        advancingRef.current = true;
        advanceToNextTrack().then(refresh);
      }
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Carica e riproduce l'mp3 della traccia corrente: reagisce sia a un avvio
  // manuale sia all'avanzamento automatico, e riallinea la posizione se la
  // dashboard viene ricaricata a metà brano (o mentre è in pausa).
  const currentTrackId = snapshot?.state?.current_track_id ?? null;
  useEffect(() => {
    if (!currentTrackId) {
      loadedTrackIdRef.current = null;
      setAudioMissing(false);
      return;
    }
    if (loadedTrackIdRef.current === currentTrackId) return;
    loadedTrackIdRef.current = currentTrackId;

    (async () => {
      const { url } = await getTrackAudioUrl(currentTrackId);
      const audio = audioRef.current;
      if (!audio) return;

      if (!url) {
        setAudioMissing(true);
        audio.removeAttribute("src");
        return;
      }
      setAudioMissing(false);
      audio.src = url;

      const state = snapshotRef.current?.state;
      const elapsed = state?.track_started_at ? (Date.now() - new Date(state.track_started_at).getTime()) / 1000 : 0;
      audio.currentTime = state?.is_paused ? state.paused_position_seconds ?? 0 : Math.max(0, elapsed);

      if (!state?.is_paused) {
        try {
          await audio.play();
        } catch {
          // Autoplay bloccato dal browser: l'organizzatore avvia manualmente coi controlli nativi.
        }
      }
    })();
  }, [currentTrackId]);

  async function onPlay() {
    if (!selectedTrackId) return;
    loadedTrackIdRef.current = null; // forza ricarica/riavvio anche se è la stessa traccia
    await playTrack(selectedTrackId);
    refresh();
  }

  async function onAdvanceNow() {
    advancingRef.current = true;
    await advanceToNextTrack();
    refresh();
  }

  function onAudioPlay() {
    if (audioRef.current) resumePlayback(audioRef.current.currentTime);
  }
  function onAudioPause() {
    if (audioRef.current) pausePlayback(audioRef.current.currentTime);
  }
  function onAudioSeeked() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) pausePlayback(audio.currentTime);
    else resumePlayback(audio.currentTime);
  }

  async function onGenerateCodes() {
    await generateInitialCodes(newCodesCount);
    refresh();
  }

  async function onRegenerate(judgeId: string) {
    const result = await regenerateCodeForJudge(judgeId);
    if (result.code) setRegenerated((prev) => ({ ...prev, [judgeId]: result.code! }));
    refresh();
  }

  async function onExportJson() {
    const data = await exportAllData();
    downloadFile(`mixtape-export-${Date.now()}.json`, JSON.stringify(data, null, 2), "application/json");
  }

  async function onExportCsv() {
    const data = await exportAllData();
    const trackTitleById = new Map(data.tracks.map((t: any) => [t.id, t.title]));
    const listenerNameById = new Map(data.judges.map((j: any) => [j.id, j.nickname ?? j.id.slice(0, 8)]));
    const header = "traccia,ascoltatore,voto_generale,riascolterebbe,note\n";
    const rows = data.votes
      .map((v: any) =>
        [
          csvEscape(trackTitleById.get(v.track_id) ?? v.track_id),
          csvEscape(listenerNameById.get(v.judge_id) ?? v.judge_id),
          v.general_score,
          v.would_relisten ? "si" : "no",
          csvEscape(v.notes ?? ""),
        ].join(",")
      )
      .join("\n");
    downloadFile(`mixtape-voti-${Date.now()}.csv`, header + rows, "text/csv");
  }

  async function onLogout() {
    await logoutMaster();
    router.push("/master/login");
  }

  if (!snapshot || !codes) return <CenteredMessage title="Caricamento…" />;

  const currentTrack = snapshot.tracks.find((t) => t.id === snapshot.state?.current_track_id);

  return (
    <main className="enter mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="glow-text font-display text-3xl font-bold">Pannello Master</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/master/tracks" className="text-cyan hover:underline">
            Gestisci tracce
          </Link>
          <button onClick={onLogout} className="text-white/40 hover:text-white/70">
            Esci
          </button>
        </div>
      </header>

      <section className="neon-card space-y-4 p-6">
        <h2 className="font-display text-lg font-bold">Stato sessione</h2>
        <p className="text-white/70">
          Fase: <span className="font-semibold text-white">{snapshot.state?.phase}</span>
          {currentTrack && (
            <>
              {" · Traccia: "}
              <span className="font-semibold text-white">{currentTrack.title}</span>
            </>
          )}
        </p>
        <p className="text-white/70">
          Voti ricevuti: {snapshot.currentTrackVotedCount} / {snapshot.activeCount} ascoltatori attivi
        </p>

        {countdown !== null && (
          <div className="neon-card animate-pulseGlow border-acid/40 p-3 text-center text-acid">
            Tutti hanno votato! Prossima traccia tra {countdown}s
          </div>
        )}

        <audio
          ref={audioRef}
          controls
          onPlay={onAudioPlay}
          onPause={onAudioPause}
          onSeeked={onAudioSeeked}
          className={`w-full rounded-2xl accent-cyan ${currentTrackId ? "" : "hidden"}`}
        />
        {currentTrackId && audioMissing && (
          <p className="text-sm text-gold">
            Nessun mp3 caricato per questa traccia — caricalo dalla pagina "Gestisci tracce".
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedTrackId}
            onChange={(e) => setSelectedTrackId(e.target.value)}
            className="input-dark rounded-2xl px-3 py-2"
          >
            <option value="">Scegli traccia…</option>
            {snapshot.tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.position}. {t.title}
              </option>
            ))}
          </select>
          <button onClick={onPlay} disabled={!selectedTrackId} className="btn-glow rounded-2xl px-5 py-2">
            ▶ Avvia
          </button>
          <button
            onClick={onAdvanceNow}
            disabled={!snapshot.state?.current_track_id}
            className="neon-card rounded-2xl px-5 py-2 text-white/80"
          >
            Avanza ora
          </button>
        </div>
      </section>

      <section className="neon-card space-y-3 p-6">
        <h2 className="font-display text-lg font-bold">Classifica live</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-white/50">
              <tr>
                <th className="py-1">#</th>
                <th>Traccia</th>
                <th>Media</th>
                <th>Voti</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.ranking.map((r, i) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="py-1 text-white/40">{i + 1}</td>
                  <td>{r.title}</td>
                  <td className="glow-text font-bold">{r.average?.toFixed(2) ?? "—"}</td>
                  <td className="text-white/60">{r.votesCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="neon-card space-y-3 p-6">
        <h2 className="font-display text-lg font-bold">Ascoltatori ({snapshot.judges.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-white/50">
              <tr>
                <th className="py-1">Nome</th>
                <th>Stato</th>
                <th>Codice rientro</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.judges.map((j) => (
                <tr key={j.id} className="border-t border-white/5">
                  <td className="py-1">{j.nickname ?? j.id.slice(0, 8)}</td>
                  <td>
                    <span className={j.online ? "text-acid" : "text-white/30"}>
                      {j.online ? "● online" : "○ offline"}
                    </span>
                  </td>
                  <td>
                    {regenerated[j.id] ? (
                      <span className="glow-text font-mono font-bold">{regenerated[j.id]}</span>
                    ) : (
                      <button onClick={() => onRegenerate(j.id)} className="text-cyan hover:underline">
                        Rigenera codice
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="neon-card space-y-4 p-6">
        <h2 className="font-display text-lg font-bold">Codici d'ingresso</h2>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={200}
            value={newCodesCount}
            onChange={(e) => setNewCodesCount(parseInt(e.target.value) || 0)}
            className="input-dark w-24 rounded-2xl px-3 py-2"
          />
          <button onClick={onGenerateCodes} className="btn-glow rounded-2xl px-5 py-2">
            Genera codici iniziali
          </button>
        </div>
        {codes.available.length > 0 && (
          <div>
            <p className="mb-1 text-sm text-white/50">Disponibili da distribuire ({codes.available.length}):</p>
            <div className="flex flex-wrap gap-2">
              {codes.available.map((c) => (
                <span key={c.id} className="glow-text rounded-xl border border-white/10 px-3 py-1 font-mono font-bold">
                  {c.code}
                </span>
              ))}
            </div>
          </div>
        )}
        {codes.pending.length > 0 && (
          <div>
            <p className="mb-1 text-sm text-white/50">In attesa di rientro:</p>
            <div className="flex flex-wrap gap-2">
              {codes.pending.map((c) => (
                <span key={c.id} className="rounded-xl border border-magenta/40 px-3 py-1 font-mono">
                  {c.code} <span className="text-white/40">({c.judgeNickname ?? "?"})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="neon-card space-y-3 p-6">
        <h2 className="font-display text-lg font-bold">Export dati (per analisi IA)</h2>
        <div className="flex gap-3">
          <button onClick={onExportJson} className="neon-card rounded-2xl px-5 py-2 text-white/80">
            Esporta JSON completo
          </button>
          <button onClick={onExportCsv} className="neon-card rounded-2xl px-5 py-2 text-white/80">
            Esporta voti (CSV)
          </button>
        </div>
      </section>
    </main>
  );
}

function csvEscape(value: string) {
  const v = String(value ?? "");
  return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CenteredMessage({ title }: { title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="glow-text font-display text-xl">{title}</p>
    </main>
  );
}
