-- Agenda tanda L (L1, punto 6 de Angel) — el bloqueo de horario es TOTAL en la base
-- (20261124120000_agenda_l1_bloqueo_total.sql, disparador trg_appointments_horario_bloqueado):
--   1. con la v2 encendida, ninguna fila de appointments ENTRA en un bloqueo de su médico: ni
--      una cita ni un evento sin paciente, de horas o de todo el día; 42501 con el HINT
--      agenda_horario_bloqueado y el mensaje literal de Angel;
--   2. MOVER (inicio, fin o médico) a un bloqueo, tampoco; tocar el extremo no es entrar;
--   3. lo que YA estaba dentro se queda (K punto 5): cambiar estado, notas o consultorio pasa;
--      moverlo dentro del mismo bloqueo, no;
--   4. el bloqueo de OTRO médico no cuenta, y con la v2 apagada nada cambia;
--   5. service_role: sin via, se rechaza (cita_reagendar_clinica); con spinus.via = 'google'
--      entra como hoy; el alta con reserva_canal (reservar_por_enlace) también; y
--      reservar_por_enlace sigue diciendo 'ocupado' sin lanzar;
--   6. postgres queda fuera.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1 (v2): e1 médico administrador, e2 médico invitado, e3 secretaria. c3 (v2 APAGADA): e5.
insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-0000000e1c01', 'L1 uno', true),
  ('00000000-0000-4000-8000-0000000e1c03', 'L1 tres', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000e1b01'::uuid, 'l1-e1@prueba.local'),
               ('00000000-0000-4000-8000-0000000e1b02'::uuid, 'l1-e2@prueba.local'),
               ('00000000-0000-4000-8000-0000000e1b03'::uuid, 'l1-e3@prueba.local'),
               ('00000000-0000-4000-8000-0000000e1b05'::uuid, 'l1-e5@prueba.local')) u(id, email);
update public.profiles p
   set clinica_id = v.clinica, es_admin_de_clinica = v.admin, role = v.rol,
       nombres = 'Médico', apellido_paterno = 'L1', especialidad = 'Ortopedia', cedula_profesional = '1234567'
  from (values ('00000000-0000-4000-8000-0000000e1b01'::uuid, '00000000-0000-4000-8000-0000000e1c01'::uuid, true, 'medico'),
               ('00000000-0000-4000-8000-0000000e1b02'::uuid, '00000000-0000-4000-8000-0000000e1c01'::uuid, false, 'medico'),
               ('00000000-0000-4000-8000-0000000e1b03'::uuid, '00000000-0000-4000-8000-0000000e1c01'::uuid, false, 'secretaria'),
               ('00000000-0000-4000-8000-0000000e1b05'::uuid, '00000000-0000-4000-8000-0000000e1c03'::uuid, true, 'medico')) v(id, clinica, admin, rol)
 where p.id = v.id;
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000000e1c01', true), ('00000000-0000-4000-8000-0000000e1c03', false)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone)
select ('00000000-0000-4000-8000-0000000e1d0' || n)::uuid, c::uuid, m::uuid, 'Consultorio L1', 'L1', 'Calle 1', true, 'America/Mexico_City'
  from (values (1, '00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1b01'),
               (2, '00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1b02'),
               (5, '00000000-0000-4000-8000-0000000e1c03', '00000000-0000-4000-8000-0000000e1b05')) v(n, c, m);
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo) values
  ('00000000-0000-4000-8000-0000000e1a01', '00000000-0000-4000-8000-0000000e1c01', null, 'Consulta', 30, true);
insert into public.pacientes (id, clinica_id, nombre, apellidos)
values ('00000000-0000-4000-8000-0000000e1e01', '00000000-0000-4000-8000-0000000e1c01', 'Paciente', 'L1');

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'L1 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
-- Medianoche (Ciudad de México) del día de dentro de p_dias días.
create function pg_temp.dia(p_dias integer) returns timestamptz language sql as $$
  select (date_trunc('day', now() at time zone 'America/Mexico_City') + make_interval(days => p_dias)) at time zone 'America/Mexico_City';
