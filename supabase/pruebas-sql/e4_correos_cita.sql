-- Agenda E4 — registro de correos de cita: listado, toma con testigo,
-- reintentos y cierre (20261115140000_agenda_e4_correos_cita.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla. Todo es UNA
-- transacción, así que now() no avanza: los «10 minutos» se simulan
-- moviendo tomado_en hacia atrás.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1: VIP, encendida, N = 24. b1 administrador, b2 médico invitado.
-- c2: free degradada, encendida. c3: VIP con el interruptor APAGADO.
-- c5: VIP, encendida, N = 2.
insert into public.clinicas (id, nombre, es_vip_grant, stripe_subscription_id, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-000000e4c001', 'E4 VIP',       true,  null,       'free',      false),
  ('00000000-0000-4000-8000-000000e4c002', 'E4 degradada', false, 'sub_e4_2', 'cancelado', false),
  ('00000000-0000-4000-8000-000000e4c003', 'E4 apagada',   true,  null,       'free',      false),
  ('00000000-0000-4000-8000-000000e4c005', 'E4 N=2',       true,  null,       'free',      false);
update public.clinicas set ha_tenido_acceso_premium = true where id = '00000000-0000-4000-8000-000000e4c002';
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000e4b001'::uuid, 'e4-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000e4b002'::uuid, 'e4-b2@prueba.local'),
               ('00000000-0000-4000-8000-000000e4b009'::uuid, 'e4-b9@prueba.local'),
               ('00000000-0000-4000-8000-000000e4b008'::uuid, 'e4-b8@prueba.local'),
               ('00000000-0000-4000-8000-000000e4b005'::uuid, 'e4-b5@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e4c001', es_admin_de_clinica = (id::text like '%b001'),
                           titulo = 'Dra.', nombres = 'Ana', apellido_paterno = 'Prueba', apellido_materno = null
 where id in ('00000000-0000-4000-8000-000000e4b001', '00000000-0000-4000-8000-000000e4b002');
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e4c002', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000e4b009';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e4c003', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000e4b008';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e4c005', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000e4b005';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida, recordatorio_horas) values
  ('00000000-0000-4000-8000-000000e4c001', true, 24),
  ('00000000-0000-4000-8000-000000e4c002', true, 24),
  ('00000000-0000-4000-8000-000000e4c003', false, 24),
  ('00000000-0000-4000-8000-000000e4c005', true, 2);
insert into public.pacientes (id, clinica_id, nombre, apellidos, email, activo) values
  ('00000000-0000-4000-8000-000000e4f001', '00000000-0000-4000-8000-000000e4c001', 'Paciente', 'Uno', 'uno@prueba.local', true),
  ('00000000-0000-4000-8000-000000e4f002', '00000000-0000-4000-8000-000000e4c001', 'Paciente', 'Inactivo', 'inactivo@prueba.local', false),
  ('00000000-0000-4000-8000-000000e4f003', '00000000-0000-4000-8000-000000e4c001', 'Paciente', 'Sin correo', '  ', true),
  ('00000000-0000-4000-8000-000000e4f009', '00000000-0000-4000-8000-000000e4c002', 'Paciente', 'Nueve', 'nueve@prueba.local', true),
  ('00000000-0000-4000-8000-000000e4f008', '00000000-0000-4000-8000-000000e4c003', 'Paciente', 'Ocho', 'ocho@prueba.local', true),
  ('00000000-0000-4000-8000-000000e4f005', '00000000-0000-4000-8000-000000e4c005', 'Paciente', 'Cinco', 'cinco@prueba.local', true);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'E4 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

-- La cita por ligar necesita su enlace de reserva y un aviso aprobado (FK de D1).
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values
  ('v1-prueba-e4', pg_temp.h('aviso-e4'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-000000e4e001', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4b001', 'fijo', pg_temp.h('e4-f1'));

-- Citas (horas relativas a now(), el inicio de la transacción):
--   a01 p1 +5 h (con correo) · a02 p1 +23 h · a03 p1 +25 h (fuera de N=24) · a04 p1 +50 min (dentro de 1 h)
--   a05 evento sin paciente +5 h · a06 paciente inactivo +5 h · a07 paciente sin correo +5 h (y sin reserva_correo)
--   a08 cancelada +5 h · a09 todo el día · a10 confirmada +6 h (médico b2) · a11 no_show +5 h · a12 atendida +5 h
--   a13 POR LIGAR +7 h (reserva_correo) · a14 reserva LIGADA a paciente sin correo, con reserva_correo +8 h
--   a20 c2 degradada +5 h · a30 c3 apagada +5 h · a50 c5 +90 min · a51 c5 +3 h
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day,
                                 consultorio_timezone, consultorio_nombre, consultorio_direccion, consultorio_telefono, reserva_correo) values
  ('00000000-0000-4000-8000-000000e4a001', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f001', '00000000-0000-4000-8000-000000e4b001',
   'Cita 1', now() + interval '5 hours', now() + interval '5 hours 30 min', 'scheduled', false, 'America/Mexico_City', 'Consultorio Uno', 'Calle 1', '5555555555', null),
  ('00000000-0000-4000-8000-000000e4a002', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f001', '00000000-0000-4000-8000-000000e4b001',
   'Cita 2', now() + interval '23 hours', now() + interval '23 hours 30 min', 'scheduled', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a003', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f001', '00000000-0000-4000-8000-000000e4b001',
   'Cita 3', now() + interval '25 hours', now() + interval '25 hours 30 min', 'scheduled', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a004', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f001', '00000000-0000-4000-8000-000000e4b001',
   'Cita 4', now() + interval '50 min', now() + interval '80 min', 'scheduled', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a005', '00000000-0000-4000-8000-000000e4c001', null, '00000000-0000-4000-8000-000000e4b001',
   'Junta', now() + interval '5 hours', now() + interval '5 hours 30 min', 'scheduled', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a006', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f002', '00000000-0000-4000-8000-000000e4b001',
   'Cita 6', now() + interval '5 hours', now() + interval '5 hours 30 min', 'scheduled', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a007', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f003', '00000000-0000-4000-8000-000000e4b001',
   'Cita 7', now() + interval '5 hours', now() + interval '5 hours 30 min', 'scheduled', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a008', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f001', '00000000-0000-4000-8000-000000e4b001',
   'Cita 8', now() + interval '5 hours', now() + interval '5 hours 30 min', 'cancelled', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a009', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f001', '00000000-0000-4000-8000-000000e4b001',
   'Cita 9', (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '1 day') at time zone 'America/Mexico_City',
             (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '2 days') at time zone 'America/Mexico_City',
   'scheduled', true, 'America/Mexico_City', null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a010', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f001', '00000000-0000-4000-8000-000000e4b002',
   'Cita 10', now() + interval '6 hours', now() + interval '6 hours 30 min', 'confirmed', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a011', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f001', '00000000-0000-4000-8000-000000e4b001',
   'Cita 11', now() + interval '5 hours', now() + interval '5 hours 30 min', 'no_show', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a012', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f001', '00000000-0000-4000-8000-000000e4b001',
   'Cita 12', now() + interval '5 hours', now() + interval '5 hours 30 min', 'attended', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a020', '00000000-0000-4000-8000-000000e4c002', '00000000-0000-4000-8000-000000e4f009', '00000000-0000-4000-8000-000000e4b009',
   'Cita 20', now() + interval '5 hours', now() + interval '5 hours 30 min', 'scheduled', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a030', '00000000-0000-4000-8000-000000e4c003', '00000000-0000-4000-8000-000000e4f008', '00000000-0000-4000-8000-000000e4b008',
   'Cita 30', now() + interval '5 hours', now() + interval '5 hours 30 min', 'scheduled', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a050', '00000000-0000-4000-8000-000000e4c005', '00000000-0000-4000-8000-000000e4f005', '00000000-0000-4000-8000-000000e4b005',
   'Cita 50', now() + interval '90 min', now() + interval '120 min', 'scheduled', false, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e4a051', '00000000-0000-4000-8000-000000e4c005', '00000000-0000-4000-8000-000000e4f005', '00000000-0000-4000-8000-000000e4b005',
   'Cita 51', now() + interval '3 hours', now() + interval '3 hours 30 min', 'scheduled', false, null, null, null, null, null);
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo) values
  ('00000000-0000-4000-8000-000000e4a013', '00000000-0000-4000-8000-000000e4c001', null, '00000000-0000-4000-8000-000000e4b001',
   'Persona Reserva', now() + interval '7 hours', now() + interval '7 hours 30 min', 'scheduled',
   '00000000-0000-4000-8000-000000e4e001', 'fijo', 'Persona Reserva', '5500000013', 'persona.e4@prueba.local',
   pg_temp.h('t:5500000013'), pg_temp.h('c:persona-e4'), 'v1-prueba-e4', now(), 0),
  -- a14: una reserva ya LIGADA a un paciente sin correo: el respaldo es su reserva_correo.
  ('00000000-0000-4000-8000-000000e4a014', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4f003', '00000000-0000-4000-8000-000000e4b001',
   'Paciente Sin correo', now() + interval '8 hours', now() + interval '8 hours 30 min', 'scheduled',
   '00000000-0000-4000-8000-000000e4e001', 'fijo', 'Persona Respaldo', '5500000014', 'respaldo@prueba.local',
   pg_temp.h('t:5500000014'), pg_temp.h('c:respaldo-e4'), 'v1-prueba-e4', now(), 0);

-- Llamadas como el servidor: service_role, sin sub.
create function pg_temp.servicio() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
$$;
create function pg_temp.listado() returns setof uuid language plpgsql as $$
begin
  perform pg_temp.servicio();
  set local role service_role;
  return query select r_cita_id from public.cita_correos_pendientes(500)
                where r_clinica_id::text like '00000000-0000-4000-8000-000000e4c%';
  reset role;
end $$;
create function pg_temp.listados() returns text language sql as $$
  select coalesce(string_agg(right(x::text, 4), ',' order by x::text), '-') from pg_temp.listado() x;
$$;
create function pg_temp.tomar(p_clinica uuid, p_cita uuid, p_tipo text, p_testigo uuid)
returns table (r_envio_id uuid, r_para text, r_inicio timestamptz, r_fin timestamptz, r_zona text,
               r_estado text, r_medico jsonb, r_consultorio jsonb) language plpgsql as $$
begin
  perform pg_temp.servicio();
  set local role service_role;
  return query select * from public.cita_correo_tomar(p_clinica, p_cita, p_tipo, p_testigo);
  reset role;
end $$;
create function pg_temp.toma(p_clinica uuid, p_cita uuid, p_testigo uuid, p_tipo text default 'recordatorio') returns uuid language sql as $$
  select r_envio_id from pg_temp.tomar(p_clinica, p_cita, p_tipo, p_testigo);
$$;
create function pg_temp.marcar(p_clinica uuid, p_envio uuid, p_testigo uuid, p_estado text, p_motivo text) returns boolean language plpgsql as $$
declare v boolean;
begin
  perform pg_temp.servicio();
  set local role service_role;
  v := public.cita_correo_marcar(p_clinica, p_envio, p_testigo, p_estado, p_motivo);
  reset role;
  return v;
end $$;
create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- ── Caso 1: el listado respeta ventana, destinatario, estado, interruptor y S3 ──
-- c1 (N=24): a01 +5 h, a02 +23 h, a10 confirmada, a13 por ligar, a14 respaldo de reserva_correo.
-- Fuera: a03 (+25 h), a04 (<1 h), a05 sin paciente, a06 inactivo, a07 sin correo, a08 cancelada,
-- a09 todo el día, a11 no_show, a12 atendida, a20 degradada, a30 apagada.
-- c5 (N=2): a50 +90 min sí; a51 +3 h no.
select pg_temp.esperar('caso 1 listado', pg_temp.listados(), 'a001,a002,a010,a013,a014,a050');

-- ── Caso 2: la toma devuelve lo justo, con el destinatario de la misma expresión ──
do $$
declare v record;
begin
  select * into v from pg_temp.tomar('00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a001', 'recordatorio',
                                     '00000000-0000-4000-8000-0000000e4001');
  perform pg_temp.esperar('caso 2 para', v.r_para, 'uno@prueba.local');
  perform pg_temp.esperar('caso 2 estado', v.r_estado, 'scheduled');
  perform pg_temp.esperar('caso 2 zona', v.r_zona, 'America/Mexico_City');
  perform pg_temp.esperar('caso 2 médico', v.r_medico ->> 'nombres', 'Ana');
  perform pg_temp.esperar('caso 2 consultorio', v.r_consultorio ->> 'telefono', '5555555555');
  perform pg_temp.esperar('caso 2 fila', (select estado || '/' || intentos || '/' || testigo::text || '/' || (inicio_cita = (select start_time from public.appointments where id = '00000000-0000-4000-8000-000000e4a001'))::text
                                             from public.cita_correos where id = v.r_envio_id),
                          'enviando/1/00000000-0000-4000-8000-0000000e4001/true');
  -- Por ligar: reserva_correo. Paciente sin correo: reserva_correo de respaldo. Confirmada: r_estado confirmed.
  perform pg_temp.esperar('caso 2 por ligar', (select r_para from pg_temp.tomar('00000000-0000-4000-8000-000000e4c001',
            '00000000-0000-4000-8000-000000e4a013', 'recordatorio', gen_random_uuid())), 'persona.e4@prueba.local');
  perform pg_temp.esperar('caso 2 respaldo', (select r_para from pg_temp.tomar('00000000-0000-4000-8000-000000e4c001',
            '00000000-0000-4000-8000-000000e4a014', 'recordatorio', gen_random_uuid())), 'respaldo@prueba.local');
  perform pg_temp.esperar('caso 2 confirmada', (select r_estado from pg_temp.tomar('00000000-0000-4000-8000-000000e4c001',
            '00000000-0000-4000-8000-000000e4a010', 'recordatorio', gen_random_uuid())), 'confirmed');
end $$;
-- Lo tomado (enviando, vigente) sale del listado.
select pg_temp.esperar('caso 2 listado tras tomar', pg_temp.listados(), 'a002,a050');

-- ── Caso 3: la toma NO prende (sin fila, nada escrito) ───────────────
do $$
declare v_caso record; n0 integer; n1 integer;
begin
  select count(*) into n0 from public.cita_correos;
  for v_caso in select * from (values
      ('fuera de N',        '00000000-0000-4000-8000-000000e4c001'::uuid, '00000000-0000-4000-8000-000000e4a003'::uuid),
      ('menos de 1 h',      '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a004'),
      ('sin paciente',      '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a005'),
      ('inactivo',          '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a006'),
      ('sin correo',        '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a007'),
      ('cancelada',         '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a008'),
      ('todo el día',       '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a009'),
      ('no_show',           '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a011'),
      ('atendida',          '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a012'),
      ('degradada',         '00000000-0000-4000-8000-000000e4c002', '00000000-0000-4000-8000-000000e4a020'),
      ('apagada',           '00000000-0000-4000-8000-000000e4c003', '00000000-0000-4000-8000-000000e4a030'),
      ('N=2 a +3 h',        '00000000-0000-4000-8000-000000e4c005', '00000000-0000-4000-8000-000000e4a051'),
      ('cita de c1 con c5', '00000000-0000-4000-8000-000000e4c005', '00000000-0000-4000-8000-000000e4a002'),
      ('cita de c5 con c1', '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a050'),
      ('ya enviando',       '00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a001')) t(caso, clinica, cita) loop
    perform pg_temp.esperar('caso 3 ' || v_caso.caso,
      coalesce(pg_temp.toma(v_caso.clinica, v_caso.cita, gen_random_uuid())::text, 'NULL'), 'NULL');
  end loop;
  select count(*) into n1 from public.cita_correos;
  perform pg_temp.esperar('caso 3 nada escrito', n1::text, n0::text);
end $$;

-- ── Caso 4: marcar sólo con el testigo de quien tomó, y sólo una vez ──
do $$
declare v_envio uuid := (select id from public.cita_correos where appointment_id = '00000000-0000-4000-8000-000000e4a001');
begin
  perform pg_temp.esperar('caso 4 otro testigo', pg_temp.marcar('00000000-0000-4000-8000-000000e4c001', v_envio,
                          gen_random_uuid(), 'enviado', null)::text, 'false');
  perform pg_temp.esperar('caso 4 otra clínica', pg_temp.marcar('00000000-0000-4000-8000-000000e4c005', v_envio,
                          '00000000-0000-4000-8000-0000000e4001', 'enviado', null)::text, 'false');
  perform pg_temp.esperar('caso 4 el suyo', pg_temp.marcar('00000000-0000-4000-8000-000000e4c001', v_envio,
                          '00000000-0000-4000-8000-0000000e4001', 'enviado', null)::text, 'true');
  perform pg_temp.esperar('caso 4 dos veces', pg_temp.marcar('00000000-0000-4000-8000-000000e4c001', v_envio,
                          '00000000-0000-4000-8000-0000000e4001', 'fallido', 'transporte')::text, 'false');
  perform pg_temp.esperar('caso 4 fila', (select estado || '/' || (enviado_en is not null)::text || '/' || coalesce(motivo, '-')
                                            from public.cita_correos where id = v_envio), 'enviado/true/-');
  -- Enviado: no se vuelve a tomar.
  perform pg_temp.esperar('caso 4 no se repite', coalesce(pg_temp.toma('00000000-0000-4000-8000-000000e4c001',
                          '00000000-0000-4000-8000-000000e4a001', gen_random_uuid())::text, 'NULL'), 'NULL');
  -- Argumentos imposibles: 22023.
  begin
    perform pg_temp.marcar('00000000-0000-4000-8000-000000e4c001', v_envio, gen_random_uuid(), 'enviado', 'transporte');
    raise exception 'E4 caso 4: enviado con motivo no lanzó';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform pg_temp.marcar('00000000-0000-4000-8000-000000e4c001', v_envio, gen_random_uuid(), 'fallido', 'inventado');
    raise exception 'E4 caso 4: motivo inventado no lanzó';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform pg_temp.toma('00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a001', gen_random_uuid(), 'otro');
    raise exception 'E4 caso 4: tipo inventado no lanzó';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- ── Caso 5: «enviando» se suelta a los 10 min; fallido hasta 3 intentos; duplicado no ──
do $$
declare v_envio uuid; v_t uuid := '00000000-0000-4000-8000-0000000e4005';
begin
  v_envio := pg_temp.toma('00000000-0000-4000-8000-000000e4c005', '00000000-0000-4000-8000-000000e4a050', v_t);
  if v_envio is null then raise exception 'E4 caso 5: la primera toma no prendió'; end if;
  -- Vigente: otra ejecución no lo toma.
  perform pg_temp.esperar('caso 5 vigente', coalesce(pg_temp.toma('00000000-0000-4000-8000-000000e4c005',
                          '00000000-0000-4000-8000-000000e4a050', gen_random_uuid())::text, 'NULL'), 'NULL');
  -- A los 9 min sigue vigente; a los 10, se suelta (abajo).
  update public.cita_correos set tomado_en = now() - interval '9 minutes' where id = v_envio;
  perform pg_temp.esperar('caso 5 a los 9 min', (position('a050' in pg_temp.listados()) = 0)::text, 'true');
  update public.cita_correos set tomado_en = now() - interval '10 minutes' where id = v_envio;
end $$;
do $$
declare v_envio uuid := (select id from public.cita_correos where appointment_id = '00000000-0000-4000-8000-000000e4a050');
        v_t2 uuid := '00000000-0000-4000-8000-0000000e4006';
begin
  perform pg_temp.esperar('caso 5 suelto en el listado', (position('a050' in pg_temp.listados()) <> 0)::text, 'true');
  perform pg_temp.esperar('caso 5 retoma', pg_temp.toma('00000000-0000-4000-8000-000000e4c005',
                          '00000000-0000-4000-8000-000000e4a050', v_t2)::text, v_envio::text);
  perform pg_temp.esperar('caso 5 intento 2', (select intentos::text from public.cita_correos where id = v_envio), '2');
  perform pg_temp.esperar('caso 5 testigo viejo', pg_temp.marcar('00000000-0000-4000-8000-000000e4c005', v_envio,
                          '00000000-0000-4000-8000-0000000e4005', 'enviado', null)::text, 'false');
  perform pg_temp.marcar('00000000-0000-4000-8000-000000e4c005', v_envio, v_t2, 'fallido', 'transporte');
  -- Fallido con intentos < 3: vuelve al listado y se toma (intento 3).
  perform pg_temp.esperar('caso 5 fallido listado', (position('a050' in pg_temp.listados()) <> 0)::text, 'true');
  perform pg_temp.esperar('caso 5 intento 3', pg_temp.toma('00000000-0000-4000-8000-000000e4c005',
                          '00000000-0000-4000-8000-000000e4a050', v_t2)::text, v_envio::text);
  perform pg_temp.marcar('00000000-0000-4000-8000-000000e4c005', v_envio, v_t2, 'fallido', 'transporte');
  -- Tres intentos: ni listado ni toma.
  perform pg_temp.esperar('caso 5 agotado listado', (position('a050' in pg_temp.listados()) = 0)::text, 'true');
  perform pg_temp.esperar('caso 5 agotado toma', coalesce(pg_temp.toma('00000000-0000-4000-8000-000000e4c005',
                          '00000000-0000-4000-8000-000000e4a050', gen_random_uuid())::text, 'NULL'), 'NULL');
end $$;
do $$
declare v_envio uuid; v_t uuid := '00000000-0000-4000-8000-0000000e4007';
begin
  -- fallido/duplicado: no se reintenta aunque queden intentos.
  v_envio := pg_temp.toma('00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a002', v_t);
  perform pg_temp.marcar('00000000-0000-4000-8000-000000e4c001', v_envio, v_t, 'fallido', 'duplicado');
  perform pg_temp.esperar('caso 5 duplicado listado', (position('a002' in pg_temp.listados()) = 0)::text, 'true');
  perform pg_temp.esperar('caso 5 duplicado toma', coalesce(pg_temp.toma('00000000-0000-4000-8000-000000e4c001',
                          '00000000-0000-4000-8000-000000e4a002', gen_random_uuid())::text, 'NULL'), 'NULL');
  -- omitido: tampoco.
  v_envio := (select id from public.cita_correos where appointment_id = '00000000-0000-4000-8000-000000e4a013');
  perform pg_temp.marcar('00000000-0000-4000-8000-000000e4c001', v_envio,
                         (select testigo from public.cita_correos where id = v_envio), 'omitido', 'sin_enlace');
  perform pg_temp.esperar('caso 5 omitido toma', coalesce(pg_temp.toma('00000000-0000-4000-8000-000000e4c001',
                          '00000000-0000-4000-8000-000000e4a013', gen_random_uuid())::text, 'NULL'), 'NULL');
end $$;

-- ── Caso 6: mover la cita da un recordatorio nuevo; el comprobante enviado lo evita ──
do $$
declare v_envio uuid; v_t uuid := '00000000-0000-4000-8000-0000000e4008'; n integer;
begin
  -- a01 ya tuvo su recordatorio (caso 4). Se mueve +1 h: llave nueva.
  update public.appointments set start_time = start_time + interval '1 hour', end_time = end_time + interval '1 hour'
   where id = '00000000-0000-4000-8000-000000e4a001';
  perform pg_temp.esperar('caso 6 movida listada', (position('a001' in pg_temp.listados()) <> 0)::text, 'true');
  v_envio := pg_temp.toma('00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a001', v_t);
  if v_envio is null then raise exception 'E4 caso 6: la cita movida no dio recordatorio nuevo'; end if;
  select count(*) into n from public.cita_correos where appointment_id = '00000000-0000-4000-8000-000000e4a001';
  perform pg_temp.esperar('caso 6 dos llaves', n::text, '2');
  -- a14: comprobante ENVIADO para su inicio → ni listado ni toma de recordatorio.
  update public.cita_correos set estado = 'fallido', motivo = 'transporte'
   where appointment_id = '00000000-0000-4000-8000-000000e4a014' and estado = 'enviando';
  v_envio := pg_temp.toma('00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a014', v_t, 'comprobante');
  if v_envio is null then raise exception 'E4 caso 6: el comprobante no prendió'; end if;
  perform pg_temp.marcar('00000000-0000-4000-8000-000000e4c001', v_envio, v_t, 'enviado', null);
  perform pg_temp.esperar('caso 6 con comprobante, listado', (position('a014' in pg_temp.listados()) = 0)::text, 'true');
  perform pg_temp.esperar('caso 6 con comprobante, toma', coalesce(pg_temp.toma('00000000-0000-4000-8000-000000e4c001',
                          '00000000-0000-4000-8000-000000e4a014', gen_random_uuid())::text, 'NULL'), 'NULL');
  -- Hallazgo 1 de la auditoría: un comprobante SALIENDO (enviando < 10 min) también lo impide.
  v_envio := pg_temp.toma('00000000-0000-4000-8000-000000e4c001', '00000000-0000-4000-8000-000000e4a013', v_t, 'comprobante');
  if v_envio is null then raise exception 'E4 caso 6: el comprobante de a13 no prendió'; end if;
  update public.cita_correos set estado = 'fallido', motivo = 'transporte'
   where appointment_id = '00000000-0000-4000-8000-000000e4a013' and tipo = 'recordatorio';
  perform pg_temp.esperar('caso 6 comprobante enviando, listado', (position('a013' in pg_temp.listados()) = 0)::text, 'true');
  perform pg_temp.esperar('caso 6 comprobante enviando, toma', coalesce(pg_temp.toma('00000000-0000-4000-8000-000000e4c001',
                          '00000000-0000-4000-8000-000000e4a013', gen_random_uuid())::text, 'NULL'), 'NULL');
  -- A los 10 min (ejecución muerta), el recordatorio vuelve.
  update public.cita_correos set tomado_en = now() - interval '10 minutes' where id = v_envio;
  perform pg_temp.esperar('caso 6 comprobante muerto, listado', (position('a013' in pg_temp.listados()) <> 0)::text, 'true');
  -- El comprobante no exige la ventana de N horas (a03, +25 h), pero sí destinatario.
  perform pg_temp.esperar('caso 6 comprobante fuera de N', (pg_temp.toma('00000000-0000-4000-8000-000000e4c001',
                          '00000000-0000-4000-8000-000000e4a003', gen_random_uuid(), 'comprobante') is not null)::text, 'true');
  perform pg_temp.esperar('caso 6 comprobante sin destinatario', coalesce(pg_temp.toma('00000000-0000-4000-8000-000000e4c001',
                          '00000000-0000-4000-8000-000000e4a005', gen_random_uuid(), 'comprobante')::text, 'NULL'), 'NULL');
end $$;

-- ── Caso 7: auditoría ────────────────────────────────────────────────
select pg_temp.esperar('caso 7 audit_log de cita_correos',
  ((select count(*) from public.audit_log where tabla = 'cita_correos' and registro_id in (select id from public.cita_correos)) > 0)::text, 'true');

-- ── Caso 8: permisos ─────────────────────────────────────────────────
do $$
declare v_rol text; v_fn text; n integer;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    foreach v_fn in array array[
        'select public.cita_correos_pendientes(10)',
        'select public.cita_correo_tomar(''00000000-0000-4000-8000-000000e4c001'', ''00000000-0000-4000-8000-000000e4a002'', ''recordatorio'', gen_random_uuid())',
        'select public.cita_correo_marcar(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), ''enviado'', null)'] loop
      begin
        perform pg_temp.como('00000000-0000-4000-8000-000000e4b001');
        execute format('set local role %I', v_rol);
        execute v_fn;
        raise exception 'E4 caso 8: % ejecutó %', v_rol, v_fn;
      exception when insufficient_privilege then null;
      end;
      reset role;
    end loop;
  end loop;
  -- authenticated: ni testigo, ni intentos, ni motivo, ni escribir.
  perform pg_temp.como('00000000-0000-4000-8000-000000e4b001');
  foreach v_fn in array array['select testigo from public.cita_correos', 'select intentos from public.cita_correos',
                              'select motivo from public.cita_correos', 'select * from public.cita_correos',
                              'update public.cita_correos set estado = ''enviado''',
                              'insert into public.cita_correos (clinica_id) values (gen_random_uuid())',
                              'delete from public.cita_correos'] loop
    begin
      set local role authenticated;
      execute v_fn;
      raise exception 'E4 caso 8: authenticated pudo %', v_fn;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
  -- El administrador ve los envíos de su clínica; el invitado, sólo los de sus citas; otra clínica, nada.
  set local role authenticated;
  select count(*) into n from public.cita_correos where clinica_id = '00000000-0000-4000-8000-000000e4c001';
  reset role;
  perform pg_temp.esperar('caso 8 administrador', n::text,
    (select count(*)::text from public.cita_correos where clinica_id = '00000000-0000-4000-8000-000000e4c001'));
  if n = 0 then raise exception 'E4 caso 8: el administrador no ve nada'; end if;
  perform pg_temp.como('00000000-0000-4000-8000-000000e4b002');
  set local role authenticated;
  select count(*) into n from public.cita_correos;
  reset role;
  perform pg_temp.esperar('caso 8 invitado, sólo la suya (a10)', n::text, '1');
  perform pg_temp.como('00000000-0000-4000-8000-000000e4b009');
  set local role authenticated;
  select count(*) into n from public.cita_correos where clinica_id = '00000000-0000-4000-8000-000000e4c001';
  reset role;
  perform pg_temp.esperar('caso 8 otra clínica', n::text, '0');
end $$;

rollback;
