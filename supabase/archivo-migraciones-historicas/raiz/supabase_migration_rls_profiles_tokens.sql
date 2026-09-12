-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: RLS para tablas profiles y google_tokens
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════

-- ─── profiles ─────────────────────────────────────────────
-- Los endpoints de admin ya usan createAdminClient() (service role),
-- que bypasea RLS. Estas políticas cubren acceso directo del cliente.

alter table profiles enable row level security;

-- Cada usuario solo puede leer su propio perfil
create policy "profiles_select_own" on profiles
  for select to authenticated
  using (id = auth.uid());

-- Cada usuario solo puede actualizar su propio perfil
create policy "profiles_update_own" on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Solo el service role puede insertar (crear usuario lo hace el backend con admin client)
-- No se necesita policy de insert para authenticated

-- ─── google_tokens ────────────────────────────────────────

alter table google_tokens enable row level security;

-- Cada usuario solo puede ver y escribir sus propios tokens
create policy "tokens_select_own" on google_tokens
  for select to authenticated
  using (user_id = auth.uid());

create policy "tokens_insert_own" on google_tokens
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "tokens_update_own" on google_tokens
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "tokens_delete_own" on google_tokens
  for delete to authenticated
  using (user_id = auth.uid());
