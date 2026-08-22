# Mixtape Voting

Sito per le votazioni live di un mixtape collettivo: gli ascoltatori votano da
telefono mentre l'organizzatore guida la serata da un pannello Master — audio
compreso, riprodotto direttamente dal sito sulle casse dello studio — con dati
reali e condivisi (non una demo statica) salvati su Supabase.

## Come funziona (in breve)

- **Ascoltatori**: entrano su `/vote/login` con un codice monouso comunicato la
  sera stessa, votano la traccia corrente da telefono mentre il testo scorre
  sincronizzato con l'audio. Non sentono nulla dal proprio telefono: l'audio
  parte solo dal computer del Master, sulle casse dello studio.
- **Organizzatore (Master)**: da `/master/login` (password condivisa) carica i
  brani (mp3 compreso), genera i codici d'accesso, avvia/mette in pausa ogni
  traccia direttamente dal browser e vede in tempo reale chi ha votato, la
  classifica live, ed esporta tutti i dati grezzi.
- **Avanzamento automatico**: quando tutti gli ascoltatori attualmente online
  hanno votato la traccia corrente, il sistema passa da solo alla traccia
  successiva (audio compreso). Ogni 3 tracce concede automaticamente una pausa
  di 5 minuti, e una pausa più lunga di 15 minuti dopo la decima; durante
  l'attesa (pause comprese) tutti vedono una schermata con ora attuale,
  avanzamento nella scaletta e orario di fine stimato.

## Stack

- **Next.js 16** (App Router, Server Actions) — frontend + backend in un solo progetto.
- **Supabase** (Postgres + Realtime + Storage) — piano gratuito: database persistente condiviso, e bucket privato per gli mp3.
- **Vercel** (piano gratuito) — hosting.
- Nessuna libreria di autenticazione: sessioni gestite con cookie httpOnly firmati (HMAC-SHA256, Web Crypto API).

