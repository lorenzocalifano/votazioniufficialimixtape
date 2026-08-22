-- Mixtape Voting — schema iniziale
-- Esegui questo file nell'SQL editor di Supabase (o via `supabase db push`) prima del primo avvio.

-- =========================================================
-- TRACCE
-- =========================================================
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  position integer not null,              -- ordine di scaletta nella serata
  title text not null,
  created_at timestamptz not null default now()
);

-- Crediti mostrati sotto al titolo (es. "Prodotto da: Mario, Luigi")
create table if not exists track_credits (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  role text not null check (role in ('producer', 'artist')),
  position integer not null,              -- ordine di visualizzazione
  name text not null
);

-- Sezioni della canzone in ordine (Prima strofa, Ritornello, ...) ognuna
-- legata a un artista: è l'unità sia del voto granulare sia della struttura testo.
create table if not exists track_sections (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  position integer not null,
  label text not null,                    -- es. "Prima strofa", "Ritornello"
  artist_name text not null
);

-- Righe di testo con timestamp (in secondi dall'inizio traccia) per lo scroll sincronizzato.
create table if not exists track_lyrics_lines (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  position integer not null,
  text text not null,
  timestamp_seconds numeric(6,2) not null
);

-- =========================================================
-- GIURATI E CODICI D'ACCESSO
-- =========================================================
create table if not exists judges (
  id uuid primary key default gen_random_uuid(),
  nickname text,                          -- opzionale, solo per leggibilità in dashboard
  created_at timestamptz not null default now(),
  last_seen_at timestamptz                -- aggiornato da heartbeat, definisce "online/offline"
);

-- Codici monouso. judge_id è NULL finché il codice non viene riscattato la prima volta;
-- da quel momento resta legato allo stesso giurato per tutte le eventuali rigenerazioni.
create table if not exists access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  judge_id uuid references judges(id) on delete cascade,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- STATO SESSIONE LIVE (riga singola, id sempre = 1)
-- =========================================================
create table if not exists session_state (
  id integer primary key default 1,
  current_track_id uuid references tracks(id),
  phase text not null default 'lobby' check (phase in ('lobby', 'voting', 'all_done')),
  track_started_at timestamptz,           -- momento in cui il Master ha premuto "Play": riferimento per lo scroll testo
  updated_at timestamptz not null default now(),
  constraint singleton check (id = 1)
);
insert into session_state (id, phase) values (1, 'lobby') on conflict (id) do nothing;

-- =========================================================
-- VOTI
-- =========================================================
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references judges(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  general_score numeric(3,1) not null check (general_score between 1 and 10),
  would_relisten boolean not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (judge_id, track_id)
);

create table if not exists section_votes (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references judges(id) on delete cascade,
  section_id uuid not null references track_sections(id) on delete cascade,
  score numeric(3,1) not null check (score between 1 and 10),
  unique (judge_id, section_id)
);

-- =========================================================
-- REALTIME
-- =========================================================
-- Solo session_state viene trasmesso in realtime al browser: contiene solo
-- "traccia corrente" e "fase", nessun dato personale/voto.
alter publication supabase_realtime add table session_state;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
-- Tutte le scritture passano dalle Server Actions con la service role key
-- (che bypassa sempre RLS). Il client browser usa solo la anon key e può
-- esclusivamente LEGGERE le tabelle "pubbliche" elencate sotto: informazioni
-- sulle tracce e lo stato di sessione. Tutto il resto (giurati, codici, voti)
-- resta illeggibile dal browser per design.

alter table tracks enable row level security;
alter table track_credits enable row level security;
alter table track_sections enable row level security;
alter table track_lyrics_lines enable row level security;
alter table session_state enable row level security;
alter table judges enable row level security;
alter table access_codes enable row level security;
alter table votes enable row level security;
alter table section_votes enable row level security;

create policy "public read tracks" on tracks for select using (true);
create policy "public read track_credits" on track_credits for select using (true);
create policy "public read track_sections" on track_sections for select using (true);
create policy "public read track_lyrics_lines" on track_lyrics_lines for select using (true);
create policy "public read session_state" on session_state for select using (true);

-- Nessuna policy su judges / access_codes / votes / section_votes:
-- RLS abilitata + zero policy = accesso negato di default per anon/authenticated.
