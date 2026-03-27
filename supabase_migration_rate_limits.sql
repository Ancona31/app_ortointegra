-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: Tabla rate_limits para control de uso de IA
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

create table if not exists rate_limits (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  ruta       text not null,
  created_at timestamptz not null default now()
);

-- Índice para que la consulta de conteo sea rápida
create index if not exists idx_rate_limits_user_ruta_fecha
  on rate_limits(user_id, ruta, created_at);

-- RLS: cada usuario solo puede ver sus propios registros
alter table rate_limits enable row level security;

create policy "usuario_own" on rate_limits
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
