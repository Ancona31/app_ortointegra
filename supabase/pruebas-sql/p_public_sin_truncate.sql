-- Bloque 3 de «agenda v2 lista para producción» — public sin TRUNCATE para los
-- tres roles (20261126120000_public_sin_truncate.sql). Se corre con
-- scripts/pruebas-sql.sh.
--
-- Todo va en UNA transacción que termina en rollback, y cada intento de
-- TRUNCATE va además en su propio subbloque que se deshace SIEMPRE: si el
-- TRUNCATE entrara (sólo en una mutación), el subbloque lanza una excepción
-- propia y lo revierte antes de seguir. Nunca se vacía nada de verdad. La
-- tabla de auditoría no se intenta aquí (es de m_*_sin_truncate.sql, la única
-- que la guarda pruebasSinBorrarAuditoria.test.ts deja intentarlo): este
-- archivo no la nombra.
-- lock_timeout de 5 s: el TRUNCATE del dueño toma ACCESS EXCLUSIVE (lo suelta
-- el subbloque al deshacerse); si otra sesión ocupa la tabla, la prueba falla
-- con 55P03 en vez de esperar.
--
-- Casos:
--   1 · catálogo: ninguna tabla de public (r, p, f) da TRUNCATE a anon,
--       authenticated ni service_role; ni los privilegios por omisión de
--       postgres en public.
--   2 · anon, authenticated y service_role: TRUNCATE de cada tabla clínica y
--       de una muestra de las demás → 42501 (sin privilegio).
--   3 · postgres (el dueño, que conserva el privilegio): TRUNCATE … CASCADE de
--       cada tabla clínica → P0001 del disparador, con su nombre.
--   4 · postgres: TRUNCATE clinicas CASCADE (sin disparador propio) → P0001:
--       lo paran los disparadores de las tablas que arrastra.
--   5 · service_role con TRUNCATE devuelto en una tabla (dentro del
--       subbloque) → P0001: las dos capas valen por separado; el GRANT no
--       sobrevive.
--   6 · los 11 disparadores y la función, como los deja la migración.
--   7 · el recuento de filas de las tablas tocadas no cambió.
--
-- MUTACIONES (en rojo), al principio, dentro de esta transacción:
--   grant truncate on public.consultas to authenticated;
--     → «PT caso 1 (catálogo)» con public.consultas:authenticated.
--   drop trigger trg_documentos_sin_truncate on public.documentos;
--     → «PT caso 3 (documentos)»: P0001 de otra tabla (la que arrastra el
--       CASCADE: firmas_documento) en vez del suyo.
-- Sin la migración aplicada: «PT caso 1 (catálogo)» con las 30 tablas.
begin;

set local lock_timeout = '5s';

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'PT %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;

-- Intenta el TRUNCATE de p_tabla como p_rol y devuelve 'vació' o el SQLSTATE (y el mensaje si es P0001).
-- El subbloque se deshace siempre: si el TRUNCATE entra, la excepción 'ZZ000' lo revierte.
create function pg_temp.intenta(p_rol text, p_tabla text, p_cascada boolean default false, p_conceder boolean default false)
returns text language plpgsql as $$
declare v text;
begin
  begin
    if p_conceder then
      execute format('grant truncate on public.%I to %I', p_tabla, p_rol);
    end if;
    execute format('set local role %I', p_rol);
    execute format('truncate public.%I', p_tabla) || case when p_cascada then ' cascade' else '' end;
    raise exception using errcode = 'ZZ000', message = 'vació';
  exception when others then
    v := case sqlstate when 'ZZ000' then 'vació' when 'P0001' then 'P0001 ' || sqlerrm else sqlstate end;
  end;
  reset role;
  return v;
end $$;

create temp table _clinicas(t text primary key);
insert into _clinicas values ('addendums'), ('appointments'), ('calculadora_resultados'), ('casos_clinicos'),
  ('casos_clinicos_recursos'), ('consultas'), ('documentos'), ('mediciones_analitos'), ('paciente_medico'),
  ('pacientes'), ('solicitudes_arco');
