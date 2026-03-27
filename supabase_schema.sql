-- ════════════════════════════════════════════════════════
-- OrthoIntegra — Schema de base de datos
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

-- Extensiones
create extension if not exists "uuid-ossp";

-- ─── Pacientes ────────────────────────────────────────────
create table if not exists pacientes (
  id                    uuid primary key default uuid_generate_v4(),
  numero_expediente     text,
  nombre                text not null,
  apellidos             text not null,
  fecha_nacimiento      date not null,
  sexo                  text check (sexo in ('M','F','Otro')),
  peso_kg               numeric(5,2),
  talla_cm              numeric(5,1),
  imc                   numeric(4,1),
  telefono              text,
  email                 text,
  direccion             text,
  ant_patologicos       text,
  ant_quirurgicos       text,
  ant_familiares        text,
  alergias              text,
  medicamentos_actuales text,
  clinica_id            uuid references clinicas(id) on delete set null,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ─── Consultas / Expediente clínico ──────────────────────
create table if not exists consultas (
  id                uuid primary key default uuid_generate_v4(),
  paciente_id       uuid references pacientes(id) on delete cascade,
  fecha             timestamptz not null default now(),
  motivo_consulta   text not null,
  exploracion_fisica text,
  diagnosticos      jsonb default '[]',
  plan_tratamiento  text,
  notas_evolucion   text,
  proxima_cita      timestamptz,
  created_at        timestamptz default now()
);

-- ─── Laboratorios ─────────────────────────────────────────
create table if not exists laboratorios (
  id           uuid primary key default uuid_generate_v4(),
  paciente_id  uuid references pacientes(id) on delete cascade,
  fecha_toma   date not null,
  pdf_url      text,
  valores      jsonb not null default '{}',
  analisis_ia  jsonb,
  created_at   timestamptz default now()
);

-- ─── Documentos ───────────────────────────────────────────
create table if not exists documentos (
  id           uuid primary key default uuid_generate_v4(),
  paciente_id  uuid references pacientes(id) on delete cascade,
  consulta_id  uuid references consultas(id) on delete set null,
  tipo         text not null check (tipo in ('receta','solicitud_lab','solicitud_imagen','informe_clinico','plan_suplementacion')),
  contenido    jsonb not null default '{}',
  pdf_url      text,
  created_at   timestamptz default now()
);

-- ─── Índices ──────────────────────────────────────────────
create index if not exists idx_pacientes_clinica    on pacientes(clinica_id);
create index if not exists idx_pacientes_apellidos  on pacientes(apellidos);
create index if not exists idx_consultas_paciente   on consultas(paciente_id);
create index if not exists idx_laboratorios_paciente on laboratorios(paciente_id);
create index if not exists idx_documentos_paciente  on documentos(paciente_id);

-- ─── RLS (Row Level Security) ─────────────────────────────
alter table pacientes    enable row level security;
alter table consultas    enable row level security;
alter table laboratorios enable row level security;
alter table documentos   enable row level security;

-- Helper: obtiene clinica_id del usuario autenticado sin repetir el subquery
create or replace function public.get_clinica_id()
returns uuid language sql stable security definer as $$
  select clinica_id from profiles where id = auth.uid()
$$;

-- pacientes: filtrado por clínica del usuario
create policy "clinica_select" on pacientes for select to authenticated
  using (clinica_id = public.get_clinica_id());
create policy "clinica_insert" on pacientes for insert to authenticated
  with check (clinica_id = public.get_clinica_id());
create policy "clinica_update" on pacientes for update to authenticated
  using (clinica_id = public.get_clinica_id()) with check (clinica_id = public.get_clinica_id());
create policy "clinica_delete" on pacientes for delete to authenticated
  using (clinica_id = public.get_clinica_id());

-- consultas, laboratorios, documentos: heredan el filtro de clínica a través del paciente
create policy "clinica_select" on consultas for select to authenticated
  using (exists (select 1 from pacientes p where p.id = consultas.paciente_id and p.clinica_id = public.get_clinica_id()));
create policy "clinica_insert" on consultas for insert to authenticated
  with check (exists (select 1 from pacientes p where p.id = consultas.paciente_id and p.clinica_id = public.get_clinica_id()));
create policy "clinica_update" on consultas for update to authenticated
  using (exists (select 1 from pacientes p where p.id = consultas.paciente_id and p.clinica_id = public.get_clinica_id()));
create policy "clinica_delete" on consultas for delete to authenticated
  using (exists (select 1 from pacientes p where p.id = consultas.paciente_id and p.clinica_id = public.get_clinica_id()));

create policy "clinica_select" on laboratorios for select to authenticated
  using (exists (select 1 from pacientes p where p.id = laboratorios.paciente_id and p.clinica_id = public.get_clinica_id()));
create policy "clinica_insert" on laboratorios for insert to authenticated
  with check (exists (select 1 from pacientes p where p.id = laboratorios.paciente_id and p.clinica_id = public.get_clinica_id()));
create policy "clinica_update" on laboratorios for update to authenticated
  using (exists (select 1 from pacientes p where p.id = laboratorios.paciente_id and p.clinica_id = public.get_clinica_id()));
create policy "clinica_delete" on laboratorios for delete to authenticated
  using (exists (select 1 from pacientes p where p.id = laboratorios.paciente_id and p.clinica_id = public.get_clinica_id()));

create policy "clinica_select" on documentos for select to authenticated
  using (exists (select 1 from pacientes p where p.id = documentos.paciente_id and p.clinica_id = public.get_clinica_id()));
create policy "clinica_insert" on documentos for insert to authenticated
  with check (exists (select 1 from pacientes p where p.id = documentos.paciente_id and p.clinica_id = public.get_clinica_id()));
create policy "clinica_update" on documentos for update to authenticated
  using (exists (select 1 from pacientes p where p.id = documentos.paciente_id and p.clinica_id = public.get_clinica_id()));
create policy "clinica_delete" on documentos for delete to authenticated
  using (exists (select 1 from pacientes p where p.id = documentos.paciente_id and p.clinica_id = public.get_clinica_id()));

-- ─── Storage bucket para PDFs ────────────────────────────
insert into storage.buckets (id, name, public) values ('laboratorios-pdf', 'laboratorios-pdf', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('documentos-pdf', 'documentos-pdf', false) on conflict do nothing;
