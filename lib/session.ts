/**
 * Firma/verifica dei cookie di sessione con HMAC-SHA256 via Web Crypto API.
 * Usiamo Web Crypto (invece di jsonwebtoken/Buffer) perché è disponibile sia in
 * runtime Node che Edge (es. middleware.ts), senza dipendenze extra.
 */

export type SessionPayload =
  | { role: "judge"; judgeId: string; exp: number }
  | { role: "master"; exp: number };

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array<ArrayBuffer> {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET mancante nelle variabili d'ambiente");
  return secret;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await getKey(getSecret());
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(signature));
  return `${payloadB64}.${sigB64}`;
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await getKey(getSecret());
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(sigB64), encoder.encode(payloadB64));
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64))) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const JUDGE_COOKIE = "mixtape_judge_session";
export const MASTER_COOKIE = "mixtape_master_session";

// Una serata dura poche ore: 12h di validità sono più che sufficienti e limitano
// il rischio se un cookie venisse copiato altrove dopo l'evento.
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
