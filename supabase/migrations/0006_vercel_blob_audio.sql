-- L'audio passa da Supabase Storage (limite 50MB per file sul piano free,
-- non alzabile) a Vercel Blob (10GB inclusi, upload diretto dal browser,
-- nessun limite di dimensione realistico). Il bucket 'track-audio' creato in
-- 0002 resta inutilizzato ma innocuo: non serve rimuoverlo.

alter table tracks add column if not exists audio_url text;
