"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getTrackDetail,
  updateTrackTitle,
  addCredit,
  deleteCredit,
  addSection,
  deleteSection,
  saveLyricsLines,
  setTrackDuration,
} from "@/actions/tracks";
import { saveTrackAudioUrl, getTrackAudioUrl, deleteTrackAudio } from "@/actions/audio";
import { upload } from "@vercel/blob/client";
import { LyricsScroller } from "@/components/LyricsScroller";

type Detail = Awaited<ReturnType<typeof getTrackDetail>>;

export default function TrackEditorClient({ trackId }: { trackId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewElapsed, setPreviewElapsed] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [creditRole, setCreditRole] = useState<"producer" | "artist">("producer");
  const [creditName, setCreditName] = useState("");

  const [sectionLabel, setSectionLabel] = useState("");
  const [sectionArtist, setSectionArtist] = useState("");

  const [rawLyrics, setRawLyrics] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncIndex, setSyncIndex] = useState(0);
  const [syncLines, setSyncLines] = useState<string[]>([]);
  const [syncResult, setSyncResult] = useState<{ text: string; timestampSeconds: number }[] | null>(null);
  const capturedRef = useRef<number[]>([]);

  async function refresh() {
    const [d, audio] = await Promise.all([getTrackDetail(trackId), getTrackAudioUrl(trackId)]);
    setDetail(d);
    setAudioUrl(audio.url);
    if (d.track) setTitle(d.track.title);
    if (d.lines.length > 0) setRawLyrics(d.lines.map((l) => l.text).join("\n"));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  async function onSaveTitle() {
    setError(null);
    const result = await updateTrackTitle(trackId, title);
    if (result.error) return setError(result.error);
    refresh();
  }

  async function onUploadAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Il file deve essere un audio (mp3).");
      return;
    }
    setError(null);
    setUploading(true);

    try {
      // Il file va DIRETTAMENTE dal browser a Vercel Blob: passando dal
      // nostro server verrebbe bloccato dal limite di ~4.5MB per richiesta
      // delle funzioni serverless.
      const blob = await upload(`${trackId}-${Date.now()}.mp3`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: file.type,
      });
      const result = await saveTrackAudioUrl(trackId, blob.url);
      if (result.error) throw new Error(result.error);
      refresh();
    } catch (err) {
      setError("Errore nel caricamento dell'audio: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function onDeleteAudio() {
    if (!confirm("Rimuovere l'audio caricato per questa traccia?")) return;
    setError(null);
    const result = await deleteTrackAudio(trackId);
    if (result.error) return setError(result.error);
    refresh();
  }

  async function onAddCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!creditName.trim()) return;
    setError(null);
    const result = await addCredit(trackId, creditRole, creditName);
    if (result.error) return setError(result.error);
    setCreditName("");
    refresh();
  }

  async function onAddSection(e: React.FormEvent) {
    e.preventDefault();
    if (!sectionLabel.trim() || !sectionArtist.trim()) return;
    setError(null);
    const result = await addSection(trackId, sectionLabel, sectionArtist);
    if (result.error) return setError(result.error);
    setSectionLabel("");
    setSectionArtist("");
    refresh();
  }

  function startSync() {
    const lines = rawLyrics
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0 || !audioRef.current) return;
    setSyncLines(lines);
    setSyncResult(null);
    // La prima riga parte sempre esattamente all'inizio (0:00): non richiede
    // un tap, altrimenti il primo tap finirebbe assegnato a lei invece che
    // alla riga successiva, sfalsando tutto il resto di una posizione.
    capturedRef.current = [0];
    audioRef.current.currentTime = 0;
    audioRef.current.play();

    if (lines.length === 1) {
      setSyncResult([{ text: lines[0], timestampSeconds: 0 }]);
      setSyncing(false);
      return;
    }
    setSyncIndex(1);
    setSyncing(true);
  }

  function tapNextLine() {
    const elapsed = audioRef.current?.currentTime ?? 0;
    capturedRef.current.push(elapsed);
    if (capturedRef.current.length >= syncLines.length) {
      setSyncing(false);
      audioRef.current?.pause();
      setSyncResult(syncLines.map((text, i) => ({ text, timestampSeconds: Number(capturedRef.current[i].toFixed(2)) })));
    } else {
      setSyncIndex(capturedRef.current.length);
    }
  }

  function replayFromStart() {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  }

  function formatTimestamp(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(2).padStart(5, "0");
    return `${m}:${s}`;
  }

  function onExportLyrics() {
    if (!detail?.lines.length) return;
    const body = detail.lines
      .map((l) => `${formatTimestamp(Number(l.timestamp_seconds))}  ${l.text}`)
      .join("\n");
    const content = `${title}\n${"=".repeat(title.length)}\n\n${body}\n`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "testo"}-sincronizzato.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function cancelSync() {
    setSyncing(false);
    setSyncIndex(0);
    audioRef.current?.pause();
  }

  async function onSaveSyncedLyrics() {
    if (!syncResult) return;
    setError(null);
    const result = await saveLyricsLines(trackId, syncResult);
    if (result.error) return setError(result.error);
    setSyncResult(null);
    refresh();
  }

  if (!detail?.track) return <main className="p-8 text-center">Caricamento…</main>;

  return (
    <main className="enter mx-auto max-w-3xl space-y-8 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="glow-text text-2xl font-bold">Modifica traccia</h1>
        <Link href="/master/tracks" className="text-cyan hover:underline">
          ← Roster
        </Link>
      </header>

      {error && <p className="text-center text-sm text-magenta">{error}</p>}

      <section className="neon-card flex gap-3 p-6">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-dark flex-1 rounded-2xl px-4 py-2" />
        <button onClick={onSaveTitle} className="btn-glow rounded-2xl px-5 py-2">
          Salva titolo
        </button>
      </section>

      <section className="neon-card space-y-4 p-6">
        <h2 className="text-lg font-bold">Audio (mp3)</h2>
        <p className="text-sm text-white/50">
          Il file resta privato: si riproduce solo dal pannello Master (sulle casse dello studio), mai sui telefoni
          degli ascoltatori.
        </p>
        <audio
          ref={audioRef}
          src={audioUrl ?? undefined}
          controls
          onLoadedMetadata={(e) => {
            const duration = e.currentTarget.duration;
            if (Number.isFinite(duration)) setTrackDuration(trackId, duration);
          }}
          onTimeUpdate={(e) => setPreviewElapsed(e.currentTarget.currentTime)}
          className="w-full rounded-2xl accent-cyan"
        />
        <div className="flex items-center gap-3">
          <label className="btn-glow cursor-pointer rounded-2xl px-5 py-2">
            {uploading ? "Caricamento…" : audioUrl ? "Sostituisci mp3" : "Carica mp3"}
            <input type="file" accept="audio/*" onChange={onUploadAudio} disabled={uploading} className="hidden" />
          </label>
          {audioUrl && (
            <button onClick={onDeleteAudio} className="text-sm text-magenta hover:underline">
              Rimuovi
            </button>
          )}
        </div>
      </section>

      <section className="neon-card space-y-3 p-6">
        <h2 className="text-lg font-bold">Crediti (producer / artisti)</h2>
        <ul className="space-y-1">
          {detail.credits.map((c) => (
            <li key={c.id} className="flex items-center justify-between">
              <span>
                <span className="text-white/40">{c.role === "producer" ? "Prod." : "Feat."}</span> {c.name}
              </span>
              <button onClick={() => deleteCredit(c.id).then(refresh)} className="text-magenta hover:underline">
                rimuovi
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={onAddCredit} className="flex gap-2">
          <select value={creditRole} onChange={(e) => setCreditRole(e.target.value as any)} className="input-dark rounded-2xl px-3 py-2">
            <option value="producer">Producer</option>
            <option value="artist">Artista</option>
          </select>
          <input
            value={creditName}
            onChange={(e) => setCreditName(e.target.value)}
            placeholder="Nome"
            className="input-dark flex-1 rounded-2xl px-3 py-2"
          />
          <button type="submit" className="btn-glow rounded-2xl px-4 py-2">
            +
          </button>
        </form>
      </section>

      <section className="neon-card space-y-3 p-6">
        <h2 className="text-lg font-bold">Sezioni (ordine di strofa, per i voti granulari)</h2>
        <ul className="space-y-1">
          {detail.sections.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <span>
                <span className="text-white/40">{s.position + 1}.</span> {s.label} — {s.artist_name}
              </span>
              <button onClick={() => deleteSection(s.id).then(refresh)} className="text-magenta hover:underline">
                rimuovi
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={onAddSection} className="flex gap-2">
          <input
            value={sectionLabel}
            onChange={(e) => setSectionLabel(e.target.value)}
            placeholder="Es. Prima strofa"
            className="input-dark flex-1 rounded-2xl px-3 py-2"
          />
          <input
            value={sectionArtist}
            onChange={(e) => setSectionArtist(e.target.value)}
            placeholder="Artista"
            className="input-dark flex-1 rounded-2xl px-3 py-2"
          />
          <button type="submit" className="btn-glow rounded-2xl px-4 py-2">
            +
          </button>
        </form>
      </section>

      <section className="neon-card space-y-4 p-6">
        <h2 className="text-lg font-bold">Testo scorrevole sincronizzato</h2>
        <p className="text-sm text-white/50">
          Incolla il testo (una riga per riga), poi premi "Inizia sincronizzazione": l'mp3 caricato sopra parte
          davvero dall'inizio (la prima riga si considera sempre a 0:00, non serve toccare nulla per lei). Per ogni
          riga successiva, tocca il pulsante grande nell'esatto istante in cui SENTI iniziare la riga mostrata a
          schermo.
        </p>

        {!audioUrl && <p className="text-sm text-gold">Carica prima l'mp3 qui sopra per poter sincronizzare il testo.</p>}

        {!syncing && (
          <textarea
            value={rawLyrics}
            onChange={(e) => setRawLyrics(e.target.value)}
            rows={8}
            className="input-dark w-full rounded-2xl px-4 py-3 font-mono text-sm"
            placeholder={"Riga 1\nRiga 2\nRiga 3…"}
          />
        )}

        {!syncing && !syncResult && (
          <button onClick={startSync} disabled={!audioUrl} className="btn-glow rounded-2xl px-5 py-2">
            ▶ Inizia sincronizzazione
          </button>
        )}

        {syncing && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-white/50">
              Riga {syncIndex + 1} / {syncLines.length}
            </p>
            <p className="glow-text text-2xl font-bold">{syncLines[syncIndex]}</p>
            <button onClick={tapNextLine} className="btn-glow w-full rounded-2xl py-6 text-xl">
              TOCCA quando parte questa riga
            </button>
            <button onClick={cancelSync} className="text-sm text-white/40 hover:text-white/70">
              Annulla
            </button>
          </div>
        )}

        {syncResult && (
          <div className="space-y-3">
            <p className="text-sm text-white/50">Anteprima timestamp:</p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {syncResult.map((l, i) => (
                <li key={i} className="flex justify-between border-b border-white/5 py-1">
                  <span>{l.text}</span>
                  <span className="text-cyan">{l.timestampSeconds.toFixed(2)}s</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button onClick={onSaveSyncedLyrics} className="btn-glow rounded-2xl px-5 py-2">
                Salva testo
              </button>
              <button onClick={() => setSyncResult(null)} className="text-white/40 hover:text-white/70">
                Scarta e riprova
              </button>
            </div>
          </div>
        )}

        {!syncing && !syncResult && detail.lines.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-white/50">Testo attualmente salvato:</p>
              <div className="flex gap-2">
                <button onClick={onExportLyrics} className="neon-card rounded-2xl px-4 py-1.5 text-sm text-white/80">
                  ⭳ Esporta testo con timestamp
                </button>
                <button onClick={replayFromStart} disabled={!audioUrl} className="btn-glow rounded-2xl px-4 py-1.5 text-sm">
                  ▶ Riascolta come lo vedranno gli ascoltatori
                </button>
              </div>
            </div>
            <LyricsScroller lines={detail.lines} elapsed={previewElapsed} />
          </div>
        )}
      </section>
    </main>
  );
}
