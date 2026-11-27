-- Agenda · BASE-2 · B2 (20261208130000) — el lote de reserva_purgar (M4) y de
-- reserva_empalmes_pendientes_procesar (M5) es un TOPE, lo resuelva como lo resuelva el planificador.
--   A · EL MECANISMO, de forma determinista, sobre una tabla temporal con las estadísticas desfasadas
--       (analizada con 1 fila, luego crece): con la forma VIEJA («WHERE id IN (subconsulta con LIMIT y FOR
--       UPDATE SKIP LOCKED)») el plan es «Nested Loop Semi Join», la subconsulta se vuelve a ejecutar y un
--       LIMIT 1 se lleva MÁS de una fila; con la forma NUEVA (el lote aparte, en un arreglo), exactamente 1.
--       Si la parte «vieja» deja de fallar, Postgres cambió de plan: esta prueba ya no demuestra nada y hay
--       que rehacerla (por eso lo exige en vez de darlo por bueno).
--   B · LAS FUNCIONES DE VERDAD: con lote 1 y varias candidatas, exactamente 1, y dicen que quedan.
--   C · EL CUERPO: ninguna de las dos conserva un «IN (SELECT».
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
begin;

do $$
begin
  if not exists (select 1 from pg_proc p where p.oid = to_regprocedure('public.reserva_purgar(integer)') and position('BASE-2 (B2)' in p.prosrc) > 0) then
    raise exception 'B2 caso 0: reserva_purgar no es la de B2 (falta 20261208130000 o se deshizo)';
  end if;
end $$;

-- ── A · el mecanismo ──
create temp table _b2 (id uuid primary key default gen_random_uuid(), creado timestamptz not null, dato text) on commit drop;
insert into _b2 (creado, dato) values (now() - interval '9 minutes', 'a');
analyze _b2;   -- estadísticas de UNA fila…
insert into _b2 (creado, dato) select now() - (g || ' minutes')::interval, 'a' from generate_series(1, 4) g;   -- …y ahora son cinco

do $$
declare v_plan text := ''; v_linea text; v_n integer; v_ids uuid[];
begin
  -- A1 · la forma vieja con UPDATE: el plan y cuántas se lleva.
  for v_linea in explain (costs off)
    update _b2 e set dato = null where e.id in (select x.id from _b2 x where x.dato is not null order by x.creado limit 1 for update skip locked)
  loop v_plan := v_plan || v_linea || E'\n'; end loop;
  if position('Nested Loop Semi Join' in v_plan) = 0 then
    raise exception E'B2 caso A1: el plan de la forma vieja ya no es «Nested Loop Semi Join»; esta prueba no demuestra nada, hay que rehacerla:\n%', v_plan;
  end if;
  update _b2 e set dato = null where e.id in (select x.id from _b2 x where x.dato is not null order by x.creado limit 1 for update skip locked);
  get diagnostics v_n = row_count;
  if v_n <= 1 then raise exception 'B2 caso A1: la forma vieja con LIMIT 1 se llevó % (se esperaba MÁS de 1: es el defecto)', v_n; end if;
  update _b2 set dato = 'a';
  -- A2 · la forma vieja con DELETE (en un subbloque que se deshace, para no perder las filas).
  begin
    delete from _b2 e where e.id in (select x.id from _b2 x order by x.creado limit 1 for update skip locked);
    get diagnostics v_n = row_count;
    if v_n <= 1 then raise exception 'B2 caso A2: la forma vieja con LIMIT 1 borró % (se esperaba MÁS de 1: es el defecto)', v_n; end if;
    raise exception 'deshacer' using errcode = 'P0B21';
  exception when sqlstate 'P0B21' then null;
  end;
  if (select count(*) from _b2) <> 5 then raise exception 'B2 caso A2: el subbloque no devolvió las filas'; end if;
  -- A3 · la forma nueva, mismas filas y mismas estadísticas: exactamente 1, con UPDATE y con DELETE.
  select array_agg(s.id) into v_ids from (select x.id from _b2 x where x.dato is not null order by x.creado limit 1 for update skip locked) s;
  update _b2 e set dato = null where e.id = any (v_ids);
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'B2 caso A3: la forma nueva con LIMIT 1 actualizó %', v_n; end if;
  select array_agg(s.id) into v_ids from (select x.id from _b2 x order by x.creado limit 1 for update skip locked) s;
  delete from _b2 e where e.id = any (v_ids);
  get diagnostics v_n = row_count;
  if v_n <> 1 or (select count(*) from _b2) <> 4 then raise exception 'B2 caso A3: la forma nueva con LIMIT 1 borró %', v_n; end if;
  -- Sin candidatas el arreglo es NULL: no se escribe nada (y no falla).
  select array_agg(s.id) into v_ids from (select x.id from _b2 x where false limit 1 for update skip locked) s;
  delete from _b2 e where e.id = any (v_ids);
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'B2 caso A3: sin candidatas borró %', v_n; end if;
end $$;

-- ── B · las funciones de verdad ──
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-0000000b20c1', 'B2 uno', true, 'free', false);
insert into public.ip_rate_limits (ip, ruta, created_at)
select 'b2-viejo', 'b2:prueba', now() - interval '40 days' - (g || ' minutes')::interval from generate_series(1, 4) g;
insert into public.gcal_empalmes_pendientes (clinica_id, cita_id, creado_en)
select '00000000-0000-4000-8000-0000000b20c1', ('00000000-0000-4000-8000-0000000b20d' || g)::uuid, now() - (g || ' minutes')::interval
  from generate_series(1, 4) g;

do $$
declare r record; v_antes bigint; i integer;
begin
  -- La purga: de las 4 de ip_rate_limits, una por pasada; las cuatro pasadas dicen la verdad.
  for i in 1..4 loop
    select count(*) into v_antes from public.ip_rate_limits where ip = 'b2-viejo';
    set local role service_role;
    select * into r from public.reserva_purgar(1);
    reset role;
    if r.r_limites <> 1 or not r.r_quedan or (select count(*) from public.ip_rate_limits where ip = 'b2-viejo') <> v_antes - 1 then
      raise exception 'B2 caso B1 (pasada %): con lote 1 la purga dio % y quedaron % de %', i, r,
        (select count(*) from public.ip_rate_limits where ip = 'b2-viejo'), v_antes;
    end if;
    if r.r_verificaciones > 1 or r.r_correos > 1 then raise exception 'B2 caso B1 (pasada %): algún contador pasó del lote (%)', i, r; end if;
  end loop;
  -- La cola: de 4 apuntes, uno por pasada (las citas no existen: se descartan, 0 pares), y el más viejo primero.
  for i in 1..4 loop
    set local role service_role;
    select * into r from public.reserva_empalmes_pendientes_procesar('00000000-0000-4000-8000-0000000b20c1', 1);
    reset role;
    if (r.r_procesados, r.r_pares, r.r_quedan) is distinct from (1, 0, true)
       or (select count(*) from public.gcal_empalmes_pendientes where clinica_id = '00000000-0000-4000-8000-0000000b20c1') <> 4 - i
       or exists (select 1 from public.gcal_empalmes_pendientes where cita_id = ('00000000-0000-4000-8000-0000000b20d' || (5 - i))::uuid) then
      raise exception 'B2 caso B2 (pasada %): con límite 1 dio % y quedaron %', i, r,
        (select count(*) from public.gcal_empalmes_pendientes where clinica_id = '00000000-0000-4000-8000-0000000b20c1');
    end if;
  end loop;
  set local role service_role;
  select * into r from public.reserva_empalmes_pendientes_procesar('00000000-0000-4000-8000-0000000b20c1', 1);
  reset role;
  if (r.r_procesados, r.r_pares, r.r_quedan) is distinct from (0, 0, false) then raise exception 'B2 caso B2: con la cola vacía dio %', r; end if;
end $$;

-- ── C · el cuerpo ──
do $$
begin
  if exists (select 1 from pg_proc p
              where p.oid in (to_regprocedure('public.reserva_purgar(integer)'), to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)'))
                and (p.prosrc ~* 'IN\s*\(\s*SELECT' or position('= ANY (v_' in p.prosrc) = 0)) then
    raise exception 'B2 caso C: alguna de las dos volvió a elegir y escribir el lote en la misma sentencia';
  end if;
end $$;

rollback;
