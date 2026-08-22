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
import { createAudioUploadTicket, getTrackAudioUrl, deleteTrackAudio } from "@/actions/audio";
import { supabaseBrowser } from "@/lib/supabase/client";

type Detail = Awaited<ReturnType<typeof getTrackDetail>>;

export default function TrackEditorClient({ trackId }: { trackId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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

    // Il file va DIRETTAMENTE dal browser a Supabase Storage con un URL
    // firmato: passando dal nostro server verrebbe bloccato dal limite di
    // ~4.5MB per richiesta imposto da Vercel sulle funzioni serverless.
    const ticket = await createAudioUploadTicket(trackId);
    if (ticket.error || !ticket.path || !ticket.token) {
      setUploading(false);
      setError(ticket.error ?? "Errore nella preparazione del caricamento.");
      return;
    }

    const { error } = await supabaseBrowser()
      .storage.from("track-audio")
      .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });

    setUploading(false);
    if (error) {
      setError("Errore nel caricamento dell'audio: " + error.message);
      return;
    }
    refresh();
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
    setSyncIndex(0);
    setSyncResult(null);
    capturedRef.current = [];
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    setSyncing(true);
  }

  function tapNextLine() {
    const elapsed = audioRef.current?.currentTime ?? 0;
    capturedRef.current.push(elapsed);
    if (syncIndex + 1 >= syncLines.length) {
      setSyncing(false);
      audioRef.current?.pause();
      setSyncResult(syncLines.map((text, i) => ({ text, timestampSeconds: Number(capturedRef.current[i].toFixed(2)) })));
    } else {
      setSyncIndex((i) => i + 1);
    }
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
        <h1 className="glow-text font-display text-2xl font-bold">Modifica traccia</h1>
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
        <h2 className="font-display text-lg font-bold">Audio (mp3)</h2>
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
        <h2 className="font-display text-lg font-bold">Crediti (producer / artisti)</h2>
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
        <h2 className="font-display text-lg font-bold">Sezioni (ordine di strofa, per i voti granulari)</h2>
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
        <h2 className="font-display text-lg font-bold">Testo scorrevole sincronizzato</h2>
        <p className="text-sm text-white/50">
          Incolla il testo (una riga per riga), poi premi "Inizia sincronizzazione": l'mp3 caricato sopra parte
          davvero, e ogni tap sul pulsante grande registra la posizione esatta della traccia per quella riga.
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
            <p className="glow-text font-display text-2xl font-bold">{syncLines[syncIndex]}</p>
            <button onClick={tapNextLine} className="btn-glow w-full rounded-2xl py-6 text-xl">
              TOCCA per la prossima riga
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
          <div>
            <p className="mb-1 text-sm text-white/50">Testo attualmente salvato:</p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-white/70">
              {detail.lines.map((l) => (
                <li key={l.position} className="flex justify-between border-b border-white/5 py-1">
                  <span>{l.text}</span>
                  <span className="text-cyan">{Number(l.timestamp_seconds).toFixed(2)}s</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
