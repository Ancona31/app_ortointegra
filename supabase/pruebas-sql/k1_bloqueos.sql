-- Agenda tanda K (K1, sección A de Angel) — bloqueo de horarios
-- (20261123120000_agenda_k1_bloqueos.sql):
--   1. quién crea, ve, edita y quita un bloqueo: el mismo predicado que appointments, con las
--      puertas de alta, la v2 encendida y el médico de la clínica; columnas de Google cerradas;
--   2. el bloqueo no ofrece turnos (reserva_ocupacion) y la base lo rechaza al reservar
--      ('ocupado'), con y sin hora; tocar el extremo no es empalme;
--   4. lo de todo el día de appointments ya no ocupa en el enlace; lo que tiene hora, sí;
--   6. gcal_bloqueo_aplicar: movido/borrado en Google vuelve al bloqueo; eco y Spinus más
--      reciente no; un evento de Google nunca crea un bloqueo;
--   y audit_log en alta, edición y borrado.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
-- La carrera bloqueo-contra-reserva (dos sesiones) va en scripts/reserva-carrera.sh, escenario 6.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1 (v2): b1 médico administrador, b2 médico invitado, b3 secretaria. c2 (v2): b4 administrador.
-- c3 (v2 APAGADA): b5 administrador.
insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-0000000b1c01', 'K1 uno', true),
  ('00000000-0000-4000-8000-0000000b1c02', 'K1 dos', true),
  ('00000000-0000-4000-8000-0000000b1c03', 'K1 tres', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000b1b01'::uuid, 'k1-b1@prueba.local'),
               ('00000000-0000-4000-8000-0000000b1b02'::uuid, 'k1-b2@prueba.local'),
               ('00000000-0000-4000-8000-0000000b1b03'::uuid, 'k1-b3@prueba.local'),
               ('00000000-0000-4000-8000-0000000b1b04'::uuid, 'k1-b4@prueba.local'),
               ('00000000-0000-4000-8000-0000000b1b05'::uuid, 'k1-b5@prueba.local')) u(id, email);
update public.profiles p
   set clinica_id = v.clinica, es_admin_de_clinica = v.admin, role = v.rol,
       nombres = 'Médico', apellido_paterno = 'K1', especialidad = 'Ortopedia', cedula_profesional = '1234567'
  from (values ('00000000-0000-4000-8000-0000000b1b01'::uuid, '00000000-0000-4000-8000-0000000b1c01'::uuid, true, 'medico'),
               ('00000000-0000-4000-8000-0000000b1b02'::uuid, '00000000-0000-4000-8000-0000000b1c01'::uuid, false, 'medico'),
               ('00000000-0000-4000-8000-0000000b1b03'::uuid, '00000000-0000-4000-8000-0000000b1c01'::uuid, false, 'secretaria'),
               ('00000000-0000-4000-8000-0000000b1b04'::uuid, '00000000-0000-4000-8000-0000000b1c02'::uuid, true, 'medico'),
               ('00000000-0000-4000-8000-0000000b1b05'::uuid, '00000000-0000-4000-8000-0000000b1c03'::uuid, true, 'medico')) v(id, clinica, admin, rol)
 where p.id = v.id;
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000000b1c01', true), ('00000000-0000-4000-8000-0000000b1c02', true),
  ('00000000-0000-4000-8000-0000000b1c03', false);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone)
select ('00000000-0000-4000-8000-0000000b1d0' || n)::uuid, c::uuid, m::uuid, 'Consultorio K1', 'K1', 'Calle 1', true, 'America/Mexico_City'
  from (values (1, '00000000-0000-4000-8000-0000000b1c01', '00000000-0000-4000-8000-0000000b1b01'),
               (2, '00000000-0000-4000-8000-0000000b1c01', '00000000-0000-4000-8000-0000000b1b02'),
               (4, '00000000-0000-4000-8000-0000000b1c02', '00000000-0000-4000-8000-0000000b1b04'),
               (5, '00000000-0000-4000-8000-0000000b1c03', '00000000-0000-4000-8000-0000000b1b05')) v(n, c, m);
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo) values
  ('00000000-0000-4000-8000-0000000b1a01', '00000000-0000-4000-8000-0000000b1c01', null, 'Consulta', 30, true);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'K1 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
-- Medianoche (Ciudad de México) del día de dentro de p_dias días.
create function pg_temp.dia(p_dias integer) returns timestamptz language sql as $$
  select (date_trunc('day', now() at time zone 'America/Mexico_City') + make_interval(days => p_dias)) at time zone 'America/Mexico_City';
