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
} from "@/actions/tracks";

type Detail = Awaited<ReturnType<typeof getTrackDetail>>;

export default function TrackEditorClient({ trackId }: { trackId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [title, setTitle] = useState("");

  const [creditRole, setCreditRole] = useState<"producer" | "artist">("producer");
  const [creditName, setCreditName] = useState("");

  const [sectionLabel, setSectionLabel] = useState("");
  const [sectionArtist, setSectionArtist] = useState("");

  const [rawLyrics, setRawLyrics] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncIndex, setSyncIndex] = useState(0);
  const [syncLines, setSyncLines] = useState<string[]>([]);
  const [syncResult, setSyncResult] = useState<{ text: string; timestampSeconds: number }[] | null>(null);
  const startTimeRef = useRef(0);
  const capturedRef = useRef<number[]>([]);

  async function refresh() {
    const d = await getTrackDetail(trackId);
    setDetail(d);
    if (d.track) setTitle(d.track.title);
    if (d.lines.length > 0) setRawLyrics(d.lines.map((l) => l.text).join("\n"));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  async function onSaveTitle() {
    await updateTrackTitle(trackId, title);
    refresh();
  }

  async function onAddCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!creditName.trim()) return;
    await addCredit(trackId, creditRole, creditName);
    setCreditName("");
    refresh();
  }

  async function onAddSection(e: React.FormEvent) {
    e.preventDefault();
    if (!sectionLabel.trim() || !sectionArtist.trim()) return;
    await addSection(trackId, sectionLabel, sectionArtist);
    setSectionLabel("");
    setSectionArtist("");
    refresh();
  }

  function startSync() {
    const lines = rawLyrics
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;
    setSyncLines(lines);
    setSyncIndex(0);
    setSyncResult(null);
    capturedRef.current = [];
    startTimeRef.current = performance.now();
    setSyncing(true);
  }

  function tapNextLine() {
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    capturedRef.current.push(elapsed);
    if (syncIndex + 1 >= syncLines.length) {
      setSyncing(false);
      setSyncResult(syncLines.map((text, i) => ({ text, timestampSeconds: Number(capturedRef.current[i].toFixed(2)) })));
    } else {
      setSyncIndex((i) => i + 1);
    }
  }

  function cancelSync() {
    setSyncing(false);
    setSyncIndex(0);
  }

  async function onSaveSyncedLyrics() {
    if (!syncResult) return;
    await saveLyricsLines(trackId, syncResult);
    setSyncResult(null);
    refresh();
  }

  if (!detail?.track) return <main className="p-8 text-center">Caricamento…</main>;

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="glow-text text-2xl font-black">Modifica traccia</h1>
        <Link href="/master/tracks" className="text-cyan hover:underline">
          ← Roster
        </Link>
      </header>

      <section className="neon-card flex gap-3 p-6">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-dark flex-1 rounded-lg px-4 py-2" />
        <button onClick={onSaveTitle} className="btn-glow rounded-lg px-5 py-2">
          Salva titolo
        </button>
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
          <select value={creditRole} onChange={(e) => setCreditRole(e.target.value as any)} className="input-dark rounded-lg px-3 py-2">
            <option value="producer">Producer</option>
            <option value="artist">Artista</option>
          </select>
          <input
            value={creditName}
            onChange={(e) => setCreditName(e.target.value)}
            placeholder="Nome"
            className="input-dark flex-1 rounded-lg px-3 py-2"
          />
          <button type="submit" className="btn-glow rounded-lg px-4 py-2">
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
            className="input-dark flex-1 rounded-lg px-3 py-2"
          />
          <input
            value={sectionArtist}
            onChange={(e) => setSectionArtist(e.target.value)}
            placeholder="Artista"
            className="input-dark flex-1 rounded-lg px-3 py-2"
          />
          <button type="submit" className="btn-glow rounded-lg px-4 py-2">
            +
          </button>
        </form>
      </section>

      <section className="neon-card space-y-4 p-6">
        <h2 className="text-lg font-bold">Testo scorrevole sincronizzato</h2>
        <p className="text-sm text-white/50">
          Incolla il testo (una riga per riga), poi premi "Inizia sincronizzazione" e tocca il pulsante grande a ritmo
          di canzone: ogni tap registra il momento in cui parte quella riga.
        </p>

        {!syncing && (
          <textarea
            value={rawLyrics}
            onChange={(e) => setRawLyrics(e.target.value)}
            rows={8}
            className="input-dark w-full rounded-lg px-4 py-3 font-mono text-sm"
            placeholder={"Riga 1\nRiga 2\nRiga 3…"}
          />
        )}

        {!syncing && !syncResult && (
          <button onClick={startSync} className="btn-glow rounded-lg px-5 py-2">
            ▶ Inizia sincronizzazione
          </button>
        )}

        {syncing && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-white/50">
              Riga {syncIndex + 1} / {syncLines.length}
            </p>
            <p className="glow-text text-2xl font-bold">{syncLines[syncIndex]}</p>
            <button onClick={tapNextLine} className="btn-glow w-full rounded-lg py-6 text-xl">
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
              <button onClick={onSaveSyncedLyrics} className="btn-glow rounded-lg px-5 py-2">
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
