-- Agenda tanda I, punto 9 — el candado sobre lo que el paciente ELIGIÓ al
-- reservar por enlace (20261121121000_agenda_i2_candado_eleccion.sql):
--   · el médico no cambia nunca; consultorio, día y hora sólo con
--     `cita_reagendar_clinica` («Reagendar»); la duración es libre;
--   · también tras ligarla a un paciente; no en una cita pasada, ni con la v2
--     apagada, ni en una cita que no vino de un enlace;
--   · vale para authenticated y service_role (Google), no para postgres;
--   · la GUC sola no abre: hace falta service_role Y el id de ESA cita.
-- Mutaciones comprobadas en rojo (tanda I, notas_i2.md):
--   · sin la migración → «caso 1» (el UPDATE de la hora pasa);
--   · quitar `current_user = 'service_role' AND` → «caso 1»;
--   · quitar el coalesce de la GUC → «caso 1 service_role sin la GUC puesta
--     nunca» (lo encontró esta misma prueba: sin él, Google movía la cita);
--   · bloquear también el fin → «caso 2»; quitar «cita pasada» → «caso 4»;
--   · quitar la regla del actor de cita_reagendar_clinica → «caso 9».
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- ── Datos: c1 encendida con b1 (médico admin), b2 (médico sin admin), s1 (secretaria);
--    c2 encendida con b9. Consultorios: k1 y k2 de b1, k3 de b2, k4 de b1 inactivo ──
insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-00000a19c001', 'i2 candado', true),
  ('00000000-0000-4000-8000-00000a19c002', 'i2 otra', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-00000a19b001'::uuid, 'i2c-b1@prueba.local'),
               ('00000000-0000-4000-8000-00000a19b002'::uuid, 'i2c-b2@prueba.local'),
               ('00000000-0000-4000-8000-00000a19b003'::uuid, 'i2c-s1@prueba.local'),
               ('00000000-0000-4000-8000-00000a19b009'::uuid, 'i2c-b9@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-00000a19c001', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-00000a19b001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-00000a19c001', es_admin_de_clinica = false where id = '00000000-0000-4000-8000-00000a19b002';
update public.profiles set clinica_id = '00000000-0000-4000-8000-00000a19c001', role = 'secretaria', es_admin_de_clinica = false where id = '00000000-0000-4000-8000-00000a19b003';
update public.profiles set clinica_id = '00000000-0000-4000-8000-00000a19c002', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-00000a19b009';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-00000a19c001', true), ('00000000-0000-4000-8000-00000a19c002', true);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone) values
  ('00000000-0000-4000-8000-00000a19d001', '00000000-0000-4000-8000-00000a19c001', '00000000-0000-4000-8000-00000a19b001', 'Uno', 'U', 'Calle 1', true, 'America/Mexico_City'),
  ('00000000-0000-4000-8000-00000a19d002', '00000000-0000-4000-8000-00000a19c001', '00000000-0000-4000-8000-00000a19b001', 'Dos', 'D', 'Calle 2', true, 'America/Mexico_City'),
  ('00000000-0000-4000-8000-00000a19d003', '00000000-0000-4000-8000-00000a19c001', '00000000-0000-4000-8000-00000a19b002', 'Tres', 'T', 'Calle 3', true, 'America/Mexico_City'),
  ('00000000-0000-4000-8000-00000a19d004', '00000000-0000-4000-8000-00000a19c001', '00000000-0000-4000-8000-00000a19b001', 'Cerrado', 'C', 'Calle 4', false, 'America/Mexico_City');

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-i2c', repeat('d', 64), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-00000a19f001', '00000000-0000-4000-8000-00000a19c001', '00000000-0000-4000-8000-00000a19b001', 'fijo', repeat('c', 64));

create function pg_temp.t(p_horas integer) returns timestamptz language sql as $$
  select date_trunc('hour', now()) + interval '2 days' + make_interval(hours => p_horas);