$$;
-- Un alta como la sesión de p_quien: 'ok' o el SQLSTATE con el que la base se negó.
create function pg_temp.alta(p_quien uuid, p_clinica uuid, p_medico uuid, p_ini timestamptz, p_fin timestamptz,
                             p_todo boolean default false, p_motivo text default null) returns text language plpgsql as $$
begin
  perform pg_temp.como(p_quien);
  set local role authenticated;
  insert into public.agenda_bloqueos (clinica_id, medico_id, inicio, fin, todo_el_dia, zona, motivo)
  values (p_clinica, p_medico, p_ini, p_fin, p_todo, 'America/Mexico_City', p_motivo);
  reset role;
  return 'ok';
exception when others then
  reset role;
  return sqlstate;
end $$;
-- Cuántos bloqueos ve la sesión de p_quien.
create function pg_temp.ve(p_quien uuid) returns text language plpgsql as $$
declare v integer;
begin
  perform pg_temp.como(p_quien);
  set local role authenticated;
  select count(*) into v from public.agenda_bloqueos;
  reset role;
  return v::text;
end $$;
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text), pg_temp.como(uuid), pg_temp.dia(integer)
  to anon, authenticated, service_role;

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-k1', pg_temp.h('aviso-k1'), true, now());
-- Un enlace único nuevo de b1 por llamada (cada reserva 'ok' gasta el suyo).
create function pg_temp.unico(p_nombre text) returns text language sql as $$
  insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en)
  values (gen_random_uuid(), '00000000-0000-4000-8000-0000000b1c01', '00000000-0000-4000-8000-0000000b1b01', 'unico',
          pg_temp.h(p_nombre), 7, now() + interval '7 days')
  returning codigo_hash;
$$;
-- Reserva como el servidor (service_role) con un único nuevo.
create function pg_temp.res(p_nombre text, p_inicio timestamptz, p_tel text) returns text language plpgsql as $$
declare v_hash text := pg_temp.unico(p_nombre);
        v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_resultado into v from public.reservar_por_enlace('00000000-0000-4000-8000-0000000b1c01', v_hash,
    '00000000-0000-4000-8000-0000000b1d01', '00000000-0000-4000-8000-0000000b1a01', p_inicio, 'Persona K1',
    p_tel, null, pg_temp.h('t:' || p_tel), null, null, 'v1-prueba-k1', pg_temp.h('aviso-k1'), gen_random_uuid());
  reset role;
  return v;
end $$;

