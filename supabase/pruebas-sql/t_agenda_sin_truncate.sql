-- Agenda v2 sin TRUNCATE en las tablas con datos de personas
-- (20261201180000_agenda_sin_truncate.sql). Se corre con scripts/pruebas-sql.sh.
--
-- Todo va en UNA transacción que termina en rollback, y cada intento de
-- TRUNCATE va además en su propio subbloque que se deshace SIEMPRE: si el
-- TRUNCATE entra (caso 4, a propósito, y cualquier mutación), el subbloque
-- lanza una excepción propia y lo revierte antes de seguir. Nunca se vacía
-- nada de verdad. La tabla de auditoría no se intenta ni se nombra aquí.
-- lock_timeout de 5 s: el TRUNCATE del dueño toma ACCESS EXCLUSIVE (lo suelta
-- el subbloque al deshacerse); si otra sesión ocupa la tabla, la prueba falla
-- con 55P03 en vez de esperar.
--
-- Casos:
--   1 · catálogo: ninguna de las 16 tablas de la agenda da TRUNCATE a anon,
--       authenticated ni service_role.
--   2 · anon, authenticated y service_role: TRUNCATE de cada una de las 16 →
--       42501 (sin privilegio; en respaldos, sin USAGE del esquema).
--   3 · postgres (el dueño, que conserva el privilegio): TRUNCATE … CASCADE de
--       cada una de las 11 con datos de personas → P0001 de SU disparador.
--   4 · postgres: dos de las de configuración sin disparador (agenda_ajustes,
--       gcal_sync_estado) SÍ se vacían (deshecho en el acto): la decisión de no
--       protegerlas es deliberada y queda fijada aquí. reserva_avisos no entra:
--       appointments la referencia y sin CASCADE da 0A000 (con CASCADE la
--       para el disparador de appointments).
--   5 · service_role con TRUNCATE devuelto en una tabla (dentro del
--       subbloque) → P0001: las dos capas valen por separado; el GRANT no
--       sobrevive.
--   6 · los 11 disparadores, como los deja la migración.
--   7 · el recuento de filas de las 16 tablas no cambió.
--
-- MUTACIONES (en rojo), al principio, dentro de esta transacción:
--   grant truncate on public.reserva_enlaces to authenticated;
--     → «TA caso 1 (catálogo)» con reserva_enlaces:authenticated.
--   drop trigger trg_cita_correos_sin_truncate on public.cita_correos;
--     → «TA caso 3 (cita_correos)»: dio «vació».
-- Sin la migración aplicada: «TA caso 3 (agenda_bloqueos)» dio «vació».
begin;

set local lock_timeout = '5s';
set local client_min_messages = warning;  -- los NOTICE de «truncate cascades to …»

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'TA %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;

-- Intenta el TRUNCATE de p_tabla como p_rol y devuelve 'vació' o el SQLSTATE (y el mensaje si es P0001).
-- El subbloque se deshace siempre: si el TRUNCATE entra, la excepción 'ZZ000' lo revierte.
create function pg_temp.intenta(p_rol text, p_tabla regclass, p_cascada boolean default false, p_conceder boolean default false)
returns text language plpgsql as $$
declare v text;
begin
  begin
    if p_conceder then
      execute format('grant truncate on %s to %I', p_tabla, p_rol);
    end if;
    execute format('set local role %I', p_rol);
    execute format('truncate %s', p_tabla) || case when p_cascada then ' cascade' else '' end;
    raise exception using errcode = 'ZZ000', message = 'vació';
  exception when others then
    v := case sqlstate when 'ZZ000' then 'vació' when 'P0001' then 'P0001 ' || sqlerrm else sqlstate end;
  end;
  reset role;
  return v;
end $$;

-- Con datos de personas: llevan disparador.
create temp table _con(t regclass primary key);
insert into _con values ('public.agenda_bloqueos'), ('public.avisos_clinica'), ('public.cita_confirmaciones'),
  ('public.cita_correos'), ('public.cita_reagendos'), ('public.gcal_movimientos_rechazados'), ('public.reserva_contactos'),
  ('public.reserva_empalmes_google'), ('public.reserva_enlaces'), ('public.reserva_incidencias'),
  ('public.reserva_verificaciones');
