-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: Tabla ip_rate_limits para endpoints públicos
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

create table if not exists ip_rate_limits (
  id         uuid primary key default uuid_generate_v4(),
  ip         text not null,
  ruta       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ip_rate_limits_ip_ruta_fecha
  on ip_rate_limits(ip, ruta, created_at);

-- Sin RLS — service role lo gestiona desde el servidor
-- (el cliente nunca accede directamente a esta tabla)
alter table ip_rate_limits enable row level security;

-- Solo el service role puede insertar/leer (no hay policy para authenticated/anon)
