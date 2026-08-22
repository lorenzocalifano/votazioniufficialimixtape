-- Voto separato per la produzione/beat (1-10 con decimali), accanto al voto
-- generale. Sicuro da rieseguire.

alter table votes add column if not exists production_score numeric(3,1) not null default 5
  check (production_score between 1 and 10);