-- ── Caso 1: quién crea ─────────────────────────────────────────────────
do $$
begin
  perform pg_temp.esperar('caso 1 admin para sí', pg_temp.alta('00000000-0000-4000-8000-0000000b1b01', '00000000-0000-4000-8000-0000000b1c01',
          '00000000-0000-4000-8000-0000000b1b01', pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '12 hours', false, 'Quirófano'), 'ok');
  perform pg_temp.esperar('caso 1 admin para el invitado', pg_temp.alta('00000000-0000-4000-8000-0000000b1b01', '00000000-0000-4000-8000-0000000b1c01',
          '00000000-0000-4000-8000-0000000b1b02', pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '11 hours'), 'ok');
  perform pg_temp.esperar('caso 1 invitado para sí', pg_temp.alta('00000000-0000-4000-8000-0000000b1b02', '00000000-0000-4000-8000-0000000b1c01',
          '00000000-0000-4000-8000-0000000b1b02', pg_temp.dia(7) + interval '10 hours', pg_temp.dia(7) + interval '11 hours'), 'ok');
  perform pg_temp.esperar('caso 1 secretaria para el invitado', pg_temp.alta('00000000-0000-4000-8000-0000000b1b03', '00000000-0000-4000-8000-0000000b1c01',
          '00000000-0000-4000-8000-0000000b1b02', pg_temp.dia(8) + interval '10 hours', pg_temp.dia(8) + interval '11 hours'), 'ok');
  perform pg_temp.esperar('caso 1 invitado para el admin, no', pg_temp.alta('00000000-0000-4000-8000-0000000b1b02', '00000000-0000-4000-8000-0000000b1c01',
          '00000000-0000-4000-8000-0000000b1b01', pg_temp.dia(9) + interval '10 hours', pg_temp.dia(9) + interval '11 hours'), '42501');
  perform pg_temp.esperar('caso 1 otra clínica, no', pg_temp.alta('00000000-0000-4000-8000-0000000b1b04', '00000000-0000-4000-8000-0000000b1c01',
          '00000000-0000-4000-8000-0000000b1b01', pg_temp.dia(9) + interval '10 hours', pg_temp.dia(9) + interval '11 hours'), '42501');
  perform pg_temp.esperar('caso 1 médico de otra clínica en la suya, no', pg_temp.alta('00000000-0000-4000-8000-0000000b1b04', '00000000-0000-4000-8000-0000000b1c02',
          '00000000-0000-4000-8000-0000000b1b01', pg_temp.dia(9) + interval '10 hours', pg_temp.dia(9) + interval '11 hours'), '42501');
  perform pg_temp.esperar('caso 1 v2 apagada, no', pg_temp.alta('00000000-0000-4000-8000-0000000b1b05', '00000000-0000-4000-8000-0000000b1c03',
          '00000000-0000-4000-8000-0000000b1b05', pg_temp.dia(9) + interval '10 hours', pg_temp.dia(9) + interval '11 hours'), '42501');
  perform pg_temp.esperar('caso 1 fin antes que inicio', pg_temp.alta('00000000-0000-4000-8000-0000000b1b01', '00000000-0000-4000-8000-0000000b1c01',
          '00000000-0000-4000-8000-0000000b1b01', pg_temp.dia(9) + interval '11 hours', pg_temp.dia(9) + interval '10 hours'), '23514');
  perform pg_temp.esperar('caso 1 todo el día sin medianoches', pg_temp.alta('00000000-0000-4000-8000-0000000b1b01', '00000000-0000-4000-8000-0000000b1c01',
          '00000000-0000-4000-8000-0000000b1b01', pg_temp.dia(9) + interval '1 hour', pg_temp.dia(10), true), '23514');
  perform pg_temp.esperar('caso 1 todo el día', pg_temp.alta('00000000-0000-4000-8000-0000000b1b01', '00000000-0000-4000-8000-0000000b1c01',
          '00000000-0000-4000-8000-0000000b1b01', pg_temp.dia(11), pg_temp.dia(12), true, 'Vacaciones'), 'ok');
end $$;

-- Las columnas de Google sólo las escribe el servidor.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000b1b01');
  set local role authenticated;
  begin
    insert into public.agenda_bloqueos (clinica_id, medico_id, inicio, fin, google_event_id)
    values ('00000000-0000-4000-8000-0000000b1c01', '00000000-0000-4000-8000-0000000b1b01', now() + interval '20 days',
            now() + interval '20 days 1 hour', 'ev-falso');
    raise exception 'K1 caso 1: authenticated escribió google_event_id';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.agenda_bloqueos set gcal_etag = 'x' where medico_id = '00000000-0000-4000-8000-0000000b1b01';
    raise exception 'K1 caso 1: authenticated escribió gcal_etag';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- ── Caso 2: quién ve, edita y quita ────────────────────────────────────
do $$
declare v_n integer;
        v_m integer;
begin
  perform pg_temp.esperar('caso 2 el admin ve los 5 de c1', pg_temp.ve('00000000-0000-4000-8000-0000000b1b01'), '5');
  perform pg_temp.esperar('caso 2 la secretaria ve los 5', pg_temp.ve('00000000-0000-4000-8000-0000000b1b03'), '5');
  perform pg_temp.esperar('caso 2 el invitado ve los suyos (3)', pg_temp.ve('00000000-0000-4000-8000-0000000b1b02'), '3');
  perform pg_temp.esperar('caso 2 otra clínica no ve nada', pg_temp.ve('00000000-0000-4000-8000-0000000b1b04'), '0');
  -- El invitado no edita ni quita los del administrador (0 filas, sin error: RLS).
  perform pg_temp.como('00000000-0000-4000-8000-0000000b1b02');
  set local role authenticated;
  update public.agenda_bloqueos set motivo = 'ajeno' where medico_id = '00000000-0000-4000-8000-0000000b1b01';
  get diagnostics v_n = row_count;
  delete from public.agenda_bloqueos where medico_id = '00000000-0000-4000-8000-0000000b1b01';
  get diagnostics v_m = row_count;
  reset role;
  perform pg_temp.esperar('caso 2 el invitado no toca los del admin', (v_n + v_m)::text, '0');
end $$;

