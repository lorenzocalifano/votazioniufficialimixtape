import { createClient } from "@supabase/supabase-js";

/**
 * Client con la service role key: usato SOLO dentro Server Actions / route handler.
 * Bypassa completamente la Row Level Security: non deve mai raggiungere il browser.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Variabili Supabase mancanti: controlla NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nel tuo .env.local"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
