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
create index if not exists idx_consultas_paciente on consultas(paciente_id);
create index if not exists idx_laboratorios_paciente on laboratorios(paciente_id);
create index if not exists idx_documentos_paciente on documentos(paciente_id);

-- ─── RLS (Row Level Security) ─────────────────────────────
alter table pacientes   enable row level security;
alter table consultas   enable row level security;
alter table laboratorios enable row level security;
alter table documentos  enable row level security;

-- Política temporal: permitir todo al usuario autenticado
-- (Ajustar cuando se implemente multi-usuario)
create policy "Allow authenticated all" on pacientes   for all to authenticated using (true) with check (true);
create policy "Allow authenticated all" on consultas   for all to authenticated using (true) with check (true);
create policy "Allow authenticated all" on laboratorios for all to authenticated using (true) with check (true);
create policy "Allow authenticated all" on documentos  for all to authenticated using (true) with check (true);

-- ─── Storage bucket para PDFs ────────────────────────────
insert into storage.buckets (id, name, public) values ('laboratorios-pdf', 'laboratorios-pdf', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('documentos-pdf', 'documentos-pdf', false) on conflict do nothing;