-- ── Caso 3: audit_log en alta, edición y borrado ───────────────────────
do $$
declare v_id uuid;
        v text;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000b1b03');
  set local role authenticated;
  insert into public.agenda_bloqueos (clinica_id, medico_id, inicio, fin)
  values ('00000000-0000-4000-8000-0000000b1c01', '00000000-0000-4000-8000-0000000b1b02', pg_temp.dia(13) + interval '9 hours',
          pg_temp.dia(13) + interval '10 hours')
  returning id into v_id;
  update public.agenda_bloqueos set motivo = 'Junta', fin = fin + interval '1 hour' where id = v_id;
  delete from public.agenda_bloqueos where id = v_id;
  reset role;
  select string_agg(accion || '@' || user_id, ',' order by accion) into v
    from public.audit_log where tabla = 'agenda_bloqueos' and registro_id = v_id;
  perform pg_temp.esperar('caso 3 auditoría', v, 'DELETE@00000000-0000-4000-8000-0000000b1b03,INSERT@00000000-0000-4000-8000-0000000b1b03,UPDATE@00000000-0000-4000-8000-0000000b1b03');
end $$;

-- ── Caso 4: el enlace (puntos 2 y 4) ───────────────────────────────────
-- b1 tiene: bloqueo 10–12 h del día 6, bloqueo de todo el día 11. Se añaden: un evento de todo
-- el día (appointments) el día 14 y uno con hora el 15 a las 10.
insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status, origen, all_day, consultorio_timezone) values
  ('00000000-0000-4000-8000-0000000b1c01', '00000000-0000-4000-8000-0000000b1b01', 'Congreso', pg_temp.dia(14), pg_temp.dia(15),
   'scheduled', 'spinus', true, 'America/Mexico_City'),
  ('00000000-0000-4000-8000-0000000b1c01', '00000000-0000-4000-8000-0000000b1b01', 'Junta', pg_temp.dia(15) + interval '10 hours',
   pg_temp.dia(15) + interval '11 hours', 'scheduled', 'spinus', false, 'America/Mexico_City');
do $$
declare v_n integer;
        v text;
begin
  perform pg_temp.esperar('caso 4 dentro del bloqueo', pg_temp.res('r1', pg_temp.dia(6) + interval '10 hours 30 minutes', '5512340001'), 'ocupado');
  perform pg_temp.esperar('caso 4 acaba en el fin del bloqueo', pg_temp.res('r2', pg_temp.dia(6) + interval '11 hours 30 minutes', '5512340002'), 'ocupado');
  perform pg_temp.esperar('caso 4 empieza antes y lo pisa', pg_temp.res('r3', pg_temp.dia(6) + interval '9 hours 45 minutes', '5512340003'), 'ocupado');
  perform pg_temp.esperar('caso 4 toca el fin', pg_temp.res('r4', pg_temp.dia(6) + interval '12 hours', '5512340004'), 'ok');
  perform pg_temp.esperar('caso 4 toca el inicio', pg_temp.res('r5', pg_temp.dia(6) + interval '9 hours 30 minutes', '5512340005'), 'ok');
  perform pg_temp.esperar('caso 4 bloqueo de todo el día', pg_temp.res('r6', pg_temp.dia(11) + interval '15 hours', '5512340006'), 'ocupado');
  perform pg_temp.esperar('caso 4 el día siguiente al bloqueo', pg_temp.res('r7', pg_temp.dia(12) + interval '9 hours', '5512340007'), 'ok');
  perform pg_temp.esperar('caso 4 evento de todo el día ya no ocupa', pg_temp.res('r8', pg_temp.dia(14) + interval '10 hours', '5512340008'), 'ok');
  perform pg_temp.esperar('caso 4 evento con hora sigue ocupando', pg_temp.res('r9', pg_temp.dia(15) + interval '10 hours', '5512340009'), 'ocupado');
  -- El bloqueo de OTRO médico (b2, día 6 10–11 h) no cuenta para el enlace de b1: lo prueba
  -- 'toca el inicio' (b1 libre de 9:30 a 10) y esto, que cae en el de b2 pero no en el de b1.
  perform pg_temp.esperar('caso 4 bloqueo de otro médico no cuenta', pg_temp.res('r10', pg_temp.dia(7) + interval '10 hours', '5512340010'), 'ok');

  -- reserva_ocupacion: la página no ofrece lo que esto devuelve.
  -- Días 14 y 15: la reserva r8 (14, 10:00) y la junta (15, 10–11) sí; el congreso de todo el día, no.
  set local role service_role;
  select count(*)::text || '/' || count(*) filter (where o.end_time - o.start_time >= interval '1 day')::text
    into v
    from public.reserva_enlaces e
    cross join lateral public.reserva_ocupacion('00000000-0000-4000-8000-0000000b1c01', e.id, pg_temp.dia(14), pg_temp.dia(16)) o
   where e.codigo_hash = pg_temp.h('r1');
  reset role;
  perform pg_temp.esperar('caso 4 ocupación días 14-15 (filas / de todo el día)', v, '2/0');
  set local role service_role;
  select count(*) into v_n
    from public.reserva_enlaces e
    cross join lateral public.reserva_ocupacion('00000000-0000-4000-8000-0000000b1c01', e.id, pg_temp.dia(6), pg_temp.dia(7)) o
   where e.codigo_hash = pg_temp.h('r1')
     and o.start_time = pg_temp.dia(6) + interval '10 hours' and o.end_time = pg_temp.dia(6) + interval '12 hours';
  reset role;
  perform pg_temp.esperar('caso 4 ocupación con el bloqueo', v_n::text, '1');
  update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = '00000000-0000-4000-8000-0000000b1c01';
  set local role service_role;
  select count(*) into v_n
    from public.reserva_enlaces e
    cross join lateral public.reserva_ocupacion('00000000-0000-4000-8000-0000000b1c01', e.id, pg_temp.dia(6), pg_temp.dia(7)) o
   where e.codigo_hash = pg_temp.h('r1');
  reset role;
  update public.agenda_ajustes set agenda_v2_encendida = true where clinica_id = '00000000-0000-4000-8000-0000000b1c01';
  perform pg_temp.esperar('caso 4 ocupación apagada', v_n::text, '0');
