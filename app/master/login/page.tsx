"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { masterLogin } from "@/actions/auth";

export default function MasterLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await masterLogin(password);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/master/dashboard");
      router.refresh();
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <form onSubmit={onSubmit} className="enter neon-card w-full max-w-sm space-y-5 p-8">
        <h1 className="glow-text font-display text-center text-2xl font-bold">Pannello organizzatore</h1>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="input-dark w-full rounded-2xl px-4 py-3 text-center"
        />
        {error && <p className="text-center text-sm text-magenta">{error}</p>}
        <button type="submit" disabled={isPending} className="btn-glow w-full rounded-2xl py-3 text-lg">
          {isPending ? "Verifica…" : "Accedi"}
        </button>
      </form>
    </main>
  );
}