Costo totale: **€0/mese** nei limiti dei piani gratuiti (ampiamente sufficienti per un evento singolo con ~40 ascoltatori e ~20-30 tracce da qualche MB l'una).

> **Nota**: Supabase mette in pausa i progetti free dopo 7 giorni di inattività
> totale. Fai un accesso di prova qualche giorno prima dell'evento per tenerlo
> "sveglio", e fai comunque un test generale il giorno prima.

## 1. Setup Supabase

1. Crea un progetto su [supabase.com](https://supabase.com) (piano Free).
2. Apri **SQL Editor** nel progetto ed esegui, **in ordine**, il contenuto di:
   - [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — tabelle, Realtime su `session_state`, Row Level Security.
   - [`supabase/migrations/0002_audio_playback.sql`](supabase/migrations/0002_audio_playback.sql) — stato di pausa/ripresa e bucket privato `track-audio` per gli mp3.
   - [`supabase/migrations/0003_breaks_and_schedule.sql`](supabase/migrations/0003_breaks_and_schedule.sql) — durata tracce e pause programmate.
   - [`supabase/migrations/0004_production_score.sql`](supabase/migrations/0004_production_score.sql) — voto separato alla produzione/beat.
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

## 3. Prima di far entrare gli ascoltatori

1. Login come Master (`/master/login`).
2. Vai su **Gestisci tracce** e per ogni brano carica:
   - titolo e crediti (producer/artisti);
   - il file **mp3** (resta privato: si sente solo dal pannello Master, mai dal telefono degli ascoltatori);
   - le sezioni in ordine di strofa (ognuna con l'artista che canta quella
     parte — sono l'unità sia dei voti granulari sia della struttura del testo);
   - se vuoi lo scroll sincronizzato, il testo con l'editor "tocca a ritmo":
     l'mp3 caricato parte davvero, e ogni tap sul pulsante grande registra la
     posizione esatta della canzone per quella riga — molto più precisa di un
     timer generico perché è la stessa traccia che poi sentirete dal vivo.
3. Torna alla dashboard e genera il primo batch di codici d'accesso (es. 45)
   da distribuire/proiettare in sala.

## 4. Durante la serata

- Gli ascoltatori inseriscono il codice su `/vote/login` (opzionale: il
  proprio nome al primo accesso).
- Quando sei pronto, scegli la prima traccia e premi **▶ Avvia**: l'mp3 parte
  dal tuo browser sulle casse dello studio, e sul telefono degli ascoltatori
  compare la schermata di voto con crediti/testo sincronizzato (loro non
  sentono nulla dal proprio dispositivo).
- Il player audio nella dashboard ha i controlli nativi del browser
  (play/pausa/scorrimento/volume): usali pure per gestire la riproduzione, lo
  stato si sincronizza da solo con i telefoni degli ascoltatori.
- Ogni ascoltatore vota con il pulsante **Vota**, che chiede sempre conferma
  (Sì/No) prima di registrare il voto — così non capita di inviarlo per
  sbaglio mentre si sta ancora regolando uno slider.
- Quando tutti gli ascoltatori online hanno votato, si passa alla traccia
  successiva, audio compreso (puoi anche forzare con **Avanza ora**). Ogni 3
  tracce scatta in automatico una pausa di 5 minuti (15 dopo la decima): la
  dashboard mostra il countdown ed **avanza da sola** a fine pausa.
- Se un ascoltatore si disconnette, il suo vecchio codice non è più valido:
  nella sezione **Ascoltatori** della dashboard premi **Rigenera codice**
  accanto al suo nome e comunicagli il nuovo codice per rientrare (riprende
  dalla traccia corrente, non da dove si era fermato).
- A fine serata, dalla dashboard puoi esportare i dati per un'analisi successiva
  (anche con un'IA esterna): **JSON completo** (tracce con crediti, sezioni e
  relativi voti individuali, voti generali (incluso il voto separato alla
  produzione/beat) e media di severità per ascoltatore, già incrociati),
  **CSV voti generali** e **CSV voti per sezione** (un rigo per ogni voto a
  strofa/ritornello/artista).

## Protezione anti voto-multiplo — limiti onesti

Il voto è protetto **lato server**, non solo lato client:

- vincolo `UNIQUE(judge_id, track_id)` nel database: una persona non può
  votare due volte la stessa traccia, anche riprovando;
- l'identità dell'ascoltatore vive in un cookie **httpOnly** firmato, non in
  `localStorage`: non basta svuotare la cache per "resettarsi";
- ogni codice è monouso e viene invalidato al primo utilizzo.

**Limiti reali**: non c'è device-fingerprinting. Se qualcuno copia il proprio
cookie di sessione su un altro dispositivo, o presta il telefono già loggato a
un'altra persona, tecnicamente vota "come lui/lei". Per un contesto di fiducia
come una serata tra collaboratori è una protezione adeguata; non è pensata per
resistere a un utente tecnico e malintenzionato.

**Limite sull'audio**: il testo scorrevole si sincronizza calcolando il tempo
trascorso da quando l'mp3 è partito. Se il Master mette in pausa o riavvolge
manualmente con i controlli nativi, lo stato si riallinea correttamente; una
latenza di rete di qualche centinaio di millisecondi tra un'azione e la sua
propagazione ai telefoni resta comunque possibile.

## Deploy su Vercel

1. Pusha il repo su GitHub (già fatto se stai leggendo questo dopo il primo deploy).
2. Su [vercel.com](https://vercel.com) → **Add New Project** → importa il repo.
3. In **Environment Variables** aggiungi le stesse variabili di `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `MASTER_PASSWORD`, `SESSION_SECRET`.
4. Deploy. Da quel momento il sito è raggiungibile pubblicamente sull'URL
   assegnato da Vercel (piano Hobby, gratuito).
5. Fai un giro di test completo (login ascoltatore, login master, caricamento
   mp3, avvio traccia, voto, avanzamento) **prima** della serata vera.

## Struttura del progetto

```
app/
  vote/login, vote/session      → app ascoltatori (mobile-first)
  master/login, master/dashboard,
  master/tracks                 → pannello organizzatore (audio incluso)
actions/                        → Server Actions: tutta la logica di scrittura/lettura
lib/                             → client Supabase, firma cookie di sessione
supabase/migrations/            → schema database + bucket audio, in ordine
```