end $$;

-- ── Caso 5: gcal_bloqueo_aplicar ───────────────────────────────────────
insert into public.clinica_conexiones_google (clinica_id, user_id, rol, calendar_id, estado) values
  ('00000000-0000-4000-8000-0000000b1c01', '00000000-0000-4000-8000-0000000b1b01', 'clinica', 'cal-k1', 'activa');
-- Ligados como los dejaría el servidor: b-ev1 (con hora) y b-ev2 (por marca, sin evento aún).
insert into public.agenda_bloqueos (id, clinica_id, medico_id, inicio, fin, zona, google_event_id, gcal_calendar_id, gcal_etag) values
  ('00000000-0000-4000-8000-0000000b1e01', '00000000-0000-4000-8000-0000000b1c01', '00000000-0000-4000-8000-0000000b1b01',
   pg_temp.dia(20) + interval '9 hours', pg_temp.dia(20) + interval '10 hours', 'America/Mexico_City', 'ev-k1-1', 'cal-k1', 'e1'),
  ('00000000-0000-4000-8000-0000000b1e02', '00000000-0000-4000-8000-0000000b1c01', '00000000-0000-4000-8000-0000000b1b01',
   pg_temp.dia(21) + interval '9 hours', pg_temp.dia(21) + interval '10 hours', 'America/Mexico_City', null, null, null);
do $$
declare v text;
        v_n integer;
        v_ant integer;