$$;
-- Una cita (como postgres) de b1 en k1. p_canal NULL = no vino de un enlace.
create function pg_temp.cita(p_inicio timestamptz, p_canal text default 'fijo') returns uuid language sql as $$
  insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, consultorio_id, consultorio_nombre,
    consultorio_timezone, reserva_canal, reserva_enlace_id, reserva_nombre, reserva_telefono, reserva_correo, reserva_tel_hmac, reserva_correo_hmac,
    reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
  values ('00000000-0000-4000-8000-00000a19c001', '00000000-0000-4000-8000-00000a19b001', 'Persona', p_inicio, p_inicio + interval '30 min',
          '00000000-0000-4000-8000-00000a19d001', 'Uno', 'America/Mexico_City', p_canal,
          case when p_canal is null then null else '00000000-0000-4000-8000-00000a19f001'::uuid end,
          case when p_canal is null then null else 'Persona' end, case when p_canal is null then null else '5544440001' end,
          null, case when p_canal is null then null else repeat('a', 64) end, case when p_canal is null then null else repeat('b', 64) end,
          case when p_canal is null then null else 'v1-prueba-i2c' end, case when p_canal is null then null else now() end,
          case when p_canal is null then null else 0 end)
  returning id;
$$;
-- Un UPDATE como `p_rol` (sesión de `p_sub` si es authenticated). Devuelve 'ok' o el SQLSTATE y el mensaje.
create function pg_temp.upd(p_rol text, p_sub uuid, p_sql text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_rol)::text, true);
  execute format('set local role %I', p_rol);
  execute p_sql;
  reset role;
  return 'ok';
exception when others then
  reset role;
  return sqlstate || ' ' || sqlerrm;
end $$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'i2 candado %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
create function pg_temp.empieza(p_caso text, p_obtenido text, p_prefijo text) returns void language plpgsql as $$
begin
  if p_obtenido is null or left(p_obtenido, length(p_prefijo)) <> p_prefijo then
    raise exception 'i2 candado %: dio %, esperaba que empezara por %', p_caso, p_obtenido, p_prefijo;
  end if;
end $$;
-- «Reagendar» como el servidor (service_role).
create function pg_temp.rea(p_clinica uuid, p_actor uuid, p_cita uuid, p_con uuid, p_inicio timestamptz, p_esperado timestamptz default null)
returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_resultado into v from public.cita_reagendar_clinica(p_clinica, p_actor, p_cita, p_con, p_inicio, p_inicio + interval '30 min', p_esperado);
  reset role;
  return v;
end $$;
grant execute on function pg_temp.t(integer), pg_temp.esperar(text, text, text), pg_temp.empieza(text, text, text) to anon, authenticated, service_role;

create temp table cx (k text primary key, id uuid);
grant select on cx to anon, authenticated, service_role;
insert into cx values ('a', pg_temp.cita(pg_temp.t(10))), ('libre', pg_temp.cita(pg_temp.t(12), null)),
                      ('pasada', pg_temp.cita(now() - interval '2 hours')), ('r', pg_temp.cita(pg_temp.t(14)));
create function pg_temp.id(p_k text) returns uuid language sql as $$ select id from cx where k = p_k $$;
grant execute on function pg_temp.id(text) to anon, authenticated, service_role;

-- ── Caso 1: la sesión (médico b1) no mueve el inicio, el consultorio ni todo el día; el
--    médico, con su propio mensaje ──
do $$
declare b1 constant uuid := '00000000-0000-4000-8000-00000a19b001';
begin
  -- PRIMERO, antes de que nadie ponga la GUC en esta sesión (vale NULL, no ''): Google
  -- (service_role) no mueve la cita. Si se mueve este caso de sitio, deja de probar eso.
  perform pg_temp.empieza('caso 1 service_role sin la GUC puesta nunca', pg_temp.upd('service_role', null, format(
    'update public.appointments set start_time = start_time + interval ''1 hour'', end_time = end_time + interval ''1 hour'' where id = %L', pg_temp.id('a'))),
    '42501 El consultorio, el día y la hora');
  perform pg_temp.empieza('caso 1 hora', pg_temp.upd('authenticated', b1, format(
    'update public.appointments set start_time = start_time + interval ''1 hour'', end_time = end_time + interval ''1 hour'' where id = %L', pg_temp.id('a'))),
    '42501 El consultorio, el día y la hora');
  perform pg_temp.empieza('caso 1 consultorio', pg_temp.upd('authenticated', b1, format(
    'update public.appointments set consultorio_id = %L where id = %L', '00000000-0000-4000-8000-00000a19d002', pg_temp.id('a'))),
    '42501 El consultorio, el día y la hora');
  perform pg_temp.empieza('caso 1 médico', pg_temp.upd('authenticated', b1, format(
    'update public.appointments set medico_id = %L where id = %L', '00000000-0000-4000-8000-00000a19b002', pg_temp.id('a'))),
    '42501 El médico de una cita reservada por enlace no se cambia');