-- Sin datos de personas: sólo pierden el privilegio de los tres roles.
create temp table _sin(t regclass primary key);
insert into _sin values ('public.agenda_ajustes'), ('public.tipos_cita'), ('public.reserva_avisos'),
  ('public.gcal_sync_estado'), ('respaldos.consultorios_horario_20261119');

create function pg_temp.recuento() returns text language plpgsql as $$
declare v_t regclass; v_n bigint; v text := '';
begin
  for v_t in select t from _con union select t from _sin order by 1 loop
    execute format('select count(*) from %s', v_t) into v_n;
    v := v || v_t::text || '=' || v_n || ' ';
  end loop;
  return v;
end $$;
create temp table _antes as select pg_temp.recuento() as r;

-- ── 1 · catálogo ─────────────────────────────────────────────────────
select pg_temp.esperar('caso 1 (catálogo)',
  (select string_agg(x.t::text || ':' || r, ', ' order by x.t::text, r)
     from (select t from _con union all select t from _sin) x
     cross join unnest(array['anon', 'authenticated', 'service_role']) r
    where has_table_privilege(r, x.t, 'TRUNCATE')),
  null);

-- ── 2 · los tres roles, sin privilegio ───────────────────────────────
select pg_temp.esperar(format('caso 2 (%s, %s)', r, x.t), pg_temp.intenta(r, x.t), '42501')
  from (select t from _con union all select t from _sin) x
  cross join unnest(array['anon', 'authenticated', 'service_role']) r;

-- ── 3 · el dueño: lo para el disparador de cada tabla ────────────────
select pg_temp.esperar(format('caso 3 (%s)', t), pg_temp.intenta('postgres', t, true),
  format('P0001 No se permite TRUNCATE sobre public.%s: guarda datos clínicos o de auditoría.',
         (select relname from pg_class where oid = t)))
  from _con;

-- ── 4 · las de configuración no llevan disparador (deshecho) ─────────
select pg_temp.esperar(format('caso 4 (%s)', t), pg_temp.intenta('postgres', t), 'vació')
  from unnest(array['public.agenda_ajustes', 'public.gcal_sync_estado']::regclass[]) t;

-- ── 5 · con el privilegio devuelto (deshecho con el subbloque) ───────
select pg_temp.esperar('caso 5 (service_role con TRUNCATE)',
  pg_temp.intenta('service_role', 'public.reserva_contactos', false, true),
  'P0001 No se permite TRUNCATE sobre public.reserva_contactos: guarda datos clínicos o de auditoría.');
select pg_temp.esperar('caso 5 (el GRANT se deshizo)',
  has_table_privilege('service_role', 'public.reserva_contactos', 'TRUNCATE')::text, 'false');

-- ── 6 · disparadores ─────────────────────────────────────────────────
select pg_temp.esperar('caso 6 (disparadores)',
  (select string_agg(x.t::text, ',' order by x.t::text) from _con x
    where exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                   where g.tgrelid = x.t and g.tgname = 'trg_' || c.relname || '_sin_truncate'
                     and g.tgtype = 34 and g.tgenabled = 'O' and g.tgnargs = 0
                     and g.tgfoid = to_regprocedure('public.prohibir_truncate()') and not g.tgisinternal)),
  (select string_agg(t::text, ',' order by t::text) from _con));
select pg_temp.esperar('caso 6 (las de configuración, sin disparador sin_truncate)',
  (select string_agg(g.tgname, ',') from pg_trigger g where g.tgrelid in (select t from _sin) and g.tgtype & 32 = 32),
  null);

-- ── 7 · nada se vació ────────────────────────────────────────────────
select pg_temp.esperar('caso 7 (recuento)', pg_temp.recuento(), (select r from _antes));

rollback;
