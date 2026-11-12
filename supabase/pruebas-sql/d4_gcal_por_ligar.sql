-- Agenda D4 — lo que entra de Google trata una cita POR LIGAR como cita con
-- paciente (20261114150000_agenda_d4_gcal_por_ligar.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- Clínica VIP encendida con conexión cal-d4. Médico b1.
--   e1 por ligar (reserva por enlace fijo, sin paciente)
--   e2 ligada (reserva por enlace y ya con paciente)
--   e3 evento sin paciente y sin reserva (lo de C2: el título sí cambia)
insert into public.clinicas (id, nombre, es_vip_grant, stripe_subscription_id, suscripcion_estado) values
  ('00000000-0000-4000-8000-000000d4c001', 'D4 VIP', true, null, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000d4b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'd4-b1@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d4c001', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000d4b001';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-000000d4c001', true);
insert into public.clinica_conexiones_google (clinica_id, user_id, rol, calendar_id, estado) values
  ('00000000-0000-4000-8000-000000d4c001', '00000000-0000-4000-8000-000000d4b001', 'clinica', 'cal-d4', 'activa');
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-000000d4f001', '00000000-0000-4000-8000-000000d4c001', 'Ligado', 'Paciente Real');
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values
  ('v1-prueba-d4', encode(sha256('aviso'::bytea), 'hex'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-000000d4e001', '00000000-0000-4000-8000-000000d4c001', '00000000-0000-4000-8000-000000d4b001',
   'fijo', encode(sha256('f1'::bytea), 'hex'));

insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 google_event_id, gcal_calendar_id, gcal_etag, origen, consultorio_timezone, updated_at,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en,
                                 reserva_historial_previo) values
  ('00000000-0000-4000-8000-000000d4a001', '00000000-0000-4000-8000-000000d4c001', null,
   '00000000-0000-4000-8000-000000d4b001', 'Ana Reserva López', '2031-05-06 10:00-06', '2031-05-06 10:30-06', 'scheduled',
   'ev1', 'cal-d4', '"1"', 'spinus', 'America/Mexico_City', '2031-01-01 00:00Z',
   '00000000-0000-4000-8000-000000d4e001', 'fijo', 'Ana Reserva López', '5512345678', 'ana@prueba.local',
   encode(sha256('t'::bytea), 'hex'), encode(sha256('c'::bytea), 'hex'), 'v1-prueba-d4', now(), 0),
  ('00000000-0000-4000-8000-000000d4a002', '00000000-0000-4000-8000-000000d4c001', '00000000-0000-4000-8000-000000d4f001',
   '00000000-0000-4000-8000-000000d4b001', 'Ligado Paciente Real', '2031-05-07 10:00-06', '2031-05-07 10:30-06', 'scheduled',
   'ev2', 'cal-d4', '"2"', 'spinus', 'America/Mexico_City', '2031-01-01 00:00Z',
   '00000000-0000-4000-8000-000000d4e001', 'fijo', 'Ana Reserva López', '5512345678', 'ana@prueba.local',
   encode(sha256('t'::bytea), 'hex'), encode(sha256('c'::bytea), 'hex'), 'v1-prueba-d4', now(), 0);
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 google_event_id, gcal_calendar_id, gcal_etag, origen, consultorio_timezone, updated_at) values
  ('00000000-0000-4000-8000-000000d4a003', '00000000-0000-4000-8000-000000d4c001', null,
   '00000000-0000-4000-8000-000000d4b001', 'Junta', '2031-05-08 10:00-06', '2031-05-08 11:00-06', 'scheduled',
   'ev3', 'cal-d4', '"3"', 'spinus', 'America/Mexico_City', '2031-01-01 00:00Z');

create function pg_temp.aplicar(p_cita uuid, p_etag text, p_title text default null,
    p_start timestamptz default null, p_end timestamptz default null, p_all_day boolean default null,
    p_esperado timestamptz default '2031-01-01 00:00Z')
returns integer language sql as $$
  select public.gcal_aplicar_evento('00000000-0000-4000-8000-000000d4c001', p_cita, p_esperado, 'cal-d4', p_etag,
                                    '2031-02-01 00:00Z', null, false, p_start, p_end, p_all_day, p_title, false, null, false)
$$;
grant execute on function pg_temp.aplicar(uuid, text, text, timestamptz, timestamptz, boolean, timestamptz) to service_role;

set local role service_role;

-- Caso 1: el espejo — la cita por ligar cuenta como «con paciente», sin título
-- libre y con el nombre de quien reservó; la ligada, con el del paciente; el
-- evento sin paciente, como en C2.
do $$
declare
  v record;
begin
  select * into v from public.gcal_citas_por_evento('00000000-0000-4000-8000-000000d4c001', array['ev1'], null);
  if not (v.r_con_paciente and v.r_titulo_sin_paciente is null
          and v.r_paciente_nombre = 'Ana Reserva López' and v.r_paciente_apellidos = '') then
    raise exception 'D4 caso 1a: por ligar → %', row_to_json(v);
  end if;
  select * into v from public.gcal_citas_por_evento('00000000-0000-4000-8000-000000d4c001', array['ev2'], null);
  if not (v.r_con_paciente and v.r_titulo_sin_paciente is null
          and v.r_paciente_nombre = 'Ligado' and v.r_paciente_apellidos = 'Paciente Real') then
    raise exception 'D4 caso 1b: ligada → %', row_to_json(v);
  end if;
  select * into v from public.gcal_citas_por_evento('00000000-0000-4000-8000-000000d4c001', array['ev3'], null);
  if not (not v.r_con_paciente and v.r_titulo_sin_paciente = 'Junta'
          and v.r_paciente_nombre is null and v.r_paciente_apellidos is null) then
    raise exception 'D4 caso 1c: sin paciente → %', row_to_json(v);
  end if;
