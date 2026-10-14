-- ═══════════════════════════════════════════════════════════════════════
-- Fase 3 · P1 — EXECUTE sin PUBLIC en las funciones de public
-- Rama: feature/limites-ajustables · Escrita: 2026-10-14
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: PENDIENTE DE APLICAR.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR.
--
-- Quita EXECUTE a PUBLIC donde hoy lo tiene, lo da a anon, authenticated y
-- service_role, y hace que toda función nueva de postgres nazca sin PUBLIC.
-- Motivo: la consola de operador (spinus-consola) tiene una credencial propia
-- que no es ninguno de esos tres roles y no debe ejecutar funciones de Spinus.
--
-- Lista de Auth y Storage (inventario local tras db reset, 2026-10-14):
--   public.handle_new_user() — disparador on_auth_user_created de auth.users,
--   SECURITY DEFINER, dueño postgres; la ejecuta supabase_auth_admin. No llama
--   a otras funciones de public. Escribe solo en public.profiles, cuyos DEFAULT
--   y CHECK no llaman funciones de public. Storage no tiene ninguna.
-- Hooks de Auth: en local, ninguno (config.toml los trae comentados). En
--   producción lo comprueba F5 (plan §7.2) antes del db push.
-- Postgres no comprueba EXECUTE de la función de un disparador al dispararlo,
--   solo en CREATE TRIGGER (ensayado en local, PG 17.6). El grant [2/4] no es
--   lo que hace funcionar el alta; se deja por la regla del plan (§5 P1).
-- ═══════════════════════════════════════════════════════════════════════

-- [1/4] Antes de tocar nada: toda función propia de public con EXECUTE a PUBLIC es de postgres
--       (si no, revoke y grant solo dan WARNING y la función quedaría abierta a PUBLIC sin aviso)
do $$
declare
  v text;
begin
  select string_agg(format('%s (dueño %s)', p.oid::regprocedure, pg_get_userbyid(p.proowner)), ', ') into v
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d
                    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
    and (p.proacl is null
         or exists (select 1 from aclexplode(p.proacl) a
                    where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
    and p.proowner <> 'postgres'::regrole;
  if v is not null then
    raise exception 'P1: funciones de public con EXECUTE a PUBLIC cuyo dueño no es postgres: %', v;
  end if;
end
$$;

-- [2/4] Auth ejecuta handle_new_user (disparador de auth.users); se concede antes de revocar
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- [3/4] Quitar EXECUTE a PUBLIC solo donde hoy lo tiene, y darlo a los tres roles de Supabase
do $$
declare
  f record;
begin
  for f in
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d
                      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
      and (p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) a
                      where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
  loop
    execute format('revoke execute on routine %s from public', f.firma);
    execute format('grant execute on routine %s to anon, authenticated, service_role', f.firma);
  end loop;
end
$$;

-- [4/4] Toda función nueva de postgres nace sin EXECUTE a PUBLIC (global, sin "in schema")
alter default privileges for role postgres revoke execute on functions from public;