$$;
-- Ejecuta p_sql como p_rol ('authenticated' con la sesión de p_quien, o 'service_role', con p_via
-- en spinus.via). 'ok', o 'SQLSTATE:HINT' con el que la base se negó.
create function pg_temp.como(p_rol text, p_quien uuid, p_sql text, p_via text default '') returns text language plpgsql as $$
declare v_hint text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_quien, 'role', p_rol)::text, true);
  perform set_config('spinus.via', p_via, true);
  execute format('set local role %I', p_rol);
  execute p_sql;
  reset role;
  perform set_config('spinus.via', '', true);
  return 'ok';
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  reset role;
  perform set_config('spinus.via', '', true);
  return sqlstate || ':' || coalesce(nullif(v_hint, ''), '-');
end $$;
-- El mensaje con el que la base se niega a p_sql como la sesión de p_quien.
create function pg_temp.mensaje(p_quien uuid, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_quien, 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute p_sql;
  reset role;
  return 'ok';
exception when others then
  v := sqlerrm;
  reset role;
  return v;
end $$;
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text), pg_temp.dia(integer) to anon, authenticated, service_role;

-- El bloqueo de e1: el día 6, de 10:00 a 12:00. El de e2: el día 6 de 15:00 a 16:00. En c3 (apagada): e5, día 6 de 10 a 12.
-- (Como postgres: el alta de bloqueos no es lo que se prueba aquí; K1 la prueba.)
insert into public.agenda_bloqueos (clinica_id, medico_id, inicio, fin, todo_el_dia, zona, motivo) values
  ('00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1b01', pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '12 hours', false, 'America/Mexico_City', 'Quirófano'),
  ('00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1b02', pg_temp.dia(6) + interval '15 hours', pg_temp.dia(6) + interval '16 hours', false, 'America/Mexico_City', null),
  ('00000000-0000-4000-8000-0000000e1c03', '00000000-0000-4000-8000-0000000e1b05', pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '12 hours', false, 'America/Mexico_City', null);

-- El alta de una fila de e1 como la sesión de p_quien, de p_ini a p_fin (cita si p_con_paciente).
create function pg_temp.alta(p_quien uuid, p_medico uuid, p_ini timestamptz, p_fin timestamptz, p_con_paciente boolean default true,
                             p_clinica uuid default '00000000-0000-4000-8000-0000000e1c01', p_consultorio uuid default '00000000-0000-4000-8000-0000000e1d01',
                             p_todo boolean default false) returns text language sql as $$
  select pg_temp.como('authenticated', p_quien, format(
    'insert into public.appointments (clinica_id, medico_id, paciente_id, title, start_time, end_time, status, all_day, consultorio_id, consultorio_nombre, consultorio_timezone)
     values (%L, %L, %L, %L, %L, %L, ''scheduled'', %L, %L, ''Consultorio L1'', ''America/Mexico_City'')',
    p_clinica, p_medico, case when p_con_paciente then '00000000-0000-4000-8000-0000000e1e01' end,
    case when p_con_paciente then 'Paciente L1' else 'Junta' end, p_ini, p_fin, p_todo, p_consultorio));
$$;

-- ── Caso 1: entrar en un bloqueo, no ──────────────────────────────────
do $$
declare
  e1 constant uuid := '00000000-0000-4000-8000-0000000e1b01';
  e2 constant uuid := '00000000-0000-4000-8000-0000000e1b02';
  e3 constant uuid := '00000000-0000-4000-8000-0000000e1b03';
  d6 constant timestamptz := pg_temp.dia(6);
  v_msg text;
