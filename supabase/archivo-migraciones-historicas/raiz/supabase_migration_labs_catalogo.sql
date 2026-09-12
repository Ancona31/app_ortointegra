-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: analitos_catalogo (rediseño labs — sub-fase 1A)
-- Catálogo maestro de analitos clínicos (lectura para médicos,
-- escritura solo vía service role). El seed se aplica en sub-fase 1B.
-- Ejecutar en Supabase SQL Editor.
-- ════════════════════════════════════════════════════════

-- ─── 1. Tabla analitos_catalogo ──────────────────────────
create table if not exists analitos_catalogo (
  id                   uuid primary key default uuid_generate_v4(),
  clave                text not null unique,
  nombre               text not null,
  nombres_alternativos text[] not null default '{}',
  categoria            text not null check (categoria in (
    'antropometria',
    'signos_vitales',
    'hematologia',
    'quimica',
    'hueso',
    'endocrino',
    'inmunologia',
    'coagulacion',
    'cardiaco',
    'marcador_tumoral',
    'vitaminas_minerales',
    'otros'
  )),
  unidad               text not null,
  bands_type           text not null check (bands_type in (
    'high-bad',
    'low-bad',
    'low-and-high-bad',
    'none'
  )),
  rango_default        jsonb,
  rango_femenino       jsonb,
  rango_masculino      jsonb,
  precision_decimales  int  not null default 1,
  activo               boolean not null default true,
  created_at           timestamptz not null default now()
);

-- ─── 2. Índices ──────────────────────────────────────────
-- Filtrados por activo = true: el catálogo público siempre excluye inactivos,
-- así que los índices parciales son más chicos y rápidos para el read path.
create index if not exists idx_analitos_catalogo_categoria
  on analitos_catalogo(categoria) where activo = true;

create index if not exists idx_analitos_catalogo_clave
  on analitos_catalogo(clave) where activo = true;

-- ─── 3. RLS ──────────────────────────────────────────────
-- Catálogo público para médicos autenticados (solo SELECT con activo = true).
-- INSERT/UPDATE/DELETE: sin policies → solo service role (backend admin) escribe.
alter table analitos_catalogo enable row level security;

create policy "catalogo_select_authenticated" on analitos_catalogo
  for select to authenticated
  using (activo = true);
