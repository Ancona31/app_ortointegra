-- ════════════════════════════════════════════════════════
-- OrthoIntegra — Agenda: médico por cita
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

alter table appointments
  add column if not exists medico_id uuid references profiles(id) on delete set null;

create index if not exists idx_appointments_medico on appointments(medico_id);
