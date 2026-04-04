-- ════════════════════════════════════════════════════════
-- OrthoIntegra — Módulo de Agenda (Appointments)
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

create table if not exists appointments (
  id                        uuid primary key default uuid_generate_v4(),
  clinica_id                uuid not null references clinicas(id) on delete cascade,
  paciente_id               uuid references pacientes(id) on delete set null,
  created_by                uuid references profiles(id) on delete set null,
  title                     text not null,
  start_time                timestamptz not null,
  end_time                  timestamptz not null,
  status                    text not null default 'scheduled'
                              check (status in ('scheduled','confirmed','cancelled','no_show')),
  notes                     text,
  google_event_id           text,
  whatsapp_sent_at          timestamptz,
  whatsapp_reminder_sent_at timestamptz,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

create index if not exists idx_appointments_clinica    on appointments(clinica_id);
create index if not exists idx_appointments_paciente   on appointments(paciente_id);
create index if not exists idx_appointments_start_time on appointments(start_time);
create index if not exists idx_appointments_status     on appointments(status);

alter table appointments enable row level security;

create policy "clinica_select" on appointments for select to authenticated
  using (clinica_id = public.get_clinica_id());
create policy "clinica_insert" on appointments for insert to authenticated
  with check (clinica_id = public.get_clinica_id());
create policy "clinica_update" on appointments for update to authenticated
  using (clinica_id = public.get_clinica_id())
  with check (clinica_id = public.get_clinica_id());
create policy "clinica_delete" on appointments for delete to authenticated
  using (clinica_id = public.get_clinica_id());
