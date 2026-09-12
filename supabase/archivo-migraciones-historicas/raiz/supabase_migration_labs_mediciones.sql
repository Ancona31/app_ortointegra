-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: mediciones_analitos (rediseño labs — sub-fase 1A)
-- Mediciones longitudinales de analitos por paciente. Soporta
-- analitos del catálogo y analitos custom inline (exclusivos).
-- Audit log automático vía log_tabla_change() existente.
-- Ejecutar en Supabase SQL Editor DESPUÉS de analitos_catalogo.
-- ════════════════════════════════════════════════════════

-- ─── 1. Tabla mediciones_analitos ────────────────────────
-- CHECK de exclusividad:
--   - Catálogo: analito_id NOT NULL, todos los *_custom NULL
--   - Custom:   analito_id NULL, los 3 *_custom NOT NULL
create table if not exists mediciones_analitos (
  id               uuid primary key default uuid_generate_v4(),
  paciente_id      uuid not null references pacientes(id) on delete restrict,
  analito_id       uuid references analitos_catalogo(id) on delete restrict,
  nombre_custom    text,
  unidad_custom    text,
  categoria_custom text,
  valor            numeric not null,
  medido_en        timestamptz not null,
  notas            text,
  creado_por       uuid not null references profiles(id) on delete restrict,
  created_at       timestamptz not null default now(),
  constraint mediciones_analito_xor_custom_check check (
    (analito_id is not null
      and nombre_custom is null
      and unidad_custom is null
      and categoria_custom is null)
    or
    (analito_id is null
      and nombre_custom is not null
      and unidad_custom is not null
      and categoria_custom is not null)
  )
);

-- ─── 2. Índices ──────────────────────────────────────────
-- (paciente_id, medido_en desc) cubre también queries que solo filtran por
-- paciente_id usando el prefijo, así que no creamos un índice suelto de paciente.
create index if not exists idx_mediciones_paciente_analito
  on mediciones_analitos(paciente_id, analito_id)
  where analito_id is not null;

create index if not exists idx_mediciones_paciente_medido_en
  on mediciones_analitos(paciente_id, medido_en desc);

-- ─── 3. RLS ──────────────────────────────────────────────
-- Hereda el filtro de clínica vía paciente (mismo patrón que consultas,
-- laboratorios y documentos en supabase_schema.sql).
alter table mediciones_analitos enable row level security;

create policy "clinica_select" on mediciones_analitos
  for select to authenticated
  using (exists (
    select 1 from pacientes p
    where p.id = mediciones_analitos.paciente_id
      and p.clinica_id = public.get_clinica_id()
  ));

create policy "clinica_insert" on mediciones_analitos
  for insert to authenticated
  with check (exists (
    select 1 from pacientes p
    where p.id = mediciones_analitos.paciente_id
      and p.clinica_id = public.get_clinica_id()
  ));

create policy "clinica_update" on mediciones_analitos
  for update to authenticated
  using (exists (
    select 1 from pacientes p
    where p.id = mediciones_analitos.paciente_id
      and p.clinica_id = public.get_clinica_id()
  ));

create policy "clinica_delete" on mediciones_analitos
  for delete to authenticated
  using (exists (
    select 1 from pacientes p
    where p.id = mediciones_analitos.paciente_id
      and p.clinica_id = public.get_clinica_id()
  ));

-- ─── 4. Trigger de audit log ─────────────────────────────
-- Reusa la función genérica log_tabla_change() definida en
-- supabase_migration_audit_log.sql. Registra INSERT/UPDATE/DELETE.
create trigger audit_mediciones_analitos
  after insert or update or delete on mediciones_analitos
  for each row execute function log_tabla_change();