end $$;

-- ── Caso 2: la duración es libre (el fin), y lo que no toca esas columnas, también ──
do $$
declare b1 constant uuid := '00000000-0000-4000-8000-00000a19b001';
begin
  perform pg_temp.esperar('caso 2 fin', pg_temp.upd('authenticated', b1, format(
    'update public.appointments set end_time = start_time + interval ''45 min'' where id = %L', pg_temp.id('a'))), 'ok');
  perform pg_temp.esperar('caso 2 notas', pg_temp.upd('authenticated', b1, format(
    'update public.appointments set notes = ''llega tarde'' where id = %L', pg_temp.id('a'))), 'ok');
  perform pg_temp.esperar('caso 2 mismo valor', pg_temp.upd('authenticated', b1, format(
    'update public.appointments set start_time = start_time, consultorio_id = consultorio_id where id = %L', pg_temp.id('a'))), 'ok');
end $$;

-- ── Caso 3: ligada a un paciente, sigue el candado ──
insert into public.pacientes (id, clinica_id, medico_id, nombre, apellidos)
values ('00000000-0000-4000-8000-00000a19e001', '00000000-0000-4000-8000-00000a19c001', '00000000-0000-4000-8000-00000a19b001', 'Pac', 'Prueba');
update public.appointments set paciente_id = '00000000-0000-4000-8000-00000a19e001' where id = pg_temp.id('a');
do $$
begin
  perform pg_temp.empieza('caso 3 ligada', pg_temp.upd('authenticated', '00000000-0000-4000-8000-00000a19b001', format(
    'update public.appointments set start_time = start_time + interval ''1 day'', end_time = end_time + interval ''1 day'' where id = %L', pg_temp.id('a'))),
    '42501');
end $$;

-- ── Caso 4: no aplica a una cita pasada, a una que no vino de un enlace, ni con la v2 apagada ──
do $$
declare b1 constant uuid := '00000000-0000-4000-8000-00000a19b001';
begin
  perform pg_temp.esperar('caso 4 pasada', pg_temp.upd('authenticated', b1, format(
    'update public.appointments set start_time = start_time - interval ''1 hour'', end_time = end_time - interval ''1 hour'' where id = %L', pg_temp.id('pasada'))), 'ok');
  perform pg_temp.esperar('caso 4 sin enlace', pg_temp.upd('authenticated', b1, format(
    'update public.appointments set start_time = start_time + interval ''1 hour'', end_time = end_time + interval ''1 hour'' where id = %L', pg_temp.id('libre'))), 'ok');
  update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = '00000000-0000-4000-8000-00000a19c001';
  perform pg_temp.esperar('caso 4 v2 apagada', pg_temp.upd('authenticated', b1, format(
    'update public.appointments set start_time = start_time + interval ''1 hour'', end_time = end_time + interval ''1 hour'' where id = %L', pg_temp.id('r'))), 'ok');
  update public.agenda_ajustes set agenda_v2_encendida = true where clinica_id = '00000000-0000-4000-8000-00000a19c001';
end $$;

