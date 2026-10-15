-- ═══════════════════════════════════════════════════════════════════════
-- Fase 3 · P2 — columnas ajuste_* y public.limite_efectivo
-- Rama: feature/limites-ajustables · Escrita: 2026-10-14
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: PENDIENTE DE APLICAR.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR.
--
-- CONTRATO CON spinus-consola: los nombres y tipos de las cuatro columnas
-- ajuste_*, la firma, la regla y los atributos (stable, security invoker,
-- language sql) de public.limite_efectivo no se renombran ni cambian de
-- significado sin ajustar antes la consola (CLAUDE.md, «Contrato con
-- spinus-consola»).
--
-- Rangos: «NULL o ≥ 1», sin máximo (R6). El tope de 10 médicos y 3
-- secretarias lo aplica la consola según el tipo de clínica, no la base.
-- Sin CHECK contra max_*: si el plan sube, el webhook escribe un max_* mayor
-- que el ajuste y greatest() hace que el plan mande. Sin CHECK de fecha
-- futura: un ajuste vencido se queda guardado y deja de contar.
--
-- Protección: solo postgres y supabase_admin (la consola y el editor SQL)
-- cambian ajuste_*. Ni authenticated, ni service_role (el webhook), ni
-- ningún otro rol. La función del disparador es security invoker a
-- propósito, para que current_user sea quien hace el cambio. Las funciones
-- SECURITY DEFINER de postgres pasan; hoy ninguna de Spinus escribe en
-- clinicas (inventario local del 2026-10-14).
-- ═══════════════════════════════════════════════════════════════════════

-- [1/9] Columnas de ajuste (contrato con spinus-consola: nombres y tipos exactos)
alter table public.clinicas
  add column if not exists ajuste_max_medicos integer,
  add column if not exists ajuste_medicos_hasta timestamptz,
  add column if not exists ajuste_max_secretarias integer,
  add column if not exists ajuste_secretarias_hasta timestamptz;

-- [2/9] «NULL o ≥ 1» (sin máximo: el tope lo aplica la consola) y «hasta solo con valor»
alter table public.clinicas
  drop constraint if exists clinicas_ajuste_medicos_rango,
  drop constraint if exists clinicas_ajuste_secretarias_rango,
  drop constraint if exists clinicas_ajuste_medicos_hasta_con_valor,
  drop constraint if exists clinicas_ajuste_secretarias_hasta_con_valor,
  add constraint clinicas_ajuste_medicos_rango
    check (ajuste_max_medicos is null or ajuste_max_medicos >= 1),
  add constraint clinicas_ajuste_secretarias_rango
    check (ajuste_max_secretarias is null or ajuste_max_secretarias >= 1),
  add constraint clinicas_ajuste_medicos_hasta_con_valor
    check (ajuste_medicos_hasta is null or ajuste_max_medicos is not null),
  add constraint clinicas_ajuste_secretarias_hasta_con_valor
    check (ajuste_secretarias_hasta is null or ajuste_max_secretarias is not null);

-- [3/9] Límite efectivo (contrato con spinus-consola)
create or replace function public.limite_efectivo(p_base integer, p_ajuste integer, p_hasta timestamptz)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_base is null then null
    when p_ajuste is not null and (p_hasta is null or p_hasta > now()) then greatest(p_base, p_ajuste)
    else p_base
  end
$$;

-- [4/9]
revoke execute on function public.limite_efectivo(integer, integer, timestamptz) from public;

-- [5/9]
grant execute on function public.limite_efectivo(integer, integer, timestamptz) to anon, authenticated, service_role;

-- [6/9] Solo el operador (postgres) cambia los ajustes
create or replace function public.proteger_ajustes_clinica()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.ajuste_max_medicos is not null or new.ajuste_medicos_hasta is not null
       or new.ajuste_max_secretarias is not null or new.ajuste_secretarias_hasta is not null then
      raise exception 'Los ajustes de límites solo se cambian desde la consola de operador'
        using errcode = '42501';
    end if;
  elsif (new.ajuste_max_medicos, new.ajuste_medicos_hasta, new.ajuste_max_secretarias, new.ajuste_secretarias_hasta)
        is distinct from
        (old.ajuste_max_medicos, old.ajuste_medicos_hasta, old.ajuste_max_secretarias, old.ajuste_secretarias_hasta) then
    raise exception 'Los ajustes de límites solo se cambian desde la consola de operador'
      using errcode = '42501';
  end if;
  return new;
end
$$;

-- [7/9]
revoke execute on function public.proteger_ajustes_clinica() from public;

-- [8/9]
grant execute on function public.proteger_ajustes_clinica() to anon, authenticated, service_role;

-- [9/9]
create or replace trigger trg_clinicas_proteger_ajustes
  before insert or update on public.clinicas
  for each row execute function public.proteger_ajustes_clinica();
