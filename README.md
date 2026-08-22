# Mixtape Voting

Sito per le votazioni live di un mixtape collettivo: i giurati votano da telefono
mentre l'organizzatore guida la serata da un pannello Master, con dati reali e
condivisi (non una demo statica) salvati su Supabase.

## Come funziona (in breve)

- **Giurati**: entrano su `/vote/login` con un codice monouso comunicato la sera
  stessa, votano la traccia corrente da telefono. Il testo scorre sincronizzato
  in base ai timestamp preparati dall'organizzatore.
- **Organizzatore (Master)**: da `/master/login` (password condivisa) gestisce
  roster tracce, genera i codici d'accesso, avvia ogni traccia e vede in tempo
  reale chi ha votato, la classifica live, ed esporta tutti i dati grezzi.
- **Avanzamento automatico**: quando tutti i giurati attualmente online hanno
  votato la traccia corrente, il sistema mostra un countdown e passa da solo
  alla traccia successiva.

## Stack

- **Next.js 16** (App Router, Server Actions) — frontend + backend in un solo progetto.
- **Supabase** (Postgres + Realtime) — piano gratuito, database persistente condiviso da tutti i giurati.
- **Vercel** (piano gratuito) — hosting.
- Nessuna libreria di autenticazione: sessioni gestite con cookie httpOnly firmati (HMAC-SHA256, Web Crypto API).

Costo totale: **€0/mese** nei limiti dei piani gratuiti (ampiamente sufficienti per un evento singolo con ~40 giurati).

> **Nota**: Supabase mette in pausa i progetti free dopo 7 giorni di inattività
> totale. Fai un accesso di prova qualche giorno prima dell'evento per tenerlo
> "sveglio", e fai comunque un test generale il giorno prima.

## 1. Setup Supabase

1. Crea un progetto su [supabase.com](https://supabase.com) (piano Free).
2. Apri **SQL Editor** nel progetto, incolla il contenuto di
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) ed esegui.
   Questo crea tutte le tabelle, abilita Realtime su `session_state` e imposta
   le policy di Row Level Security.
3. Vai in **Project Settings → API** e recupera:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / `publishable` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` / `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ chiave potente,
     bypassa la sicurezza: non esporla mai al browser, va solo nel `.env.local` /
     nelle variabili d'ambiente del server, mai in codice committato).

## 2. Setup locale

```bash
npm install
cp .env.example .env.local
```

Compila `.env.local` con i valori di Supabase, una `MASTER_PASSWORD` a tua
scelta (quella con cui accedi al pannello organizzatore) e un `SESSION_SECRET`
casuale robusto:

```bash
openssl rand -base64 32
```

Poi avvia il progetto:

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## 3. Prima di far entrare i giurati

1. Login come Master (`/master/login`).
2. Vai su **Gestisci tracce** e carica il roster: titolo, crediti
   (producer/artisti), sezioni in ordine di strofa (ognuna con l'artista che
   canta quella parte — sono l'unità sia dei voti granulari sia della
   struttura del testo) e, se vuoi lo scroll sincronizzato, il testo con
   l'editor "tocca a ritmo" (incolli le righe, ascolti il brano e tocchi un
   pulsante a ogni riga: il sistema registra da solo i timestamp).
3. Torna alla dashboard e genera il primo batch di codici d'accesso (es. 45)
   da distribuire/proiettare in sala.

## 4. Durante la serata

- I giurati inseriscono il codice su `/vote/login` (opzionale: il proprio nome
  al primo accesso).
- Quando sei pronto, scegli la prima traccia e premi **▶ Avvia**: parte
  fisicamente l'audio in studio e sul telefono dei giurati compare la
  schermata di voto con crediti/testo sincronizzato.
- Quando tutti i giurati online hanno votato, parte in automatico il countdown
  e si passa alla traccia successiva (puoi anche forzare con **Avanza ora**).
- Se un giurato si disconnette, il suo vecchio codice non è più valido: nella
  sezione **Giurati** della dashboard premi **Rigenera codice** accanto al suo
  nome e comunicagli il nuovo codice per rientrare (riprende dalla traccia
  corrente, non da dove si era fermato).
- A fine serata, dalla dashboard puoi esportare **JSON completo** o **CSV voti**
  per un'analisi successiva (anche con un'IA esterna).

## Protezione anti voto-multiplo — limiti onesti

Il voto è protetto **lato server**, non solo lato client:

- vincolo `UNIQUE(judge_id, track_id)` nel database: un giurato non può votare
  due volte la stessa traccia, anche riprovando;
- l'identità del giurato vive in un cookie **httpOnly** firmato, non in
  `localStorage`: non basta svuotare la cache per "resettarsi";
- ogni codice è monouso e viene invalidato al primo utilizzo.

**Limiti reali**: non c'è device-fingerprinting. Se qualcuno copia il proprio
cookie di sessione su un altro dispositivo, o presta il telefono già loggato a
un'altra persona, tecnicamente vota "come lui/lei". Per un contesto di fiducia
come una serata tra collaboratori è una protezione adeguata; non è pensata per
resistere a un utente tecnico e malintenzionato.

## Deploy su Vercel

1. Pusha il repo su GitHub (già fatto se stai leggendo questo dopo il primo deploy).
2. Su [vercel.com](https://vercel.com) → **Add New Project** → importa il repo.
3. In **Environment Variables** aggiungi le stesse variabili di `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `MASTER_PASSWORD`, `SESSION_SECRET`.
4. Deploy. Da quel momento il sito è raggiungibile pubblicamente sull'URL
   assegnato da Vercel (piano Hobby, gratuito).
5. Fai un giro di test completo (login giurato, login master, avvio traccia,
   voto, avanzamento) **prima** della serata vera.

## Struttura del progetto

```
app/
  vote/login, vote/session      → app giurati (mobile-first)
  master/login, master/dashboard,
  master/tracks                 → pannello organizzatore
actions/                        → Server Actions: tutta la logica di scrittura/lettura
lib/                             → client Supabase, firma cookie di sessione
supabase/migrations/0001_init.sql → schema database completo
```
