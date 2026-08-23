"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listTracks, createTrack, deleteTrack } from "@/actions/tracks";

type Track = Awaited<ReturnType<typeof listTracks>>[number];

export default function TracksListPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setTracks(await listTracks());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    const result = await createTrack(title);
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTitle("");
    refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Eliminare questa traccia e tutti i suoi dati (crediti, sezioni, testo, voti)?")) return;
    const result = await deleteTrack(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    refresh();
  }

  return (
    <main className="enter mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="glow-text text-3xl font-bold">Roster tracce</h1>
        <Link href="/master/dashboard" className="text-cyan hover:underline">
          ← Dashboard
        </Link>
      </header>

      <form onSubmit={onCreate} className="neon-card flex gap-3 p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titolo nuova traccia"
          className="input-dark flex-1 rounded-2xl px-4 py-2"
        />
        <button type="submit" disabled={creating} className="btn-glow rounded-2xl px-5 py-2">
          + Aggiungi
        </button>
      </form>

      {error && <p className="text-center text-sm text-magenta">{error}</p>}

      <ul className="space-y-2">
        {tracks.map((t) => (
          <li key={t.id} className="neon-card flex items-center justify-between p-4">
            <span>
              <span className="text-white/40">{t.position}.</span> {t.title}
            </span>
            <div className="flex gap-4 text-sm">
              <Link href={`/master/tracks/${t.id}`} className="text-cyan hover:underline">
                Modifica
              </Link>
              <button onClick={() => onDelete(t.id)} className="text-magenta hover:underline">
                Elimina
              </button>
            </div>
          </li>
        ))}
        {tracks.length === 0 && <p className="text-center text-white/40">Nessuna traccia ancora, aggiungine una.</p>}
      </ul>
    </main>
  );
}
