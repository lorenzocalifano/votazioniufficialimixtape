"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { redeemCode } from "@/actions/auth";

export default function VoteLoginPage() {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await redeemCode(code, nickname || null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/vote/session");
      router.refresh();
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <form onSubmit={onSubmit} className="enter neon-card w-full max-w-sm space-y-5 p-8">
        <h1 className="glow-text font-display text-center text-2xl font-bold">Entra nella votazione</h1>
        <p className="text-center text-sm text-white/60">
          Inserisci il codice che ti è stato comunicato stasera.
        </p>

        <div className="space-y-1">
          <label htmlFor="code" className="text-sm text-white/70">
            Codice
          </label>
          <input
            id="code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ES. 7K4PXR"
            className="input-dark w-full rounded-2xl px-4 py-3 text-center text-lg uppercase tracking-widest"
            maxLength={8}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="nickname" className="text-sm text-white/70">
            Il tuo nome (facoltativo, solo se è il tuo primo accesso stasera)
          </label>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Es. Marco"
            className="input-dark w-full rounded-2xl px-4 py-3"
          />
        </div>

        {error && <p className="text-center text-sm text-magenta">{error}</p>}

        <button type="submit" disabled={isPending} className="btn-glow w-full rounded-2xl py-3 text-lg">
          {isPending ? "Verifica in corso…" : "Entra"}
        </button>
      </form>
    </main>
  );
}
