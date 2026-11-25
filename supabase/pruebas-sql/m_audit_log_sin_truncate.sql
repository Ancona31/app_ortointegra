-- Integración de la tanda M (encargo de Angel) — audit_log no se puede vaciar
-- (20261125170000_audit_log_sin_truncate.sql). Se corre con scripts/pruebas-sql.sh.
--
-- Todo va en UNA transacción que termina en rollback, y cada intento de
-- TRUNCATE va además en su propio subbloque que se deshace SIEMPRE: si el
-- TRUNCATE entrara (sólo en una mutación), el subbloque lanza una excepción
-- propia y lo revierte antes de seguir. Nunca se vacía la tabla de verdad.
-- Es el único archivo que la guarda pruebasSinBorrarAuditoria.test.ts deja
-- escribir TRUNCATE de audit_log, y sólo porque comprueba que falla.
--
-- Casos:
--   1 · anon, authenticated y service_role: TRUNCATE → 42501 (sin privilegio).
--   2 · postgres (el dueño, que conserva el privilegio): lo para el disparador,
--       P0001 con el mensaje del de borrado.
--   3 · service_role con TRUNCATE devuelto (dentro del subbloque): también lo
--       para el disparador. Es decir, las dos capas valen por separado.
--   4 · el disparador existe: BEFORE TRUNCATE, de sentencia, la función del de
--       borrado, habilitado; los de fila siguen.
--   5 · el recuento de filas no cambió.
--
-- MUTACIÓN (en rojo): al principio, dentro de esta transacción,
--   grant truncate on public.audit_log to anon, authenticated, service_role;
--   drop trigger prevent_audit_truncate on public.audit_log;
-- → «AT caso 1 (anon): dio vació, esperaba 42501». Sólo sin el disparador →
-- «AT caso 2»; sólo con el GRANT → «AT caso 1 (anon): dio P0001…».
begin;

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'AT %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;

-- Intenta el TRUNCATE como p_rol y devuelve 'vació' o el SQLSTATE (y el mensaje si es P0001).
-- El subbloque se deshace siempre: si el TRUNCATE entra, la excepción 'ZZ000' lo revierte.
create function pg_temp.intenta(p_rol text, p_conceder boolean default false) returns text language plpgsql as $$
declare v text;
begin
  begin
    if p_conceder then
      execute format('grant truncate on public.audit_log to %I', p_rol);
    end if;
    execute format('set local role %I', p_rol);
    truncate public.audit_log;
    raise exception using errcode = 'ZZ000', message = 'vació';
  exception when others then
    v := case sqlstate when 'ZZ000' then 'vació' when 'P0001' then 'P0001 ' || sqlerrm else sqlstate end;
  end;
  reset role;
  return v;
end $$;

create temp table _antes as select count(*) as n from public.audit_log;

-- ── 1 · los tres roles, sin privilegio ───────────────────────────────
select pg_temp.esperar('caso 1 (anon)', pg_temp.intenta('anon'), '42501');
select pg_temp.esperar('caso 1 (authenticated)', pg_temp.intenta('authenticated'), '42501');
select pg_temp.esperar('caso 1 (service_role)', pg_temp.intenta('service_role'), '42501');

-- ── 2 · el dueño: lo para el disparador ──────────────────────────────
select pg_temp.esperar('caso 2 (postgres)', pg_temp.intenta('postgres'),
  'P0001 El audit_log es inmutable. No se permite UPDATE ni DELETE.');

-- ── 3 · con el privilegio devuelto (deshecho con el subbloque) ───────
select pg_temp.esperar('caso 3 (service_role con TRUNCATE)', pg_temp.intenta('service_role', true),
  'P0001 El audit_log es inmutable. No se permite UPDATE ni DELETE.');
-- …y el GRANT del caso 3 no sobrevivió al subbloque.
select pg_temp.esperar('caso 3 (el GRANT se deshizo)',
  has_table_privilege('service_role', 'public.audit_log', 'TRUNCATE')::text, 'false');

-- ── 4 · el disparador ────────────────────────────────────────────────
select pg_temp.esperar('caso 4 (disparador)',
  (select t.tgtype::text || '/' || (t.tgfoid = 'public.prevent_audit_modification()'::regprocedure)::text || '/' || t.tgenabled::text
     from pg_trigger t where t.tgrelid = 'public.audit_log'::regclass and t.tgname = 'prevent_audit_truncate' and not t.tgisinternal),
  '34/true/O');
select pg_temp.esperar('caso 4 (los de fila)',
  (select string_agg(tgname, ',' order by tgname) from pg_trigger
    where tgrelid = 'public.audit_log'::regclass and not tgisinternal and tgname <> 'prevent_audit_truncate'),
  'prevent_audit_delete,prevent_audit_update');

-- ── 5 · nada se vació ────────────────────────────────────────────────
select pg_temp.esperar('caso 5 (recuento)', (select count(*) from public.audit_log)::text, (select n from _antes)::text);

rollback;
