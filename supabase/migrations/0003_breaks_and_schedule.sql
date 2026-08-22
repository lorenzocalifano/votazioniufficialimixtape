-- Pause programmate tra le tracce + stima dell'orario di fine serata.
-- Sicuro da rieseguire; richiede che 0001 e 0002 siano già stati applicati.

alter table tracks add column if not exists duration_seconds numeric(7,2);

alter table session_state add column if not exists break_until timestamptz;

alter table session_state drop constraint if exists session_state_phase_check;
alter table session_state add constraint session_state_phase_check
  check (phase in ('lobby', 'voting', 'all_done', 'break'));
