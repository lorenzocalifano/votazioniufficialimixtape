import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <h1 className="glow-text text-4xl font-black tracking-tight sm:text-6xl">MIXTAPE VOTING</h1>
      <p className="max-w-md text-white/70">Votazioni live della giuria per selezionare la tracklist definitiva.</p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/vote/login"
          className="btn-glow rounded-full px-8 py-3 text-center text-lg shadow-glow"
        >
          Sono un giurato
        </Link>
        <Link
          href="/master/login"
          className="neon-card rounded-full px-8 py-3 text-center text-lg text-white/80 hover:text-white"
        >
          Pannello organizzatore
        </Link>
      </div>
    </main>
  );
}
