-- ════════════════════════════════════════════════════════
-- OrthoIntegra — Agenda v2: gcal_sync_status
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

alter table appointments
  add column if not exists gcal_sync_status text not null default 'synced'
    check (gcal_sync_status in ('synced', 'pending', 'failed'));

create index if not exists idx_appointments_gcal_sync
  on appointments(gcal_sync_status)
  where gcal_sync_status = 'pending';
