-- Agenda E9 — RSVP de Google como segunda vía de confirmación
-- (20261115160000_agenda_e9_rsvp_google.sql). Se corre con
-- scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1: VIP, encendida, conexión activa con cal-e9-1. c2: VIP, encendida, cal-e9-2.
-- c3: VIP, APAGADA, cal-e9-3.
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-000000e9c001', 'E9 uno', true, 'free'),
  ('00000000-0000-4000-8000-000000e9c002', 'E9 dos', true, 'free'),
  ('00000000-0000-4000-8000-000000e9c003', 'E9 apagada', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000e9b001'::uuid, 'e9-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000e9b002'::uuid, 'e9-b2@prueba.local'),
               ('00000000-0000-4000-8000-000000e9b003'::uuid, 'e9-b3@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e9c001', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-000000e9b001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e9c002', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-000000e9b002';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e9c003', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-000000e9b003';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000e9c001', true), ('00000000-0000-4000-8000-000000e9c002', true),
  ('00000000-0000-4000-8000-000000e9c003', false);
insert into public.clinica_conexiones_google (clinica_id, user_id, rol, calendar_id, estado) values
  ('00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9b001', 'clinica', 'cal-e9-1', 'activa'),
  ('00000000-0000-4000-8000-000000e9c002', '00000000-0000-4000-8000-000000e9b002', 'clinica', 'cal-e9-2', 'activa'),
  ('00000000-0000-4000-8000-000000e9c003', '00000000-0000-4000-8000-000000e9b003', 'clinica', 'cal-e9-3', 'activa');
insert into public.pacientes (id, clinica_id, nombre, apellidos, email) values
  ('00000000-0000-4000-8000-000000e9f001', '00000000-0000-4000-8000-000000e9c001', 'Paciente', 'Uno', 'Paciente.Uno@Prueba.Local '),
  ('00000000-0000-4000-8000-000000e9f003', '00000000-0000-4000-8000-000000e9c003', 'Paciente', 'Tres', 'tres@prueba.local');

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'E9 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-e9', pg_temp.h('aviso-e9'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-000000e9e001', '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9b001', 'fijo', pg_temp.h('e9-f1'));

-- a01 agendada +2 d con evento ev-1 · a02 confirmada · a03 cancelada · a04 pasada · a05 sin evento
-- a06 evento sin paciente · a07 POR LIGAR con reserva_correo · a08 calendario de otra conexión
-- a30 clínica apagada
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 google_event_id, gcal_calendar_id) values
  ('00000000-0000-4000-8000-000000e9a001', '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9f001', '00000000-0000-4000-8000-000000e9b001',
   'Cita 1', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', 'ev-e9-1', 'cal-e9-1'),
  ('00000000-0000-4000-8000-000000e9a002', '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9f001', '00000000-0000-4000-8000-000000e9b001',
   'Cita 2', now() + interval '2 days', now() + interval '2 days 30 min', 'confirmed', 'ev-e9-2', 'cal-e9-1'),
  ('00000000-0000-4000-8000-000000e9a003', '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9f001', '00000000-0000-4000-8000-000000e9b001',
   'Cita 3', now() + interval '2 days', now() + interval '2 days 30 min', 'cancelled', 'ev-e9-3', 'cal-e9-1'),
  ('00000000-0000-4000-8000-000000e9a004', '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9f001', '00000000-0000-4000-8000-000000e9b001',
   'Cita 4', now() - interval '2 hours', now() - interval '90 min', 'scheduled', 'ev-e9-4', 'cal-e9-1'),
  ('00000000-0000-4000-8000-000000e9a005', '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9f001', '00000000-0000-4000-8000-000000e9b001',
   'Cita 5', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', null, null),
  ('00000000-0000-4000-8000-000000e9a006', '00000000-0000-4000-8000-000000e9c001', null, '00000000-0000-4000-8000-000000e9b001',
   'Junta', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', 'ev-e9-6', 'cal-e9-1'),
  ('00000000-0000-4000-8000-000000e9a008', '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9f001', '00000000-0000-4000-8000-000000e9b001',
   'Cita 8', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', 'ev-e9-8', 'cal-otro'),
  ('00000000-0000-4000-8000-000000e9a030', '00000000-0000-4000-8000-000000e9c003', '00000000-0000-4000-8000-000000e9f003', '00000000-0000-4000-8000-000000e9b003',
   'Cita 30', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', 'ev-e9-30', 'cal-e9-3');
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 google_event_id, gcal_calendar_id,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo) values
  ('00000000-0000-4000-8000-000000e9a007', '00000000-0000-4000-8000-000000e9c001', null, '00000000-0000-4000-8000-000000e9b001',
   'Persona Reserva', now() + interval '3 days', now() + interval '3 days 30 min', 'scheduled', 'ev-e9-7', 'cal-e9-1',
   '00000000-0000-4000-8000-000000e9e001', 'fijo', 'Persona Reserva', '5500000097', 'reserva.e9@prueba.local',
   pg_temp.h('t:e9'), pg_temp.h('c:e9'), 'v1-prueba-e9', now(), 0);

create function pg_temp.rsvp(p_clinica uuid, p_cita uuid, p_cal text, p_ev text, p_correos text[]) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  v := public.cita_rsvp_google(p_clinica, p_cita, p_cal, p_ev, p_correos);
  reset role;
  perform set_config('spinus.via', '', true);
  return v;
end $$;
create function pg_temp.estado(p_id uuid) returns text language sql as $$
  select status from public.appointments where id = p_id;
$$;

-- ── Caso 1: el correo del paciente (otra caja, con espacios) confirma; audita via google_rsvp ──
do $$
declare v_antes timestamptz := (select updated_at from public.appointments where id = '00000000-0000-4000-8000-000000e9a001');
begin
  perform pg_temp.esperar('caso 1 médico no confirma', pg_temp.rsvp('00000000-0000-4000-8000-000000e9c001',
    '00000000-0000-4000-8000-000000e9a001', 'cal-e9-1', 'ev-e9-1', array['e9-b1@prueba.local']), 'sin_cambio');
  perform pg_temp.esperar('caso 1 paciente', pg_temp.rsvp('00000000-0000-4000-8000-000000e9c001',
    '00000000-0000-4000-8000-000000e9a001', 'cal-e9-1', 'ev-e9-1', array['e9-b1@prueba.local', ' paciente.uno@prueba.local']), 'confirmada');
  perform pg_temp.esperar('caso 1 estado', pg_temp.estado('00000000-0000-4000-8000-000000e9a001'), 'confirmed');
  perform pg_temp.esperar('caso 1 updated_at avanza', ((select updated_at from public.appointments
    where id = '00000000-0000-4000-8000-000000e9a001') > v_antes)::text, 'true');
  perform pg_temp.esperar('caso 1 auditoría', (select user_id || '/' || accion || '/' || (descripcion::jsonb ->> 'via')
      from public.audit_log where tabla = 'appointments' and registro_id = '00000000-0000-4000-8000-000000e9a001'
       and accion = 'cita_editada' order by created_at desc limit 1), 'system/cita_editada/google_rsvp');
  -- Repetirlo no hace nada (ya confirmada).
  perform pg_temp.esperar('caso 1 repetido', pg_temp.rsvp('00000000-0000-4000-8000-000000e9c001',
    '00000000-0000-4000-8000-000000e9a001', 'cal-e9-1', 'ev-e9-1', array['paciente.uno@prueba.local']), 'sin_cambio');
end $$;

-- ── Caso 2: la reserva por ligar confirma con reserva_correo ──
select pg_temp.esperar('caso 2 por ligar', pg_temp.rsvp('00000000-0000-4000-8000-000000e9c001',
  '00000000-0000-4000-8000-000000e9a007', 'cal-e9-1', 'ev-e9-7', array['RESERVA.E9@prueba.local']), 'confirmada');

-- ── Caso 3: lo que NO cambia ──
do $$
declare v_caso record;
begin
  for v_caso in select * from (values
      ('confirmada',      '00000000-0000-4000-8000-000000e9c001'::uuid, '00000000-0000-4000-8000-000000e9a002'::uuid, 'cal-e9-1', 'ev-e9-2', 'confirmed'),
      ('cancelada',       '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9a003', 'cal-e9-1', 'ev-e9-3', 'cancelled'),
      ('pasada',          '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9a004', 'cal-e9-1', 'ev-e9-4', 'scheduled'),
      ('sin evento',      '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9a005', 'cal-e9-1', 'ev-e9-5', 'scheduled'),
      ('sin paciente',    '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9a006', 'cal-e9-1', 'ev-e9-6', 'scheduled'),
      ('otro calendario', '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9a008', 'cal-e9-1', 'ev-e9-8', 'scheduled'),
      ('otro evento',     '00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9a008', 'cal-otro', 'ev-e9-1', 'scheduled'),
      ('cal sin conexión','00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9a008', 'cal-otro', 'ev-e9-8', 'scheduled'),
      ('otra clínica',    '00000000-0000-4000-8000-000000e9c002', '00000000-0000-4000-8000-000000e9a008', 'cal-e9-2', 'ev-e9-8', 'scheduled'),
      ('apagada',         '00000000-0000-4000-8000-000000e9c003', '00000000-0000-4000-8000-000000e9a030', 'cal-e9-3', 'ev-e9-30', 'scheduled')
    ) t(caso, clinica, cita, cal, ev, estado) loop
    perform pg_temp.esperar('caso 3 ' || v_caso.caso, pg_temp.rsvp(v_caso.clinica, v_caso.cita, v_caso.cal, v_caso.ev,
      array['paciente.uno@prueba.local', 'tres@prueba.local', 'reserva.e9@prueba.local']), 'sin_cambio');
    perform pg_temp.esperar('caso 3 ' || v_caso.caso || ' estado', pg_temp.estado(v_caso.cita), v_caso.estado);
  end loop;
  -- Lista vacía: sin cambio, sin error.
  perform pg_temp.esperar('caso 3 vacía', pg_temp.rsvp('00000000-0000-4000-8000-000000e9c001',
    '00000000-0000-4000-8000-000000e9a008', 'cal-otro', 'ev-e9-8', array[]::text[]), 'sin_cambio');
end $$;

-- ── Caso 4: argumentos imposibles → 22023 ──
do $$
begin
  begin
    perform pg_temp.rsvp('00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9a001', 'cal-e9-1', 'ev-e9-1',
                         array(select 'x' || g || '@prueba.local' from generate_series(1, 51) g));
    raise exception 'E9 caso 4: 51 correos no lanzó';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform pg_temp.rsvp('00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9a001', 'cal-e9-1', 'ev-e9-1', array[null]::text[]);
    raise exception 'E9 caso 4: correo NULL no lanzó';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform pg_temp.rsvp('00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9a001', 'cal-e9-1', null, array['a@b.c']);
    raise exception 'E9 caso 4: evento NULL no lanzó';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- ── Caso 5: anon y authenticated no la ejecutan ──
do $$
declare v_rol text;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000e9b001', 'role', v_rol)::text, true);
      execute format('set local role %I', v_rol);
      perform public.cita_rsvp_google('00000000-0000-4000-8000-000000e9c001', '00000000-0000-4000-8000-000000e9a001',
                                      'cal-e9-1', 'ev-e9-1', array['a@b.c']);
      raise exception 'E9 caso 5: % la ejecutó', v_rol;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
end $$;

rollback;
