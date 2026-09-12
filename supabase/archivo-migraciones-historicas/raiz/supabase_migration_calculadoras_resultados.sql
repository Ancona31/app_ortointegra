-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: calculadora_resultados
-- Guarda resultados de calculadoras clínicas ejecutadas
-- en el contexto de un paciente (modo contextual).
-- ════════════════════════════════════════════════════════

create table if not exists calculadora_resultados (
  id uuid primary key default gen_random_uuid(),

  paciente_id uuid not null references pacientes(id) on delete restrict,
  medico_id   uuid not null references profiles(id),
  clinica_id  uuid not null references clinicas(id),

  calculadora_slug   text not null,
  calculadora_nombre text not null,

  inputs    jsonb not null,
  resultado jsonb not null,

  fecha      timestamptz not null default now(),
  notas      text,

  created_at timestamptz not null default now()
);

create index if not exists idx_calc_resultados_paciente on calculadora_resultados(paciente_id, fecha desc);
create index if not exists idx_calc_resultados_clinica  on calculadora_resultados(clinica_id);
create index if not exists idx_calc_resultados_slug     on calculadora_resultados(calculadora_slug);

-- ─── RLS multi-clínica ────────────────────────────────
-- Usa el helper existente public.get_clinica_id() definido
-- en supabase_migration_rls.sql (security definer, lee
-- profiles.clinica_id desde auth.uid()).
alter table calculadora_resultados enable row level security;

create policy "clinica_select" on calculadora_resultados
  for select to authenticated
  using (clinica_id = public.get_clinica_id());

create policy "clinica_insert" on calculadora_resultados
  for insert to authenticated
  with check (clinica_id = public.get_clinica_id());

create policy "clinica_update" on calculadora_resultados
  for update to authenticated
  using (clinica_id = public.get_clinica_id())
  with check (clinica_id = public.get_clinica_id());

create policy "clinica_delete" on calculadora_resultados
  for delete to authenticated
  using (clinica_id = public.get_clinica_id());