-- ── Caso 5: la GUC sola no abre (authenticated); service_role sin ella o con OTRO id,
--    tampoco (así Google rechaza y restablece); service_role con el id de ESA cita, sí;
--    postgres, siempre ──
do $$
declare b1 constant uuid := '00000000-0000-4000-8000-00000a19b001';
begin
  perform set_config('spinus.reagendar_cita', pg_temp.id('a')::text, true);
  perform pg_temp.empieza('caso 5 authenticated con la GUC', pg_temp.upd('authenticated', b1, format(
    'update public.appointments set start_time = start_time + interval ''1 hour'', end_time = end_time + interval ''1 hour'' where id = %L', pg_temp.id('a'))), '42501');
  perform set_config('spinus.reagendar_cita', '', true);
  perform pg_temp.empieza('caso 5 service_role sin GUC', pg_temp.upd('service_role', null, format(
    'update public.appointments set start_time = start_time + interval ''1 hour'', end_time = end_time + interval ''1 hour'' where id = %L', pg_temp.id('a'))), '42501');
  perform set_config('spinus.reagendar_cita', pg_temp.id('r')::text, true);
  perform pg_temp.empieza('caso 5 service_role con otro id', pg_temp.upd('service_role', null, format(
    'update public.appointments set start_time = start_time + interval ''1 hour'', end_time = end_time + interval ''1 hour'' where id = %L', pg_temp.id('a'))), '42501');
  perform set_config('spinus.reagendar_cita', pg_temp.id('a')::text, true);
  perform pg_temp.empieza('caso 5 service_role con la GUC, el médico', pg_temp.upd('service_role', null, format(
    'update public.appointments set medico_id = %L where id = %L', '00000000-0000-4000-8000-00000a19b002', pg_temp.id('a'))), '42501 El médico');
  perform pg_temp.esperar('caso 5 service_role con la GUC', pg_temp.upd('service_role', null, format(
    'update public.appointments set start_time = start_time + interval ''1 hour'', end_time = end_time + interval ''1 hour'' where id = %L', pg_temp.id('a'))), 'ok');
  perform set_config('spinus.reagendar_cita', '', true);
  update public.appointments set start_time = start_time - interval '1 hour', end_time = end_time - interval '1 hour' where id = pg_temp.id('a');
end $$;

-- ── Caso 6: «Reagendar» mueve consultorio, día y hora, con la instantánea del consultorio,
--    deja el médico, audita a nombre del actor y vacía la GUC ──
-- now() es el de la transacción: la versión que «vio la pantalla», un minuto antes.
update public.appointments set updated_at = now() - interval '1 minute' where id = pg_temp.id('a');
do $$
declare
  b1 constant uuid := '00000000-0000-4000-8000-00000a19b001';
  v_u timestamptz := (select updated_at from public.appointments where id = pg_temp.id('a'));
  f record;
begin
  perform pg_temp.esperar('caso 6 ok', pg_temp.rea('00000000-0000-4000-8000-00000a19c001', b1, pg_temp.id('a'),
          '00000000-0000-4000-8000-00000a19d002', pg_temp.t(30), v_u), 'ok');
  select medico_id, consultorio_id, consultorio_nombre, start_time, end_time into f from public.appointments where id = pg_temp.id('a');
  perform pg_temp.esperar('caso 6 fila', f.medico_id::text || '/' || f.consultorio_nombre || '/' || (f.start_time = pg_temp.t(30))::text
          || '/' || (f.end_time - f.start_time)::text, b1::text || '/Dos/true/00:30:00');
  perform pg_temp.esperar('caso 6 auditoría', (select user_id || ' ' || (descripcion::jsonb -> 'campos')::text from public.audit_log
          where accion = 'cita_reagendada_clinica' and registro_id = pg_temp.id('a')),
          b1::text || ' ["consultorio_id", "start_time", "end_time"]');
  perform pg_temp.esperar('caso 6 GUC vacía', coalesce(current_setting('spinus.reagendar_cita', true), ''), '');
  perform pg_temp.esperar('caso 6 sin cambio', pg_temp.rea('00000000-0000-4000-8000-00000a19c001', b1, pg_temp.id('a'),
          '00000000-0000-4000-8000-00000a19d002', pg_temp.t(30)), 'sin_cambio');
  perform pg_temp.esperar('caso 6 versión vieja', pg_temp.rea('00000000-0000-4000-8000-00000a19c001', b1, pg_temp.id('a'),
          '00000000-0000-4000-8000-00000a19d001', pg_temp.t(32), v_u), 'modificada');
end $$;

