-- Permette al Master di disconnettere forzatamente un ascoltatore: la sua
-- sessione è un cookie firmato senza stato lato server, quindi per poterla
-- invalidare "a comando" le leghiamo a un contatore (session_epoch) salvato
-- sul giurato. Ogni volta che il contatore lato DB non coincide con quello
-- scritto nel cookie al momento del login, la sessione è considerata scaduta.

alter table judges add column if not exists session_epoch integer not null default 0;
