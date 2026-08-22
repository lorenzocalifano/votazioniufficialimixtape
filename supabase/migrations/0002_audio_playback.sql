-- Aggiunge: riproduzione audio mp3 direttamente dal sito (solo lato Master,
-- mai esposta agli ascoltatori) e stato di pausa/ripresa per tenere il testo
-- scorrevole sincronizzato con l'effettiva posizione di riproduzione.
-- Sicuro da rieseguire ed è indipendente dall'ordine rispetto a 0001
-- (basta che 0001 sia già stato eseguito almeno una volta prima).

alter table session_state add column if not exists is_paused boolean not null default false;
alter table session_state add column if not exists paused_position_seconds numeric(8,2);

-- Bucket privato per i file mp3: nessuna policy pubblica viene creata, quindi
-- resta illeggibile da anon/authenticated. Solo le Server Action con la
-- service role key (usate esclusivamente dal pannello Master) possono
-- caricare i file o generare URL firmati temporanei per riprodurli.
insert into storage.buckets (id, name, public)
values ('track-audio', 'track-audio', false)
on conflict (id) do nothing;
