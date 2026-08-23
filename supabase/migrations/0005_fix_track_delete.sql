-- Bug: session_state.current_track_id puntava a tracks(id) senza un ON DELETE,
-- quindi cancellare una traccia che fosse mai stata "corrente" falliva con un
-- errore di foreign key. La correggiamo a ON DELETE SET NULL: cancellare la
-- traccia corrente semplicemente svuota il puntatore in session_state.
-- Sicuro da rieseguire.

do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_name = 'session_state'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'current_track_id';

  if fk_name is not null then
    execute format('alter table session_state drop constraint %I', fk_name);
  end if;
end $$;

alter table session_state
  add constraint session_state_current_track_id_fkey
  foreign key (current_track_id) references tracks(id) on delete set null;
