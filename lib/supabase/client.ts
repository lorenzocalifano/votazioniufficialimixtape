"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Client con la anon key: usato nel browser, solo per la subscription realtime
 * a `session_state` e per leggere le tabelle pubbliche (tracce, sezioni, testo).
 * Non può leggere/scrivere giurati, codici o voti (bloccati da RLS).
 */
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}