begin
  perform pg_temp.esperar('caso 1 cita dentro', pg_temp.alta(e1, e1, d6 + interval '10 hours 30 minutes', d6 + interval '11 hours'), '42501:agenda_horario_bloqueado');
  perform pg_temp.esperar('caso 1 evento sin paciente dentro', pg_temp.alta(e1, e1, d6 + interval '11 hours', d6 + interval '13 hours', false), '42501:agenda_horario_bloqueado');
  perform pg_temp.esperar('caso 1 que lo envuelve', pg_temp.alta(e1, e1, d6 + interval '9 hours', d6 + interval '13 hours'), '42501:agenda_horario_bloqueado');
  perform pg_temp.esperar('caso 1 todo el día sobre el bloqueo', pg_temp.alta(e1, e1, d6, d6 + interval '1 day', false,
          '00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1d01', true), '42501:agenda_horario_bloqueado');
  perform pg_temp.esperar('caso 1 la secretaria', pg_temp.alta(e3, e1, d6 + interval '10 hours', d6 + interval '10 hours 30 minutes'), '42501:agenda_horario_bloqueado');
  perform pg_temp.esperar('caso 1 el invitado en el suyo', pg_temp.alta(e2, e2, d6 + interval '15 hours', d6 + interval '15 hours 30 minutes', true,
          '00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1d02'), '42501:agenda_horario_bloqueado');
  -- tocar el extremo no es entrar (semiabierto, como la reserva)
  perform pg_temp.esperar('caso 1 justo antes', pg_temp.alta(e1, e1, d6 + interval '9 hours', d6 + interval '10 hours'), 'ok');
  perform pg_temp.esperar('caso 1 justo después', pg_temp.alta(e1, e1, d6 + interval '12 hours', d6 + interval '13 hours'), 'ok');
  -- el mensaje literal
  v_msg := pg_temp.mensaje(e1, format('insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status) values (%L, %L, ''x'', %L, %L, ''scheduled'')',
           '00000000-0000-4000-8000-0000000e1c01', e1, d6 + interval '10 hours', d6 + interval '11 hours'));
  perform pg_temp.esperar('caso 1 mensaje literal', v_msg, 'Este horario está bloqueado. Quita el bloqueo para agendar aquí.');
end $$;

-- ── Caso 2: moverse a un bloqueo, no ──────────────────────────────────
-- Dos filas de e1 fuera del bloqueo (se crean como postgres para no depender del caso 1).
insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time, status, consultorio_id, consultorio_timezone, consultorio_nombre) values
  ('00000000-0000-4000-8000-0000000e1f01', '00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1b01', '00000000-0000-4000-8000-0000000e1e01',
   'Paciente L1', pg_temp.dia(6) + interval '13 hours', pg_temp.dia(6) + interval '14 hours', 'scheduled', '00000000-0000-4000-8000-0000000e1d01', 'America/Mexico_City', 'Consultorio L1'),
  ('00000000-0000-4000-8000-0000000e1f02', '00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1b02', null,
   'Comida', pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '11 hours', 'scheduled', '00000000-0000-4000-8000-0000000e1d02', 'America/Mexico_City', 'Consultorio L1');
do $$
declare
  e1 constant uuid := '00000000-0000-4000-8000-0000000e1b01';
  e3 constant uuid := '00000000-0000-4000-8000-0000000e1b03';
begin
  perform pg_temp.esperar('caso 2 arrastrar el inicio y el fin', pg_temp.como('authenticated', e1, format(
    'update public.appointments set start_time = %L, end_time = %L where id = ''00000000-0000-4000-8000-0000000e1f01''',
    pg_temp.dia(6) + interval '11 hours', pg_temp.dia(6) + interval '12 hours')), '42501:agenda_horario_bloqueado');
  perform pg_temp.esperar('caso 2 estirar el inicio hacia atrás', pg_temp.como('authenticated', e1, format(
    'update public.appointments set start_time = %L where id = ''00000000-0000-4000-8000-0000000e1f01''', pg_temp.dia(6) + interval '11 hours 30 minutes')),
    '42501:agenda_horario_bloqueado');
  -- el evento de e2 de 10 a 11 pasa al médico e1, que tiene bloqueado de 10 a 12
  perform pg_temp.esperar('caso 2 cambiar de médico', pg_temp.como('authenticated', e3,
    'update public.appointments set medico_id = ''00000000-0000-4000-8000-0000000e1b01'' where id = ''00000000-0000-4000-8000-0000000e1f02'''),
    '42501:agenda_horario_bloqueado');
  perform pg_temp.esperar('caso 2 moverla fuera sigue pasando', pg_temp.como('authenticated', e1, format(
    'update public.appointments set start_time = %L, end_time = %L where id = ''00000000-0000-4000-8000-0000000e1f01''',
    pg_temp.dia(6) + interval '12 hours', pg_temp.dia(6) + interval '13 hours')), 'ok');
end $$;