begin
  -- Permisos: sólo service_role.
  perform pg_temp.esperar('caso 5 EXECUTE anon/authenticated/service_role',
          has_function_privilege('anon', 'public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)', 'EXECUTE')::text
          || '/' || has_function_privilege('authenticated', 'public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)', 'EXECUTE')::text
          || '/' || has_function_privilege('service_role', 'public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date)', 'EXECUTE')::text,
          'false/false/true');
  set local role service_role;
  -- Eco (mismo etag): nada.
  v_n := public.gcal_bloqueo_aplicar('00000000-0000-4000-8000-0000000b1c01', 'cal-k1', 'ev-k1-1', null, 'e1', now() + interval '1 minute',
         false, pg_temp.dia(20) + interval '15 hours', pg_temp.dia(20) + interval '16 hours', null, null);
  perform pg_temp.esperar('caso 5 eco', v_n::text, '0');
  -- Google más viejo que Spinus: nada.
  v_n := public.gcal_bloqueo_aplicar('00000000-0000-4000-8000-0000000b1c01', 'cal-k1', 'ev-k1-1', null, 'e2', now() - interval '1 day',
         false, pg_temp.dia(20) + interval '15 hours', pg_temp.dia(20) + interval '16 hours', null, null);
  perform pg_temp.esperar('caso 5 Spinus más reciente', v_n::text, '0');
  -- Otro calendario: nada.
  v_n := public.gcal_bloqueo_aplicar('00000000-0000-4000-8000-0000000b1c01', 'cal-otro', 'ev-k1-1', null, 'e2', now() + interval '1 minute',
         false, pg_temp.dia(20) + interval '15 hours', pg_temp.dia(20) + interval '16 hours', null, null);
  perform pg_temp.esperar('caso 5 otro calendario', v_n::text, '0');
  -- Otra clínica (la conexión es de c1): nada.
  v_n := public.gcal_bloqueo_aplicar('00000000-0000-4000-8000-0000000b1c02', 'cal-k1', 'ev-k1-1', null, 'e2', now() + interval '1 minute',
         false, pg_temp.dia(20) + interval '15 hours', pg_temp.dia(20) + interval '16 hours', null, null);
  perform pg_temp.esperar('caso 5 otra clínica', v_n::text, '0');
  -- Movido en Google: las puntas nuevas.
  v_n := public.gcal_bloqueo_aplicar('00000000-0000-4000-8000-0000000b1c01', 'cal-k1', 'ev-k1-1', null, 'e2', now() + interval '1 minute',
         false, pg_temp.dia(20) + interval '15 hours', pg_temp.dia(20) + interval '16 hours', null, null);
  perform pg_temp.esperar('caso 5 movido', v_n::text, '1');
  -- A todo el día (fechas de Google en la zona del bloqueo).
  v_n := public.gcal_bloqueo_aplicar('00000000-0000-4000-8000-0000000b1c01', 'cal-k1', 'ev-k1-1', null, 'e3', now() + interval '2 minutes',
         false, null, null, (pg_temp.dia(22) at time zone 'America/Mexico_City')::date, (pg_temp.dia(24) at time zone 'America/Mexico_City')::date);
  reset role;
  select todo_el_dia::text || '/' || (inicio = pg_temp.dia(22))::text || '/' || (fin = pg_temp.dia(24))::text || '/' || gcal_etag
    into v from public.agenda_bloqueos where id = '00000000-0000-4000-8000-0000000b1e01';
  perform pg_temp.esperar('caso 5 a todo el día', v, 'true/true/true/e3');
  -- Por la marca (sin evento aún): queda ligado.
  set local role service_role;
  v_n := public.gcal_bloqueo_aplicar('00000000-0000-4000-8000-0000000b1c01', 'cal-k1', 'ev-k1-2', '00000000-0000-4000-8000-0000000b1e02', 'f1',
         now() + interval '1 minute', false, pg_temp.dia(21) + interval '11 hours', pg_temp.dia(21) + interval '12 hours', null, null);
  reset role;
  select google_event_id || '/' || (inicio = pg_temp.dia(21) + interval '11 hours')::text into v
    from public.agenda_bloqueos where id = '00000000-0000-4000-8000-0000000b1e02';
  perform pg_temp.esperar('caso 5 por la marca', v, 'ev-k1-2/true');
  -- Un evento de Google que no es de ningún bloqueo (con o sin marca ajena): no crea nada.
  select count(*) into v_ant from public.agenda_bloqueos;
  set local role service_role;
  v_n := public.gcal_bloqueo_aplicar('00000000-0000-4000-8000-0000000b1c01', 'cal-k1', 'ev-de-google', gen_random_uuid(), 'g1',
         now(), false, pg_temp.dia(25) + interval '9 hours', pg_temp.dia(25) + interval '10 hours', null, null);
  reset role;
  select count(*) into v_n from public.agenda_bloqueos;
  perform pg_temp.esperar('caso 5 Google no crea bloqueos', (v_n - v_ant)::text, '0');
  -- Borrado en Google: se quita.
  set local role service_role;
  v_n := public.gcal_bloqueo_aplicar('00000000-0000-4000-8000-0000000b1c01', 'cal-k1', 'ev-k1-1', null, null, now(), true, null, null, null, null);
  reset role;
  perform pg_temp.esperar('caso 5 borrado', v_n::text || '/' || (select count(*) from public.agenda_bloqueos
          where id = '00000000-0000-4000-8000-0000000b1e01')::text, '1/0');
  select string_agg(accion, ',' order by accion) into v from public.audit_log
   where tabla = 'agenda_bloqueos' and registro_id = '00000000-0000-4000-8000-0000000b1e01';
  perform pg_temp.esperar('caso 5 auditoría del sondeo', v, 'DELETE,INSERT,UPDATE,UPDATE');
end $$;

rollback;