end $$;

-- Caso 2: un título que llega de Google sobre la cita por ligar se ignora; la
-- hora sí entra (como en una cita con paciente).
do $$
declare
  v record;
begin
  if pg_temp.aplicar('00000000-0000-4000-8000-000000d4a001', '"1b"', 'Título de Google',
                     '2031-05-06 11:00-06', '2031-05-06 11:30-06') <> 1 then
    raise exception 'D4 caso 2: no prendió';
  end if;
  select title, start_time, gcal_etag into v from public.appointments where id = '00000000-0000-4000-8000-000000d4a001';
  if v.title <> 'Ana Reserva López' or v.start_time <> '2031-05-06 11:00-06' or v.gcal_etag <> '"1b"' then
    raise exception 'D4 caso 2: quedó %', row_to_json(v);
  end if;
end $$;

-- Caso 3: tampoco pasa a todo el día (aunque tenga zona).
do $$
declare
  v record;
begin
  perform pg_temp.aplicar('00000000-0000-4000-8000-000000d4a001', '"1c"', null,
                          '2031-05-06 00:00-06', '2031-05-07 00:00-06', true,
                          (select updated_at from public.appointments where id = '00000000-0000-4000-8000-000000d4a001'));
  select all_day, start_time into v from public.appointments where id = '00000000-0000-4000-8000-000000d4a001';
  if v.all_day or v.start_time <> '2031-05-06 11:00-06' then
    raise exception 'D4 caso 3: quedó %', row_to_json(v);
  end if;
end $$;

-- Caso 4: la cita ya ligada sigue sin aceptar título (C2 sin cambio).
do $$
begin
  perform pg_temp.aplicar('00000000-0000-4000-8000-000000d4a002', '"2b"', 'Otro');
  if (select title from public.appointments where id = '00000000-0000-4000-8000-000000d4a002') <> 'Ligado Paciente Real' then
    raise exception 'D4 caso 4: la ligada cambió de título';
  end if;
end $$;

-- Caso 5: el evento sin paciente y sin reserva sí acepta el título (C2 sin cambio).
-- (Dos sentencias: dentro de una sola, el subselect vería la fila de antes.)
do $$
begin
  if pg_temp.aplicar('00000000-0000-4000-8000-000000d4a003', '"3b"', 'Junta movida') <> 1 then
    raise exception 'D4 caso 5: no prendió';
  end if;
  if (select title from public.appointments where id = '00000000-0000-4000-8000-000000d4a003') <> 'Junta movida' then
    raise exception 'D4 caso 5: el evento sin paciente no tomó el título';
  end if;
end $$;

-- Caso 6: un segundo pase igual no cambia el contenido ni mueve updated_at.
do $$
declare
  v_antes timestamptz := (select updated_at from public.appointments where id = '00000000-0000-4000-8000-000000d4a001');
begin
  perform pg_temp.aplicar('00000000-0000-4000-8000-000000d4a001', '"1d"', 'Título de Google',
                          '2031-05-06 11:00-06', '2031-05-06 11:30-06', null, v_antes);
  if (select updated_at from public.appointments where id = '00000000-0000-4000-8000-000000d4a001') <> v_antes
     or (select title from public.appointments where id = '00000000-0000-4000-8000-000000d4a001') <> 'Ana Reserva López' then
    raise exception 'D4 caso 6: el segundo pase cambió algo';
  end if;
end $$;

-- Caso 6b: la clase del enlace no importa (un único por ligar tampoco acepta título).
reset role;
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en) values
  ('00000000-0000-4000-8000-000000d4e002', '00000000-0000-4000-8000-000000d4c001', '00000000-0000-4000-8000-000000d4b001',
   'unico', encode(sha256('u1'::bytea), 'hex'), 7, now() + interval '7 days');
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 google_event_id, gcal_calendar_id, gcal_etag, origen, consultorio_timezone, updated_at,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en,
                                 reserva_historial_previo) values
  ('00000000-0000-4000-8000-000000d4a004', '00000000-0000-4000-8000-000000d4c001', null,
   '00000000-0000-4000-8000-000000d4b001', 'Beto Único', '2031-05-09 10:00-06', '2031-05-09 10:30-06', 'scheduled',
   'ev4', 'cal-d4', '"4"', 'spinus', 'America/Mexico_City', '2031-01-01 00:00Z',
   '00000000-0000-4000-8000-000000d4e002', 'unico', 'Beto Único', null, null,
   encode(sha256('t2'::bytea), 'hex'), encode(sha256('c2'::bytea), 'hex'), 'v1-prueba-d4', now(), 0);
set local role service_role;
do $$
begin
  perform pg_temp.aplicar('00000000-0000-4000-8000-000000d4a004', '"4b"', 'Otro título');
  if (select title from public.appointments where id = '00000000-0000-4000-8000-000000d4a004') <> 'Beto Único'
     or not (select r_con_paciente from public.gcal_citas_por_evento('00000000-0000-4000-8000-000000d4c001', array['ev4'], null)) then
    raise exception 'D4 caso 6b: el único por ligar aceptó el título o no cuenta como con paciente';
  end if;
end $$;

reset role;

-- Caso 7: permisos — anon y authenticated siguen sin poder llamar (C2).
do $$
declare
  v_rol text;
  v_ok boolean;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    v_ok := false;
    begin
      execute format('set local role %I', v_rol);
      perform * from public.gcal_citas_por_evento('00000000-0000-4000-8000-000000d4c001', array['ev1'], null);
    exception when insufficient_privilege then
      v_ok := true;
    end;
    reset role;
    if not v_ok then raise exception 'D4 caso 7: % ejecutó gcal_citas_por_evento', v_rol; end if;
  end loop;
end $$;

rollback;