-- ── Caso 7: lo que no se reagenda ──
do $$
declare b1 constant uuid := '00000000-0000-4000-8000-00000a19b001'; c1 constant uuid := '00000000-0000-4000-8000-00000a19c001';
begin
  perform pg_temp.esperar('caso 7 consultorio de otro médico', pg_temp.rea(c1, b1, pg_temp.id('r'), '00000000-0000-4000-8000-00000a19d003', pg_temp.t(40)), 'consultorio_invalido');
  perform pg_temp.esperar('caso 7 consultorio inactivo', pg_temp.rea(c1, b1, pg_temp.id('r'), '00000000-0000-4000-8000-00000a19d004', pg_temp.t(40)), 'consultorio_invalido');
  perform pg_temp.esperar('caso 7 hora pasada', pg_temp.rea(c1, b1, pg_temp.id('r'), '00000000-0000-4000-8000-00000a19d001', now() - interval '1 hour'), 'hora_pasada');
  perform pg_temp.esperar('caso 7 cita pasada', pg_temp.rea(c1, b1, pg_temp.id('pasada'), '00000000-0000-4000-8000-00000a19d001', pg_temp.t(40)), 'pasada');
  perform pg_temp.esperar('caso 7 sin enlace', pg_temp.rea(c1, b1, pg_temp.id('libre'), '00000000-0000-4000-8000-00000a19d001', pg_temp.t(40)), 'no_aplica');
  update public.appointments set status = 'cancelled' where id = pg_temp.id('r');
  perform pg_temp.esperar('caso 7 cancelada', pg_temp.rea(c1, b1, pg_temp.id('r'), '00000000-0000-4000-8000-00000a19d001', pg_temp.t(40)), 'estado_no_admite');
  update public.appointments set status = 'scheduled' where id = pg_temp.id('r');
  update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = c1;
  perform pg_temp.esperar('caso 7 apagada', pg_temp.rea(c1, b1, pg_temp.id('r'), '00000000-0000-4000-8000-00000a19d001', pg_temp.t(40)), 'apagado');
  update public.agenda_ajustes set agenda_v2_encendida = true where clinica_id = c1;
end $$;

-- ── Caso 8: la secretaria reagenda; el actor siempre de la clínica de la cita ──
do $$
declare c1 constant uuid := '00000000-0000-4000-8000-00000a19c001';
begin
  perform pg_temp.esperar('caso 8 secretaria', pg_temp.rea(c1, '00000000-0000-4000-8000-00000a19b003', pg_temp.id('r'),
          '00000000-0000-4000-8000-00000a19d002', pg_temp.t(42)), 'ok');
  perform pg_temp.esperar('caso 8 otra clínica, su actor', pg_temp.rea('00000000-0000-4000-8000-00000a19c002', '00000000-0000-4000-8000-00000a19b009',
          pg_temp.id('r'), '00000000-0000-4000-8000-00000a19d001', pg_temp.t(44)), 'no_aplica');
  perform pg_temp.esperar('caso 8 actor de otra clínica', pg_temp.rea(c1, '00000000-0000-4000-8000-00000a19b009',
          pg_temp.id('r'), '00000000-0000-4000-8000-00000a19d001', pg_temp.t(44)), 'sin_permiso');
end $$;

-- ── Caso 9: un médico SIN admin que no es el de la cita no reagenda (regla de appointments_update) ──
do $$
begin
  perform pg_temp.esperar('caso 9 médico ajeno sin admin', pg_temp.rea('00000000-0000-4000-8000-00000a19c001', '00000000-0000-4000-8000-00000a19b002',
          pg_temp.id('r'), '00000000-0000-4000-8000-00000a19d001', pg_temp.t(46)), 'sin_permiso');
end $$;

-- ── Caso 10: permisos: el disparador lo ejecutan los tres roles; «Reagendar», sólo service_role ──
do $$
declare f constant text := 'public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz)';
begin
  perform pg_temp.esperar('caso 10 reagendar', has_function_privilege('anon', f, 'EXECUTE')::text || ','
    || has_function_privilege('authenticated', f, 'EXECUTE')::text || ',' || has_function_privilege('service_role', f, 'EXECUTE')::text,
    'false,false,true');
  perform pg_temp.esperar('caso 10 disparador', has_function_privilege('authenticated', 'public.cita_proteger_eleccion()', 'EXECUTE')::text
    || ',' || has_function_privilege('service_role', 'public.cita_proteger_eleccion()', 'EXECUTE')::text, 'true,true');
end $$;

rollback;