-- ── Caso 3: lo que ya estaba dentro se queda ───────────────────────────
insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time, status, consultorio_id, consultorio_timezone, consultorio_nombre) values
  ('00000000-0000-4000-8000-0000000e1f03', '00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1b01', '00000000-0000-4000-8000-0000000e1e01',
   'Paciente L1', pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '11 hours', 'scheduled', '00000000-0000-4000-8000-0000000e1d01', 'America/Mexico_City', 'Consultorio L1');
do $$
declare e1 constant uuid := '00000000-0000-4000-8000-0000000e1b01';
begin
  perform pg_temp.esperar('caso 3 confirmar', pg_temp.como('authenticated', e1,
    'update public.appointments set status = ''confirmed'' where id = ''00000000-0000-4000-8000-0000000e1f03'''), 'ok');
  perform pg_temp.esperar('caso 3 notas', pg_temp.como('authenticated', e1,
    'update public.appointments set notes = ''llega tarde'' where id = ''00000000-0000-4000-8000-0000000e1f03'''), 'ok');
  perform pg_temp.esperar('caso 3 reescribir las mismas puntas', pg_temp.como('authenticated', e1, format(
    'update public.appointments set start_time = %L, end_time = %L where id = ''00000000-0000-4000-8000-0000000e1f03''',
    pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '11 hours')), 'ok');
  perform pg_temp.esperar('caso 3 cancelar', pg_temp.como('authenticated', e1,
    'update public.appointments set status = ''cancelled'' where id = ''00000000-0000-4000-8000-0000000e1f03'''), 'ok');
  perform pg_temp.esperar('caso 3 moverla dentro del mismo bloqueo, no', pg_temp.como('authenticated', e1, format(
    'update public.appointments set start_time = %L, end_time = %L where id = ''00000000-0000-4000-8000-0000000e1f03''',
    pg_temp.dia(6) + interval '10 hours 30 minutes', pg_temp.dia(6) + interval '11 hours 30 minutes')), '42501:agenda_horario_bloqueado');
end $$;

-- ── Caso 4: otro médico y la v2 apagada ────────────────────────────────
do $$
declare
  e2 constant uuid := '00000000-0000-4000-8000-0000000e1b02';
  e5 constant uuid := '00000000-0000-4000-8000-0000000e1b05';
begin
  -- el bloqueo de e1 (10-12) no cierra el horario de e2 (lo agenda el administrador, que ve los dos)
  perform pg_temp.esperar('caso 4 otro médico', pg_temp.alta('00000000-0000-4000-8000-0000000e1b01', e2, pg_temp.dia(6) + interval '10 hours 30 minutes', pg_temp.dia(6) + interval '11 hours', true,
          '00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1d02'), 'ok');
  perform pg_temp.esperar('caso 4 v2 apagada', pg_temp.alta(e5, e5, pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '11 hours', false,
          '00000000-0000-4000-8000-0000000e1c03', '00000000-0000-4000-8000-0000000e1d05'), 'ok');
end $$;

-- ── Caso 5: el cliente de servicio ─────────────────────────────────────
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-l1', pg_temp.h('aviso-l1'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en) values
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1b01', 'unico', pg_temp.h('l1-unico-1'), 7, now() + interval '7 days'),
  ('00000000-0000-4000-8000-0000000e1a09', '00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1b01', 'unico', pg_temp.h('l1-unico-9'), 7, now() + interval '7 days'),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1b01', 'unico', pg_temp.h('l1-unico-2'), 7, now() + interval '7 days');
do $$
declare
  e1 constant uuid := '00000000-0000-4000-8000-0000000e1b01';
  v text;
