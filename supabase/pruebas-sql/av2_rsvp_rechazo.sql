-- Avisos globales · M2 (20261202130000_avisos_globales_rsvp_rechazo.sql) — el «No» del paciente
-- a la invitación de Google. Se corre con scripts/pruebas-sql.sh. Crea sus propios datos (los de
-- e9_rsvp_google.sql, con otros ids) y termina en rollback. Falla si M2 (o M1) no está.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1: VIP, encendida, conexión activa con cal-av2-1. c2: VIP, encendida, cal-av2-2.
-- c3: VIP, APAGADA, cal-av2-3.
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-000000a2c001', 'AV2 uno', true, 'free'),
  ('00000000-0000-4000-8000-000000a2c002', 'AV2 dos', true, 'free'),
  ('00000000-0000-4000-8000-000000a2c003', 'AV2 apagada', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000a2b001'::uuid, 'av2-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000a2b002'::uuid, 'av2-b2@prueba.local'),
               ('00000000-0000-4000-8000-000000a2b003'::uuid, 'av2-b3@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a2c001', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-000000a2b001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a2c002', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-000000a2b002';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000a2c003', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-000000a2b003';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000a2c001', true), ('00000000-0000-4000-8000-000000a2c002', true),
  ('00000000-0000-4000-8000-000000a2c003', false)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;
insert into public.clinica_conexiones_google (clinica_id, user_id, rol, calendar_id, estado) values
  ('00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2b001', 'clinica', 'cal-av2-1', 'activa'),
  ('00000000-0000-4000-8000-000000a2c002', '00000000-0000-4000-8000-000000a2b002', 'clinica', 'cal-av2-2', 'activa'),
  ('00000000-0000-4000-8000-000000a2c003', '00000000-0000-4000-8000-000000a2b003', 'clinica', 'cal-av2-3', 'activa');
insert into public.pacientes (id, clinica_id, nombre, apellidos, email) values
  ('00000000-0000-4000-8000-000000a2f001', '00000000-0000-4000-8000-000000a2c001', 'Paciente', 'Uno', 'Paciente.Uno@Prueba.Local '),
  ('00000000-0000-4000-8000-000000a2f003', '00000000-0000-4000-8000-000000a2c003', 'Paciente', 'Tres', 'tres@prueba.local');

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'AV2 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-av2', pg_temp.h('aviso-av2'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-000000a2e001', '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2b001', 'fijo', pg_temp.h('av2-f1'));

-- a01 agendada +2 d con evento ev-1 · a02 confirmada · a03 cancelada · a04 pasada · a05 sin evento
-- a06 evento sin paciente · a07 POR LIGAR con reserva_correo · a08 calendario de otra conexión
-- a30 clínica apagada
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 google_event_id, gcal_calendar_id) values
  ('00000000-0000-4000-8000-000000a2a001', '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2f001', '00000000-0000-4000-8000-000000a2b001',
   'Cita 1', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', 'ev-av2-1', 'cal-av2-1'),
  ('00000000-0000-4000-8000-000000a2a002', '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2f001', '00000000-0000-4000-8000-000000a2b001',
   'Cita 2', now() + interval '2 days', now() + interval '2 days 30 min', 'confirmed', 'ev-av2-2', 'cal-av2-1'),
  ('00000000-0000-4000-8000-000000a2a003', '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2f001', '00000000-0000-4000-8000-000000a2b001',
   'Cita 3', now() + interval '2 days', now() + interval '2 days 30 min', 'cancelled', 'ev-av2-3', 'cal-av2-1'),
  ('00000000-0000-4000-8000-000000a2a004', '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2f001', '00000000-0000-4000-8000-000000a2b001',
   'Cita 4', now() - interval '2 hours', now() - interval '90 min', 'scheduled', 'ev-av2-4', 'cal-av2-1'),
  ('00000000-0000-4000-8000-000000a2a005', '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2f001', '00000000-0000-4000-8000-000000a2b001',
   'Cita 5', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', null, null),
  ('00000000-0000-4000-8000-000000a2a006', '00000000-0000-4000-8000-000000a2c001', null, '00000000-0000-4000-8000-000000a2b001',
   'Junta', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', 'ev-av2-6', 'cal-av2-1'),
  ('00000000-0000-4000-8000-000000a2a008', '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2f001', '00000000-0000-4000-8000-000000a2b001',
   'Cita 8', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', 'ev-av2-8', 'cal-otro'),
  ('00000000-0000-4000-8000-000000a2a030', '00000000-0000-4000-8000-000000a2c003', '00000000-0000-4000-8000-000000a2f003', '00000000-0000-4000-8000-000000a2b003',
   'Cita 30', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', 'ev-av2-30', 'cal-av2-3');
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 google_event_id, gcal_calendar_id,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo) values
  ('00000000-0000-4000-8000-000000a2a007', '00000000-0000-4000-8000-000000a2c001', null, '00000000-0000-4000-8000-000000a2b001',
   'Persona Reserva', now() + interval '3 days', now() + interval '3 days 30 min', 'scheduled', 'ev-av2-7', 'cal-av2-1',
   '00000000-0000-4000-8000-000000a2e001', 'fijo', 'Persona Reserva', '5500000097', 'reserva.av2@prueba.local',
   pg_temp.h('t:av2'), pg_temp.h('c:av2'), 'v1-prueba-av2', now(), 0);

-- El «No»: la RPC como service_role (lo que hace la pasada de sincronización). Devuelve «resultado|para|nombre».
create function pg_temp.no(p_clinica uuid, p_cita uuid, p_cal text, p_ev text, p_correos text[]) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_resultado || '|' || coalesce(r_para, '-') || '|' || coalesce(r_nombre, '-') into v
    from public.cita_rsvp_google_rechazo(p_clinica, p_cita, p_cal, p_ev, p_correos);
  reset role;
  perform set_config('spinus.via', '', true);
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;
create function pg_temp.estado(p_id uuid) returns text language sql as $$
  select status from public.appointments where id = p_id;
$$;

-- ── Caso 1: el paciente dice «No» → cancelada, aviso a la clínica, auditoría via google_rsvp ──
select pg_temp.esperar('caso 1 el médico no cancela', pg_temp.no('00000000-0000-4000-8000-000000a2c001',
  '00000000-0000-4000-8000-000000a2a001', 'cal-av2-1', 'ev-av2-1', array['av2-b1@prueba.local']), 'sin_cambio|-|-');
select pg_temp.esperar('caso 1 paciente', pg_temp.no('00000000-0000-4000-8000-000000a2c001',
  '00000000-0000-4000-8000-000000a2a001', 'cal-av2-1', 'ev-av2-1', array[' PACIENTE.uno@prueba.local']), 'cancelada|Paciente.Uno@Prueba.Local|Paciente');
select pg_temp.esperar('caso 1 estado', pg_temp.estado('00000000-0000-4000-8000-000000a2a001'), 'cancelled');
select pg_temp.esperar('caso 1 aviso', (select string_agg(tipo || '|' || coalesce(destinatario_id::text, 'todos'), ',') from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000a2a001'), 'cancelacion_paciente|todos');
select pg_temp.esperar('caso 1 auditoría', (select user_id || '/' || accion || '/' || (descripcion::jsonb ->> 'via')
  from public.audit_log where tabla = 'appointments' and registro_id = '00000000-0000-4000-8000-000000a2a001'
    and accion = 'cita_cancelada' limit 1), 'system/cita_cancelada/google_rsvp');
-- Idempotente: la pasada siguiente no hace nada (ni otro aviso).
select pg_temp.esperar('caso 1 repetido', pg_temp.no('00000000-0000-4000-8000-000000a2c001',
  '00000000-0000-4000-8000-000000a2a001', 'cal-av2-1', 'ev-av2-1', array['paciente.uno@prueba.local']), 'sin_cambio|-|-');
select pg_temp.esperar('caso 1 un solo aviso', (select count(*)::text from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-000000a2a001'), '1');

-- ── Caso 2: si después dice «Sí», la cancelada NO se reabre ───────────
do $$
declare v text;
begin
  set local role service_role;
  v := public.cita_rsvp_google('00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2a001', 'cal-av2-1', 'ev-av2-1', array['paciente.uno@prueba.local']);
  reset role;
  perform set_config('spinus.via', '', true);
  perform pg_temp.esperar('caso 2 el sí posterior', v, 'sin_cambio');
  perform pg_temp.esperar('caso 2 sigue cancelada', pg_temp.estado('00000000-0000-4000-8000-000000a2a001'), 'cancelled');
end $$;

-- ── Caso 3: una CONFIRMADA también se cancela con el «No» ─────────────
select pg_temp.esperar('caso 3', pg_temp.no('00000000-0000-4000-8000-000000a2c001',
  '00000000-0000-4000-8000-000000a2a002', 'cal-av2-1', 'ev-av2-2', array['paciente.uno@prueba.local']), 'cancelada|Paciente.Uno@Prueba.Local|Paciente');

-- ── Caso 4: la reserva POR LIGAR: cancela con reserva_correo y CUENTA para el candado ──
select pg_temp.esperar('caso 4 sin incidencia antes', (select count(*)::text from public.reserva_incidencias
  where appointment_id = '00000000-0000-4000-8000-000000a2a007'), '0');
select pg_temp.esperar('caso 4 por ligar', pg_temp.no('00000000-0000-4000-8000-000000a2c001',
  '00000000-0000-4000-8000-000000a2a007', 'cal-av2-1', 'ev-av2-7', array['RESERVA.AV2@prueba.local']), 'cancelada|reserva.av2@prueba.local|Persona Reserva');
select pg_temp.esperar('caso 4 incidencia del candado', (select string_agg(tipo, ',') from public.reserva_incidencias
  where appointment_id = '00000000-0000-4000-8000-000000a2a007' and anulada_en is null), 'cancelacion');
select pg_temp.esperar('caso 4 aviso', (select string_agg(tipo, ',' order by tipo) from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000a2a007' and tipo = 'cancelacion_paciente'), 'cancelacion_paciente');

-- ── Caso 5: lo que NO cambia ──────────────────────────────────────────
do $$
declare v_caso record;
begin
  for v_caso in select * from (values
      ('ya cancelada',    '00000000-0000-4000-8000-000000a2c001'::uuid, '00000000-0000-4000-8000-000000a2a003'::uuid, 'cal-av2-1', 'ev-av2-3', 'cancelled'),
      ('pasada',          '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2a004', 'cal-av2-1', 'ev-av2-4', 'scheduled'),
      ('sin evento',      '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2a005', 'cal-av2-1', 'ev-av2-5', 'scheduled'),
      ('sin paciente',    '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2a006', 'cal-av2-1', 'ev-av2-6', 'scheduled'),
      ('otro calendario', '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2a008', 'cal-av2-1', 'ev-av2-8', 'scheduled'),
      ('otro evento',     '00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2a008', 'cal-otro', 'ev-av2-1', 'scheduled'),
      ('cal sin conexión','00000000-0000-4000-8000-000000a2c001', '00000000-0000-4000-8000-000000a2a008', 'cal-otro', 'ev-av2-8', 'scheduled'),
      ('otra clínica',    '00000000-0000-4000-8000-000000a2c002', '00000000-0000-4000-8000-000000a2a008', 'cal-av2-2', 'ev-av2-8', 'scheduled'),
      ('apagada',         '00000000-0000-4000-8000-000000a2c003', '00000000-0000-4000-8000-000000a2a030', 'cal-av2-3', 'ev-av2-30', 'scheduled')
    ) t(caso, clinica, cita, cal, ev, estado) loop
    perform pg_temp.esperar('caso 5 ' || v_caso.caso, pg_temp.no(v_caso.clinica, v_caso.cita, v_caso.cal, v_caso.ev,
      array['paciente.uno@prueba.local', 'tres@prueba.local', 'reserva.av2@prueba.local']), 'sin_cambio|-|-');
    perform pg_temp.esperar('caso 5 ' || v_caso.caso || ' estado', pg_temp.estado(v_caso.cita), v_caso.estado);
  end loop;
  perform pg_temp.esperar('caso 5 vacía', pg_temp.no('00000000-0000-4000-8000-000000a2c001',
    '00000000-0000-4000-8000-000000a2a008', 'cal-otro', 'ev-av2-8', array[]::text[]), 'sin_cambio|-|-');
end $$;
-- Una atendida y una inasistencia tampoco: con el evento y el correo correctos.
update public.appointments set status = 'no_show' where id = '00000000-0000-4000-8000-000000a2a004';
select pg_temp.esperar('caso 5 inasistencia', pg_temp.no('00000000-0000-4000-8000-000000a2c001',
  '00000000-0000-4000-8000-000000a2a004', 'cal-av2-1', 'ev-av2-4', array['paciente.uno@prueba.local']), 'sin_cambio|-|-');

-- ── Caso 6: a un paciente dado de baja se le cancela, pero no se le escribe ──
update public.appointments set google_event_id = 'ev-av2-5', gcal_calendar_id = 'cal-av2-1' where id = '00000000-0000-4000-8000-000000a2a005';
update public.pacientes set activo = false where id = '00000000-0000-4000-8000-000000a2f001';
select pg_temp.esperar('caso 6', pg_temp.no('00000000-0000-4000-8000-000000a2c001',
  '00000000-0000-4000-8000-000000a2a005', 'cal-av2-1', 'ev-av2-5', array['paciente.uno@prueba.local']), 'cancelada|-|Paciente');

-- ── Caso 8: el «No» en la ÚLTIMA HORA no cancela: avisa «indicó que no asistirá», una vez ──
update public.pacientes set activo = true where id = '00000000-0000-4000-8000-000000a2f001';
update public.appointments set start_time = now() + interval '40 min', end_time = now() + interval '70 min' where id = '00000000-0000-4000-8000-000000a2a008';
update public.appointments set gcal_calendar_id = 'cal-av2-1' where id = '00000000-0000-4000-8000-000000a2a008';
select pg_temp.esperar('caso 8 última hora', pg_temp.no('00000000-0000-4000-8000-000000a2c001',
  '00000000-0000-4000-8000-000000a2a008', 'cal-av2-1', 'ev-av2-8', array['paciente.uno@prueba.local']), 'no_asistira|-|Paciente');
select pg_temp.esperar('caso 8 no se cancela', pg_temp.estado('00000000-0000-4000-8000-000000a2a008'), 'scheduled');
select pg_temp.esperar('caso 8 aviso', (select string_agg(tipo, ',') from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-000000a2a008'), 'paciente_no_asistira');
select pg_temp.esperar('caso 8 no cuenta para el candado ni audita cancelación', (select count(*)::text from public.audit_log
  where tabla = 'appointments' and registro_id = '00000000-0000-4000-8000-000000a2a008' and accion = 'cita_cancelada'), '0');
-- La pasada siguiente no repite el aviso.
select pg_temp.esperar('caso 8 repetido', pg_temp.no('00000000-0000-4000-8000-000000a2c001',
  '00000000-0000-4000-8000-000000a2a008', 'cal-av2-1', 'ev-av2-8', array['paciente.uno@prueba.local']), 'sin_cambio|-|Paciente');
select pg_temp.esperar('caso 8 un solo aviso', (select count(*)::text from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-000000a2a008'), '1');
-- Justo por encima de la hora, sí cancela (el borde es el del enlace: a T-1h exacto ya no).
update public.appointments set start_time = now() + interval '61 min', end_time = now() + interval '91 min', status = 'scheduled',
       google_event_id = 'ev-av2-6b', gcal_calendar_id = 'cal-av2-1', paciente_id = '00000000-0000-4000-8000-000000a2f001'
 where id = '00000000-0000-4000-8000-000000a2a006';
select pg_temp.esperar('caso 8 con 61 minutos', split_part(pg_temp.no('00000000-0000-4000-8000-000000a2c001',
  '00000000-0000-4000-8000-000000a2a006', 'cal-av2-1', 'ev-av2-6b', array['paciente.uno@prueba.local']), '|', 1), 'cancelada');
-- El umbral es el MISMO que el del enlace de confirmación: las dos funciones usan la misma expresión.
select pg_temp.esperar('caso 8 mismo umbral que el enlace', (select string_agg((position('- interval ''1 hour'' <= v_ahora' in prosrc) > 0)::text, ',' order by proname)
  from pg_proc where pronamespace = 'public'::regnamespace and proname in ('cita_confirmacion_responder', 'cita_rsvp_google_rechazo')), 'true,true');

-- ── Caso 7: argumentos imposibles → 22023; y sólo service_role la ejecuta ──
do $$
begin
  set local role service_role;
  perform * from public.cita_rsvp_google_rechazo('00000000-0000-4000-8000-000000a2c001', null, 'cal-av2-1', 'ev', array['a@b.c']);
  reset role;
  raise exception 'AV2 caso 7: aceptó una cita nula';
exception when invalid_parameter_value then reset role;
end $$;
select pg_temp.esperar('caso 7 permisos', (select string_agg(has_function_privilege(r, 'public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])', 'EXECUTE')::text, '/')
  from unnest(array['anon', 'authenticated', 'service_role']) with ordinality as x(r, o)), 'false/false/true');

rollback;