-- Muestra de las que no llevan disparador (sólo pierden el privilegio).
create temp table _otras(t text primary key);
insert into _otras values ('cat_cie10'), ('clinicas'), ('firmas_documento'), ('profiles'), ('rate_limits'),
  ('stripe_webhook_events'), ('tipos_cita');

create function pg_temp.recuento() returns text language plpgsql as $$
declare v_t text; v_n bigint; v text := '';
begin
  for v_t in select t from _clinicas union select 'firmas_documento' union select 'clinicas' order by 1 loop
    execute format('select count(*) from public.%I', v_t) into v_n;
    v := v || v_t || '=' || v_n || ' ';
  end loop;
  return v;
end $$;
create temp table _antes as select pg_temp.recuento() as r;

-- ── 1 · catálogo ─────────────────────────────────────────────────────
select pg_temp.esperar('caso 1 (catálogo)',
  (select string_agg(c.oid::regclass::text || ':' || r, ', ' order by c.relname, r)
     from pg_class c cross join unnest(array['anon', 'authenticated', 'service_role']) r
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'f')
      and has_table_privilege(r, c.oid, 'TRUNCATE')),
  null);
select pg_temp.esperar('caso 1 (privilegios por omisión de postgres)',
  (select string_agg(a.grantee::regrole::text, ',') from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'
      and a.privilege_type = 'TRUNCATE' and a.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)),
  null);

-- ── 2 · los tres roles, sin privilegio ───────────────────────────────
select pg_temp.esperar(format('caso 2 (%s, %s)', r, x.t), pg_temp.intenta(r, x.t), '42501')
  from (select t from _clinicas union all select t from _otras) x
  cross join unnest(array['anon', 'authenticated', 'service_role']) r;

-- ── 3 · el dueño: lo para el disparador de cada tabla ────────────────
select pg_temp.esperar(format('caso 3 (%s)', t), pg_temp.intenta('postgres', t, true),
  format('P0001 No se permite TRUNCATE sobre public.%s: guarda datos clínicos o de auditoría.', t))
  from _clinicas;

-- ── 4 · CASCADE desde una tabla sin disparador ───────────────────────
select pg_temp.esperar('caso 4 (clinicas cascade)', left(pg_temp.intenta('postgres', 'clinicas', true), 42),
  'P0001 No se permite TRUNCATE sobre public.');

-- ── 5 · con el privilegio devuelto (deshecho con el subbloque) ───────
select pg_temp.esperar('caso 5 (service_role con TRUNCATE)', pg_temp.intenta('service_role', 'mediciones_analitos', false, true),
  'P0001 No se permite TRUNCATE sobre public.mediciones_analitos: guarda datos clínicos o de auditoría.');
select pg_temp.esperar('caso 5 (el GRANT se deshizo)',
  has_table_privilege('service_role', 'public.mediciones_analitos', 'TRUNCATE')::text, 'false');

-- ── 6 · disparadores y función ───────────────────────────────────────
select pg_temp.esperar('caso 6 (disparadores)',
  (select string_agg(x.t, ',' order by x.t) from _clinicas x
    where exists (select 1 from pg_trigger g where g.tgrelid = ('public.' || x.t)::regclass
                    and g.tgname = 'trg_' || x.t || '_sin_truncate' and g.tgtype = 34 and g.tgenabled = 'O'
                    and g.tgfoid = to_regprocedure('public.prohibir_truncate()') and not g.tgisinternal)),
  (select string_agg(t, ',' order by t) from _clinicas));
select pg_temp.esperar('caso 6 (función)',
  (select (not p.prosecdef)::text || '/' || (p.proconfig = array['search_path=""'])::text || '/'
          || has_function_privilege('public', p.oid, 'EXECUTE')::text || '/'
          || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
     from pg_proc p where p.oid = to_regprocedure('public.prohibir_truncate()')),
  'true/true/false/true');

-- ── 7 · nada se vació ────────────────────────────────────────────────
select pg_temp.esperar('caso 7 (recuento)', pg_temp.recuento(), (select r from _antes));

rollback;