begin
  -- sin via (cita_reagendar_clinica escribe así): se rechaza
  perform pg_temp.esperar('caso 5 service_role sin via, mover', pg_temp.como('service_role', null, format(
    'update public.appointments set start_time = %L, end_time = %L where id = ''00000000-0000-4000-8000-0000000e1f01''',
    pg_temp.dia(6) + interval '11 hours', pg_temp.dia(6) + interval '12 hours')), '42501:agenda_horario_bloqueado');
  perform pg_temp.esperar('caso 5 service_role sin via, alta', pg_temp.como('service_role', null, format(
    'insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status) values (%L, %L, ''Junta'', %L, %L, ''scheduled'')',
    '00000000-0000-4000-8000-0000000e1c01', e1, pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '11 hours')), '42501:agenda_horario_bloqueado');
  -- lo de Google entra como hoy
  perform pg_temp.esperar('caso 5 Google mueve', pg_temp.como('service_role', null, format(
    'update public.appointments set start_time = %L, end_time = %L where id = ''00000000-0000-4000-8000-0000000e1f01''',
    pg_temp.dia(6) + interval '11 hours', pg_temp.dia(6) + interval '12 hours'), 'google'), 'ok');
  perform pg_temp.esperar('caso 5 Google importa', pg_temp.como('service_role', null, format(
    'insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status, origen) values (%L, %L, ''De Google'', %L, %L, ''scheduled'', ''google'')',
    '00000000-0000-4000-8000-0000000e1c01', e1, pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '11 hours'), 'google'), 'ok');
  -- un via que no es google no abre nada
  perform pg_temp.esperar('caso 5 otro via', pg_temp.como('service_role', null, format(
    'insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status) values (%L, %L, ''Junta'', %L, %L, ''scheduled'')',
    '00000000-0000-4000-8000-0000000e1c01', e1, pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '11 hours'), 'enlace_paciente'), '42501:agenda_horario_bloqueado');
  -- y la sesión no se lo puede poner: el via sólo vale con service_role
  perform pg_temp.esperar('caso 5 la sesión con via google', pg_temp.como('authenticated', e1, format(
    'update public.appointments set start_time = %L, end_time = %L where id = ''00000000-0000-4000-8000-0000000e1f01''',
    pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '11 hours'), 'google'), '42501:agenda_horario_bloqueado');
  -- la reserva por enlace: 'ocupado' (la suya), sin lanzar; fuera del bloqueo, 'ok'
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_resultado into v from public.reservar_por_enlace('00000000-0000-4000-8000-0000000e1c01', pg_temp.h('l1-unico-1'),
    '00000000-0000-4000-8000-0000000e1d01', '00000000-0000-4000-8000-0000000e1a01', pg_temp.dia(6) + interval '10 hours', 'Persona L1',
    '5550000001', null, pg_temp.h('t:1'), null, null, 'v1-prueba-l1', pg_temp.h('aviso-l1'), gen_random_uuid());
  reset role;
  perform pg_temp.esperar('caso 5 reserva dentro', v, 'ocupado');
  set local role service_role;
  select r_resultado into v from public.reservar_por_enlace('00000000-0000-4000-8000-0000000e1c01', pg_temp.h('l1-unico-2'),
    '00000000-0000-4000-8000-0000000e1d01', '00000000-0000-4000-8000-0000000e1a01', pg_temp.dia(6) + interval '16 hours', 'Persona L1',
    '5550000002', null, pg_temp.h('t:2'), null, null, 'v1-prueba-l1', pg_temp.h('aviso-l1'), gen_random_uuid());
  reset role;
  perform pg_temp.esperar('caso 5 reserva fuera', v, 'ok');
  -- el alta con reserva_canal de service_role no la mira el disparador (la reserva ya lo hizo)
  perform pg_temp.esperar('caso 5 alta con reserva_canal', pg_temp.como('service_role', null, format(
    'insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status, reserva_canal, reserva_enlace_id, reserva_nombre,
       reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
     values (%L, %L, ''Reserva'', %L, %L, ''scheduled'', ''unico'', ''00000000-0000-4000-8000-0000000e1a09'', ''Persona L1'', %L, %L, ''v1-prueba-l1'', now(), 0)',
    '00000000-0000-4000-8000-0000000e1c01', e1, pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '11 hours', pg_temp.h('t'), pg_temp.h('c'))), 'ok');
end $$;

-- ── Caso 6: postgres queda fuera ───────────────────────────────────────
insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status)
values ('00000000-0000-4000-8000-0000000e1c01', '00000000-0000-4000-8000-0000000e1b01', 'Como postgres',
        pg_temp.dia(6) + interval '10 hours', pg_temp.dia(6) + interval '11 hours', 'scheduled');

rollback;
