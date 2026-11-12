-- Agenda E1 — enlace de confirmación por cita, respuesta del paciente y lista
-- blanca de «via» (20261115120000_agenda_e1_confirmacion_enlace.sql).
-- Secuencial y en una sola transacción: la carrera de dos sesiones va aparte,
-- en scripts/confirmacion-carrera.sh.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1: VIP, encendida. b1 administrador, b2 médico invitado. Pacientes p1, p2.
-- c2: free degradada (tuvo premium y lo perdió), encendida. b9, paciente p9.
-- c3: VIP con el interruptor APAGADO. b8, paciente p8.
-- c4: VIP suspendida, encendida. b7, paciente p7.
insert into public.clinicas (id, nombre, es_vip_grant, stripe_subscription_id, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-000000e1c001', 'E1 VIP',        true,  null,       'free',      false),
  ('00000000-0000-4000-8000-000000e1c002', 'E1 degradada',  false, 'sub_e1_2', 'cancelado', false),
  ('00000000-0000-4000-8000-000000e1c003', 'E1 apagada',    true,  null,       'free',      false),
  ('00000000-0000-4000-8000-000000e1c004', 'E1 suspendida', true,  null,       'free',      true);
update public.clinicas set ha_tenido_acceso_premium = true where id = '00000000-0000-4000-8000-000000e1c002';
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000e1b001'::uuid, 'e1-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000e1b002'::uuid, 'e1-b2@prueba.local'),
               ('00000000-0000-4000-8000-000000e1b009'::uuid, 'e1-b9@prueba.local'),
               ('00000000-0000-4000-8000-000000e1b008'::uuid, 'e1-b8@prueba.local'),
               ('00000000-0000-4000-8000-000000e1b007'::uuid, 'e1-b7@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e1c001', es_admin_de_clinica = (id::text like '%b001'),
                           titulo = 'Dr.', nombres = 'Médico', apellido_paterno = 'Prueba', apellido_materno = 'Uno',
                           especialidad = 'Ortopedia'
 where id in ('00000000-0000-4000-8000-000000e1b001', '00000000-0000-4000-8000-000000e1b002');
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e1c002', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000e1b009';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e1c003', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000e1b008';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e1c004', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000e1b007';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000e1c001', true),
  ('00000000-0000-4000-8000-000000e1c002', true),
  ('00000000-0000-4000-8000-000000e1c003', false),
  ('00000000-0000-4000-8000-000000e1c004', true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-000000e1f001', '00000000-0000-4000-8000-000000e1c001', 'Paciente', 'Uno'),
  ('00000000-0000-4000-8000-000000e1f002', '00000000-0000-4000-8000-000000e1c001', 'Paciente', 'Dos'),
  ('00000000-0000-4000-8000-000000e1f009', '00000000-0000-4000-8000-000000e1c002', 'Paciente', 'Nueve'),
  ('00000000-0000-4000-8000-000000e1f008', '00000000-0000-4000-8000-000000e1c003', 'Paciente', 'Ocho'),
  ('00000000-0000-4000-8000-000000e1f007', '00000000-0000-4000-8000-000000e1c004', 'Paciente', 'Siete');

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'E1 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
-- Sólo para esta prueba (rollback): se llaman ya con el rol cambiado.
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

-- Una cita por ligar necesita su enlace de reserva y un aviso aprobado (FK de D1).
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values
  ('v1-prueba-e1', pg_temp.h('aviso'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-000000e1e001', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1b001', 'fijo', pg_temp.h('f1'));

-- Citas (como postgres). Horas relativas a now() (inicio de la transacción).
--   a01 b1+p1 agendada +2 d (con evento de Google) · a02 b2+p2 agendada +2 d · a03 b1 POR LIGAR +2 d
--   a04 evento sin paciente · a05 cancelada · a06 atendida · a07 pasada · a08 no_show · a09 todo el día con paciente
--   a10 +61 min · a11 +59 min · a12 +1 h +2 s (reloj real)
--   a20 c2 degradada · a30 c3 apagada · a40 c4 suspendida
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day,
                                 consultorio_timezone, consultorio_nombre, consultorio_direccion, consultorio_telefono,
                                 google_event_id, gcal_etag, notes) values
  ('00000000-0000-4000-8000-000000e1a001', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1f001', '00000000-0000-4000-8000-000000e1b001',
   'Cita 1', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', false, 'America/Mexico_City', 'Consultorio Uno', 'Calle 1', '5555555555', 'ev-e1-1', 'etag-e1-1', 'NOTA CLÍNICA SECRETA'),
  ('00000000-0000-4000-8000-000000e1a002', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1f002', '00000000-0000-4000-8000-000000e1b002',
   'Cita 2', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', false, 'America/Mexico_City', 'Consultorio Dos', null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a004', '00000000-0000-4000-8000-000000e1c001', null, '00000000-0000-4000-8000-000000e1b001',
   'Junta', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', false, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a005', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1f001', '00000000-0000-4000-8000-000000e1b001',
   'Cita 5', now() + interval '3 days', now() + interval '3 days 30 min', 'cancelled', false, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a006', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1f001', '00000000-0000-4000-8000-000000e1b001',
   'Cita 6', now() + interval '3 days', now() + interval '3 days 30 min', 'attended', false, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a007', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1f001', '00000000-0000-4000-8000-000000e1b001',
   'Cita 7', now() - interval '1 hour', now() - interval '30 min', 'scheduled', false, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a008', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1f001', '00000000-0000-4000-8000-000000e1b001',
   'Cita 8', now() + interval '3 days', now() + interval '3 days 30 min', 'no_show', false, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a009', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1f001', '00000000-0000-4000-8000-000000e1b001',
   'Cita 9', (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '5 days') at time zone 'America/Mexico_City',
             (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '6 days') at time zone 'America/Mexico_City',
   'scheduled', true, 'America/Mexico_City', null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a010', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1f001', '00000000-0000-4000-8000-000000e1b001',
   'Cita 10', now() + interval '61 min', now() + interval '91 min', 'scheduled', false, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a011', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1f001', '00000000-0000-4000-8000-000000e1b001',
   'Cita 11', now() + interval '59 min', now() + interval '89 min', 'scheduled', false, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a012', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1f001', '00000000-0000-4000-8000-000000e1b001',
   'Cita 12', now() + interval '1 hour 2 seconds', now() + interval '2 hours', 'scheduled', false, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a020', '00000000-0000-4000-8000-000000e1c002', '00000000-0000-4000-8000-000000e1f009', '00000000-0000-4000-8000-000000e1b009',
   'Cita 20', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', false, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a030', '00000000-0000-4000-8000-000000e1c003', '00000000-0000-4000-8000-000000e1f008', '00000000-0000-4000-8000-000000e1b008',
   'Cita 30', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', false, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000e1a040', '00000000-0000-4000-8000-000000e1c004', '00000000-0000-4000-8000-000000e1f007', '00000000-0000-4000-8000-000000e1b007',
   'Cita 40', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', false, null, null, null, null, null, null, null);
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo) values
  ('00000000-0000-4000-8000-000000e1a003', '00000000-0000-4000-8000-000000e1c001', null, '00000000-0000-4000-8000-000000e1b001',
   'Persona Reserva', now() + interval '2 days 2 hours', now() + interval '2 days 150 min', 'scheduled',
   '00000000-0000-4000-8000-000000e1e001', 'fijo', 'Persona Reserva', '5500000003', 'persona@prueba.local',
   pg_temp.h('t:5500000003'), pg_temp.h('c:persona'), 'v1-prueba-e1', now(), 0);

-- Llamadas como el servidor: service_role, sin sub. Al salir se borra spinus.via,
-- como pasaría al terminar la transacción de PostgREST (aquí todo es UNA transacción).
create function pg_temp.emitir(p_clinica uuid, p_cita uuid, p_id uuid, p_creado uuid default null)
returns table (r_id uuid, r_codigo_hash text) language plpgsql as $$
declare v_hash text := pg_temp.h('codigo:' || p_id);
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  return query select * from public.cita_confirmacion_emitir(p_clinica, p_cita, p_id, v_hash, p_creado);
  reset role;
end $$;
create function pg_temp.emitido(p_clinica uuid, p_cita uuid, p_id uuid) returns uuid language sql as $$
  select r_id from pg_temp.emitir(p_clinica, p_cita, p_id);
$$;
create function pg_temp.ctx(p_hash text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  v := public.cita_confirmacion_contexto(p_hash);
  reset role;
  return v;
end $$;
create function pg_temp.resp(p_clinica uuid, p_hash text, p_accion text)
returns table (r_resultado text, r_cita_id uuid, r_google_event_id text, r_gcal_etag text) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  return query select * from public.cita_confirmacion_responder(p_clinica, p_hash, p_accion);
  reset role;
  perform set_config('spinus.via', '', true);
end $$;
create function pg_temp.r(p_clinica uuid, p_hash text, p_accion text) returns text language sql as $$
  select r_resultado from pg_temp.resp(p_clinica, p_hash, p_accion);
$$;
create function pg_temp.revocar(p_clinica uuid, p_cita uuid) returns integer language plpgsql as $$
declare v integer;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  v := public.cita_confirmacion_revocar(p_clinica, p_cita);
  reset role;
  return v;
end $$;
-- Un enlace sembrado a mano (como postgres) sobre una cita que emitir no aceptaría.
create function pg_temp.sembrar(p_id uuid, p_clinica uuid, p_cita uuid, p_paciente uuid) returns text language sql as $$
  insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id)
  values (p_id, p_clinica, p_cita, pg_temp.h('codigo:' || p_id), p_paciente)
  returning codigo_hash;
$$;
create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- ── Caso 0: la puerta S3 de los datos es la esperada ─────────────────
do $$
begin
  perform pg_temp.esperar('caso 0 c1', public.gcal_sync_clinica_habilitada('00000000-0000-4000-8000-000000e1c001')::text, 'true');
  perform pg_temp.esperar('caso 0 c2', public.gcal_sync_clinica_habilitada('00000000-0000-4000-8000-000000e1c002')::text, 'false');
  perform pg_temp.esperar('caso 0 c4', public.gcal_sync_clinica_habilitada('00000000-0000-4000-8000-000000e1c004')::text, 'false');
end $$;

-- ── Caso 1: emitir y volver a emitir devuelve el MISMO enlace, con su hash ──
do $$
declare v record; w record; n integer;
begin
  select * into v from pg_temp.emitir('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a001',
                                      '00000000-0000-4000-8000-0000000e1001', '00000000-0000-4000-8000-000000e1b001');
  perform pg_temp.esperar('caso 1 id', v.r_id::text, '00000000-0000-4000-8000-0000000e1001');
  perform pg_temp.esperar('caso 1 hash', v.r_codigo_hash, pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1001'));
  select * into w from pg_temp.emitir('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a001',
                                      '00000000-0000-4000-8000-0000000e1999');
  perform pg_temp.esperar('caso 1 segunda emisión', w.r_id::text, v.r_id::text);
  perform pg_temp.esperar('caso 1 segunda emisión hash', w.r_codigo_hash, v.r_codigo_hash);
  select count(*) into n from public.cita_confirmaciones where appointment_id = '00000000-0000-4000-8000-000000e1a001';
  perform pg_temp.esperar('caso 1 una fila', n::text, '1');
  perform pg_temp.esperar('caso 1 vínculo y autor',
    (select paciente_id::text || '/' || coalesce(reserva_correo_hmac, '-') || '/' || creado_por::text
       from public.cita_confirmaciones where id = v.r_id),
    '00000000-0000-4000-8000-000000e1f001/-/00000000-0000-4000-8000-000000e1b001');
  -- Un autor de OTRA clínica no se guarda.
  perform pg_temp.emitir('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a002',
                         '00000000-0000-4000-8000-0000000e1002', '00000000-0000-4000-8000-000000e1b009');
  perform pg_temp.esperar('caso 1 autor ajeno', (select coalesce(creado_por::text, 'NULL') from public.cita_confirmaciones
                                                 where id = '00000000-0000-4000-8000-0000000e1002'), 'NULL');
end $$;

-- ── Caso 2: emitir NO aplica (r_id NULL, una fila, nada escrito) ─────
do $$
declare v_caso record; v record; n0 integer; n1 integer;
begin
  select count(*) into n0 from public.cita_confirmaciones;
  for v_caso in select * from (values
      ('apagada',          '00000000-0000-4000-8000-000000e1c003'::uuid, '00000000-0000-4000-8000-000000e1a030'::uuid),
      ('degradada',        '00000000-0000-4000-8000-000000e1c002', '00000000-0000-4000-8000-000000e1a020'),
      ('suspendida',       '00000000-0000-4000-8000-000000e1c004', '00000000-0000-4000-8000-000000e1a040'),
      ('sin paciente',     '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a004'),
      ('cancelada',        '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a005'),
      ('atendida',         '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a006'),
      ('pasada',           '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a007'),
      ('no_show',          '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a008'),
      ('todo el día',      '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a009'),
      ('otra clínica',     '00000000-0000-4000-8000-000000e1c002', '00000000-0000-4000-8000-000000e1a002'),
      ('cita inexistente', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-0000000000ff')) t(caso, clinica, cita) loop
    select count(*) into n1 from pg_temp.emitir(v_caso.clinica, v_caso.cita, gen_random_uuid());
    select * into v from pg_temp.emitir(v_caso.clinica, v_caso.cita, gen_random_uuid());
    perform pg_temp.esperar('caso 2 ' || v_caso.caso || ' filas', n1::text, '1');
    perform pg_temp.esperar('caso 2 ' || v_caso.caso, coalesce(v.r_id::text, 'NULL') || '/' || coalesce(v.r_codigo_hash, 'NULL'), 'NULL/NULL');
  end loop;
  perform pg_temp.esperar('caso 2 nada escrito', (select count(*)::text from public.cita_confirmaciones), n0::text);
  -- Argumentos inválidos: 22023.
  begin
    set local role service_role;
    perform public.cita_confirmacion_emitir('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a001',
                                            gen_random_uuid(), 'no-es-hex', null);
    raise exception 'E1 caso 2: emitir con hash inválido no falló';
  exception when invalid_parameter_value then null;
  end;
  reset role;
end $$;

-- ── Caso 3: el contexto enseña lo mínimo, con la lista blanca exacta ──
do $$
declare v jsonb;
begin
  v := pg_temp.ctx(pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1001'));
  perform pg_temp.esperar('caso 3 claves',
    (select string_agg(k, ',' order by k) from jsonb_object_keys(v) k),
    'clinica_id,consultorio,corte_cancelar,estado,fin,inicio,medico,puede_cancelar,puede_confirmar,respuesta,zona');
  perform pg_temp.esperar('caso 3 médico', (select string_agg(k, ',' order by k) from jsonb_object_keys(v -> 'medico') k),
    'apellido_materno,apellido_paterno,nombres,titulo');
  perform pg_temp.esperar('caso 3 consultorio', v -> 'consultorio' ->> 'nombre' || '/' || (v -> 'consultorio' ->> 'direccion')
                                                 || '/' || (v -> 'consultorio' ->> 'telefono'), 'Consultorio Uno/Calle 1/5555555555');
  perform pg_temp.esperar('caso 3 estado', v ->> 'estado' || '/' || (v ->> 'puede_confirmar') || '/' || (v ->> 'puede_cancelar'),
                          'agendada/true/true');
  perform pg_temp.esperar('caso 3 clínica', v ->> 'clinica_id', '00000000-0000-4000-8000-000000e1c001');
  -- Nada clínico ni de la persona en el JSON (ni título, ni notas, ni paciente, ni especialidad).
  if position('NOTA' in v::text) > 0 or position('Paciente' in v::text) > 0 or position('Ortopedia' in v::text) > 0
     or position('e1a001' in v::text) > 0 or position('e1f001' in v::text) > 0 or position('ev-e1' in v::text) > 0 then
    raise exception 'E1 caso 3: el contexto filtra datos: %', v;
  end if;
  -- Mala forma y hash desconocido: NULL.
  perform pg_temp.esperar('caso 3 mala forma', coalesce(pg_temp.ctx('xyz')::text, 'NULL'), 'NULL');
  perform pg_temp.esperar('caso 3 desconocido', coalesce(pg_temp.ctx(pg_temp.h('nada'))::text, 'NULL'), 'NULL');
end $$;

-- ── Caso 4: estados del contexto (enlaces sembrados a mano en citas que emitir rechaza) ──
do $$
declare v_h text;
begin
  v_h := pg_temp.sembrar('00000000-0000-4000-8000-0000000e1005', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a005', '00000000-0000-4000-8000-000000e1f001');
  perform pg_temp.esperar('caso 4 cancelada', pg_temp.ctx(v_h) ->> 'estado' || '/' || (pg_temp.ctx(v_h) ->> 'puede_cancelar'), 'cancelada/false');
  v_h := pg_temp.sembrar('00000000-0000-4000-8000-0000000e1006', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a006', '00000000-0000-4000-8000-000000e1f001');
  perform pg_temp.esperar('caso 4 atendida', pg_temp.ctx(v_h) ->> 'estado', 'cerrada');
  v_h := pg_temp.sembrar('00000000-0000-4000-8000-0000000e1008', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a008', '00000000-0000-4000-8000-000000e1f001');
  perform pg_temp.esperar('caso 4 no_show', pg_temp.ctx(v_h) ->> 'estado', 'cerrada');
  v_h := pg_temp.sembrar('00000000-0000-4000-8000-0000000e1007', '00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a007', '00000000-0000-4000-8000-000000e1f001');
  perform pg_temp.esperar('caso 4 pasada', pg_temp.ctx(v_h) ->> 'estado' || '/' || (pg_temp.ctx(v_h) ->> 'puede_confirmar'), 'pasada/false');
  -- Interruptor apagado: el enlace existe y el contexto no lo enseña.
  v_h := pg_temp.sembrar('00000000-0000-4000-8000-0000000e1030', '00000000-0000-4000-8000-000000e1c003', '00000000-0000-4000-8000-000000e1a030', '00000000-0000-4000-8000-000000e1f008');
  perform pg_temp.esperar('caso 4 apagada', coalesce(pg_temp.ctx(v_h)::text, 'NULL'), 'NULL');
  perform pg_temp.esperar('caso 4 apagada responder', pg_temp.r('00000000-0000-4000-8000-000000e1c003', v_h, 'confirmar'), 'invalido');
  -- Degradada: emitir no, pero responder sí (lista A, 9).
  v_h := pg_temp.sembrar('00000000-0000-4000-8000-0000000e1020', '00000000-0000-4000-8000-000000e1c002', '00000000-0000-4000-8000-000000e1a020', '00000000-0000-4000-8000-000000e1f009');
  perform pg_temp.esperar('caso 4 degradada responde', pg_temp.r('00000000-0000-4000-8000-000000e1c002', v_h, 'confirmar'), 'confirmada');
  -- Suspendida: tampoco emite, y la respuesta sigue funcionando, como el UPDATE del
  -- personal (appointments_update no mira la suspensión; lista A, 9). Decisión que la
  -- auditoría señaló (hallazgo 1) y se mantuvo: esta prueba la fija.
  v_h := pg_temp.sembrar('00000000-0000-4000-8000-0000000e1040', '00000000-0000-4000-8000-000000e1c004', '00000000-0000-4000-8000-000000e1a040', '00000000-0000-4000-8000-000000e1f007');
  perform pg_temp.esperar('caso 4 suspendida contexto', pg_temp.ctx(v_h) ->> 'estado', 'agendada');
  perform pg_temp.esperar('caso 4 suspendida responde', pg_temp.r('00000000-0000-4000-8000-000000e1c004', v_h, 'cancelar'), 'cancelada');
end $$;

-- ── Caso 5: transiciones de responder ─────────────────────────────────
do $$
declare v_h text := pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1001'); v record;
begin
  -- Otra clínica con un hash válido: invalido, sin tocar la cita.
  perform pg_temp.esperar('caso 5 otra clínica', pg_temp.r('00000000-0000-4000-8000-000000e1c002', v_h, 'confirmar'), 'invalido');
  perform pg_temp.esperar('caso 5 intacta', (select status from public.appointments where id = '00000000-0000-4000-8000-000000e1a001'), 'scheduled');
  select * into v from pg_temp.resp('00000000-0000-4000-8000-000000e1c001', v_h, 'confirmar');
  perform pg_temp.esperar('caso 5 confirmar', v.r_resultado || '/' || v.r_cita_id || '/' || v.r_google_event_id || '/' || v.r_gcal_etag,
                          'confirmada/00000000-0000-4000-8000-000000e1a001/ev-e1-1/etag-e1-1');
  perform pg_temp.esperar('caso 5 confirmada', (select status from public.appointments where id = '00000000-0000-4000-8000-000000e1a001'), 'confirmed');
  perform pg_temp.esperar('caso 5 respuesta', (select respuesta || '/' || (respondido_en is not null)::text from public.cita_confirmaciones
                                               where id = '00000000-0000-4000-8000-0000000e1001'), 'confirmo/true');
  perform pg_temp.esperar('caso 5 contexto confirmada', pg_temp.ctx(v_h) ->> 'estado' || '/' || (pg_temp.ctx(v_h) ->> 'puede_confirmar')
                                                        || '/' || (pg_temp.ctx(v_h) ->> 'respuesta'), 'confirmada/false/confirmo');
  perform pg_temp.esperar('caso 5 ya confirmada', pg_temp.r('00000000-0000-4000-8000-000000e1c001', v_h, 'confirmar'), 'ya_confirmada');
  perform pg_temp.esperar('caso 5 cancelar tras confirmar', pg_temp.r('00000000-0000-4000-8000-000000e1c001', v_h, 'cancelar'), 'cancelada');
  perform pg_temp.esperar('caso 5 cancelada', (select status from public.appointments where id = '00000000-0000-4000-8000-000000e1a001'), 'cancelled');
  perform pg_temp.esperar('caso 5 respuesta final', (select respuesta from public.cita_confirmaciones where id = '00000000-0000-4000-8000-0000000e1001'), 'cancelo');
  perform pg_temp.esperar('caso 5 ya cancelada', pg_temp.r('00000000-0000-4000-8000-000000e1c001', v_h, 'cancelar'), 'ya_cancelada');
  -- Nunca reactiva.
  perform pg_temp.esperar('caso 5 no reactiva', pg_temp.r('00000000-0000-4000-8000-000000e1c001', v_h, 'confirmar'), 'ya_cancelada');
  perform pg_temp.esperar('caso 5 sigue cancelada', (select status from public.appointments where id = '00000000-0000-4000-8000-000000e1a001'), 'cancelled');
  -- Cerradas y pasadas.
  perform pg_temp.esperar('caso 5 atendida', pg_temp.r('00000000-0000-4000-8000-000000e1c001', pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1006'), 'cancelar'), 'cerrada');
  perform pg_temp.esperar('caso 5 no_show', pg_temp.r('00000000-0000-4000-8000-000000e1c001', pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1008'), 'confirmar'), 'cerrada');
  perform pg_temp.esperar('caso 5 pasada', pg_temp.r('00000000-0000-4000-8000-000000e1c001', pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1007'), 'confirmar'), 'pasada');
  perform pg_temp.esperar('caso 5 atendida intacta', (select status from public.appointments where id = '00000000-0000-4000-8000-000000e1a006'), 'attended');
  -- Argumentos inválidos: 22023.
  begin
    perform pg_temp.r('00000000-0000-4000-8000-000000e1c001', v_h, 'borrar');
    raise exception 'E1 caso 5: una acción desconocida no falló';
  exception when invalid_parameter_value then reset role;
  end;
end $$;

-- ── Caso 6: el plazo de 1 h (estricto) y el reloj REAL tras los candados ──
do $$
declare v_h text;
begin
  perform pg_temp.emitido('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a010', '00000000-0000-4000-8000-0000000e1010');
  perform pg_temp.esperar('caso 6 +61 min', pg_temp.r('00000000-0000-4000-8000-000000e1c001', pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1010'), 'cancelar'), 'cancelada');
  perform pg_temp.emitido('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a011', '00000000-0000-4000-8000-0000000e1011');
  v_h := pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1011');
  perform pg_temp.esperar('caso 6 +59 min contexto', pg_temp.ctx(v_h) ->> 'puede_cancelar', 'false');
  perform pg_temp.esperar('caso 6 +59 min cancelar', pg_temp.r('00000000-0000-4000-8000-000000e1c001', v_h, 'cancelar'), 'fuera_de_plazo');
  perform pg_temp.esperar('caso 6 +59 min sigue', (select status from public.appointments where id = '00000000-0000-4000-8000-000000e1a011'), 'scheduled');
  perform pg_temp.esperar('caso 6 +59 min confirmar', pg_temp.r('00000000-0000-4000-8000-000000e1c001', v_h, 'confirmar'), 'confirmada');
  -- a12 empieza a now()+1h+2s (now() = inicio de la transacción). Tras 3 s reales,
  -- clock_timestamp() ya está a menos de 1 h: fuera de plazo. Con now() saldría «cancelada».
  perform pg_temp.emitido('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a012', '00000000-0000-4000-8000-0000000e1012');
  perform pg_sleep(3);
  perform pg_temp.esperar('caso 6 reloj real', pg_temp.r('00000000-0000-4000-8000-000000e1c001', pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1012'), 'cancelar'), 'fuera_de_plazo');
end $$;

-- ── Caso 7: auditoría: "via" sólo sin sesión y sólo de la lista blanca ──
-- (audit_log.id es uuid y created_at es now(): dentro de UNA transacción no hay
-- orden; se cuenta por contenido.)
do $$
declare v_d jsonb;
begin
  perform pg_temp.esperar('caso 7 una cancelación', (select count(*)::text from public.audit_log
    where registro_id = '00000000-0000-4000-8000-000000e1a001' and accion = 'cita_cancelada'), '1');
  select descripcion::jsonb into v_d from public.audit_log
   where registro_id = '00000000-0000-4000-8000-000000e1a001' and accion = 'cita_cancelada';
  perform pg_temp.esperar('caso 7 cancelada via', v_d ->> 'via' || '/' || (v_d -> 'estado' ->> 'de') || '>' || (v_d -> 'estado' ->> 'a'),
                          'enlace_paciente/confirmed>cancelled');
  perform pg_temp.esperar('caso 7 usuario', (select user_id from public.audit_log where registro_id = '00000000-0000-4000-8000-000000e1a001'
                                              and accion = 'cita_cancelada'), 'system');
  perform pg_temp.esperar('caso 7 una confirmación', (select count(*)::text from public.audit_log
    where registro_id = '00000000-0000-4000-8000-000000e1a001' and accion = 'cita_editada'), '1');
  select descripcion::jsonb into v_d from public.audit_log
   where registro_id = '00000000-0000-4000-8000-000000e1a001' and accion = 'cita_editada';
  perform pg_temp.esperar('caso 7 confirmada via', v_d ->> 'via' || '/' || (v_d -> 'campos')::text || '/' || (v_d -> 'estado' ->> 'a'),
                          'enlace_paciente/["status"]/confirmed');
  perform pg_temp.esperar('caso 7 a2 sin ediciones previas', (select count(*)::text from public.audit_log
    where registro_id = '00000000-0000-4000-8000-000000e1a002' and accion = 'cita_editada'), '0');
  -- Con sesión y el GUC puesto: sin "via" (authenticated no finge ser el paciente).
  perform pg_temp.como('00000000-0000-4000-8000-000000e1b001');
  set local role authenticated;
  perform set_config('spinus.via', 'enlace_paciente', true);
  update public.appointments set notes = 'otra' where id = '00000000-0000-4000-8000-000000e1a002';
  reset role;
  -- Sin sesión con un literal FUERA de la lista: tampoco.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  perform set_config('spinus.via', 'paciente_falso', true);
  update public.appointments set notes = 'otra más' where id = '00000000-0000-4000-8000-000000e1a002';
  -- 'google' y 'google_rsvp' sí entran.
  perform set_config('spinus.via', 'google_rsvp', true);
  update public.appointments set notes = 'rsvp' where id = '00000000-0000-4000-8000-000000e1a002';
  perform set_config('spinus.via', 'google', true);
  update public.appointments set notes = 'google' where id = '00000000-0000-4000-8000-000000e1a002';
  reset role;
  perform set_config('spinus.via', '', true);
  perform pg_temp.esperar('caso 7 via de las cuatro ediciones',
    (select string_agg(coalesce(descripcion::jsonb ->> 'via', 'sin via'), ',' order by coalesce(descripcion::jsonb ->> 'via', 'sin via'))
       from public.audit_log where registro_id = '00000000-0000-4000-8000-000000e1a002' and accion = 'cita_editada'),
    'google,google_rsvp,sin via,sin via');
  perform pg_temp.esperar('caso 7 la de sesión, a su nombre',
    (select count(*)::text from public.audit_log where registro_id = '00000000-0000-4000-8000-000000e1a002'
        and accion = 'cita_editada' and user_id = '00000000-0000-4000-8000-000000e1b001'), '1');
  -- cita_confirmaciones lleva log_tabla_change.
  perform pg_temp.esperar('caso 7 tabla nueva auditada',
    (select string_agg(distinct accion, ',' order by accion) from public.audit_log
      where tabla = 'cita_confirmaciones' and registro_id = '00000000-0000-4000-8000-0000000e1001'), 'INSERT,UPDATE');
end $$;

-- ── Caso 8: cambio de paciente revoca; la cita por ligar conserva su enlace al ligarse ──
do $$
declare v record; v_h text;
begin
  perform pg_temp.emitido('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a002', '00000000-0000-4000-8000-0000000e1999');
  v_h := pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1002');
  perform pg_temp.esperar('caso 8 vigente', pg_temp.ctx(v_h) ->> 'estado', 'agendada');
  update public.appointments set paciente_id = '00000000-0000-4000-8000-000000e1f001' where id = '00000000-0000-4000-8000-000000e1a002';
  perform pg_temp.esperar('caso 8 otro paciente: contexto', coalesce(pg_temp.ctx(v_h)::text, 'NULL'), 'NULL');
  perform pg_temp.esperar('caso 8 otro paciente: responder', pg_temp.r('00000000-0000-4000-8000-000000e1c001', v_h, 'cancelar'), 'invalido');
  perform pg_temp.esperar('caso 8 otro paciente: intacta', (select status from public.appointments where id = '00000000-0000-4000-8000-000000e1a002'), 'scheduled');
  select * into v from pg_temp.emitir('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a002', '00000000-0000-4000-8000-0000000e1022');
  perform pg_temp.esperar('caso 8 enlace nuevo', v.r_id::text, '00000000-0000-4000-8000-0000000e1022');
  perform pg_temp.esperar('caso 8 viejo revocado', (select (revocado_en is not null)::text from public.cita_confirmaciones
                                                    where id = '00000000-0000-4000-8000-0000000e1002'), 'true');
  -- Por ligar: atado al seudónimo del correo; al ligarla a un paciente, sigue valiendo.
  select * into v from pg_temp.emitir('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a003', '00000000-0000-4000-8000-0000000e1003');
  perform pg_temp.esperar('caso 8 por ligar vínculo', (select coalesce(paciente_id::text, 'NULL') || '/' || reserva_correo_hmac
                                                       from public.cita_confirmaciones where id = v.r_id),
                          'NULL/' || pg_temp.h('c:persona'));
  update public.appointments set paciente_id = '00000000-0000-4000-8000-000000e1f002' where id = '00000000-0000-4000-8000-000000e1a003';
  v_h := pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1003');
  perform pg_temp.esperar('caso 8 ligada: contexto', pg_temp.ctx(v_h) ->> 'estado', 'agendada');
  perform pg_temp.esperar('caso 8 ligada: mismo enlace',
    (select r_id::text from pg_temp.emitir('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a003', gen_random_uuid())),
    '00000000-0000-4000-8000-0000000e1003');
  -- Candado de D2: la cancelación por el enlace de una cita por enlace deja su incidencia.
  perform pg_temp.esperar('caso 8 cancelar por ligar', pg_temp.r('00000000-0000-4000-8000-000000e1c001', v_h, 'cancelar'), 'cancelada');
  perform pg_temp.esperar('caso 8 incidencia', (select tipo from public.reserva_incidencias
                                                where appointment_id = '00000000-0000-4000-8000-000000e1a003' and anulada_en is null), 'cancelacion');
end $$;

-- ── Caso 9: revocar ───────────────────────────────────────────────────
do $$
begin
  perform pg_temp.esperar('caso 9 otra clínica', pg_temp.revocar('00000000-0000-4000-8000-000000e1c002', '00000000-0000-4000-8000-000000e1a002')::text, '0');
  perform pg_temp.esperar('caso 9 revoca', pg_temp.revocar('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a002')::text, '1');
  perform pg_temp.esperar('caso 9 otra vez', pg_temp.revocar('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a002')::text, '0');
  perform pg_temp.esperar('caso 9 contexto', coalesce(pg_temp.ctx(pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1022'))::text, 'NULL'), 'NULL');
  perform pg_temp.esperar('caso 9 responder', pg_temp.r('00000000-0000-4000-8000-000000e1c001', pg_temp.h('codigo:00000000-0000-4000-8000-0000000e1022'), 'confirmar'), 'invalido');
  -- Tras revocar, emitir crea otro.
  perform pg_temp.esperar('caso 9 reemitir',
    pg_temp.emitido('00000000-0000-4000-8000-000000e1c001', '00000000-0000-4000-8000-000000e1a002', '00000000-0000-4000-8000-0000000e1023')::text,
    '00000000-0000-4000-8000-0000000e1023');
end $$;

-- ── Caso 10: permisos ─────────────────────────────────────────────────
do $$
declare v_rol text; v_fn text; n integer;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    foreach v_fn in array array[
        'select public.cita_confirmacion_contexto(''' || repeat('a', 64) || ''')',
        'select public.cita_confirmacion_emitir(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), ''' || repeat('a', 64) || ''', null)',
        'select public.cita_confirmacion_responder(gen_random_uuid(), ''' || repeat('a', 64) || ''', ''confirmar'')',
        'select public.cita_confirmacion_revocar(gen_random_uuid(), gen_random_uuid())'] loop
      begin
        perform pg_temp.como('00000000-0000-4000-8000-000000e1b001');
        execute format('set local role %I', v_rol);
        execute v_fn;
        raise exception 'E1 caso 10: % ejecutó %', v_rol, v_fn;
      exception when insufficient_privilege then null;
      end;
      reset role;
    end loop;
  end loop;
  -- authenticated: ni codigo_hash, ni los vínculos, ni escribir.
  perform pg_temp.como('00000000-0000-4000-8000-000000e1b001');
  foreach v_fn in array array['select codigo_hash from public.cita_confirmaciones',
                              'select paciente_id from public.cita_confirmaciones',
                              'select reserva_correo_hmac from public.cita_confirmaciones',
                              'select * from public.cita_confirmaciones',
                              'update public.cita_confirmaciones set respuesta = null',
                              'insert into public.cita_confirmaciones (id) values (gen_random_uuid())'] loop
    begin
      set local role authenticated;
      execute v_fn;
      raise exception 'E1 caso 10: authenticated pudo %', v_fn;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
  -- El administrador ve los enlaces de su clínica; el invitado, sólo los de sus citas; otra clínica, nada.
  set local role authenticated;
  select count(*) into n from public.cita_confirmaciones where clinica_id = '00000000-0000-4000-8000-000000e1c001';
  reset role;
  perform pg_temp.esperar('caso 10 administrador', n::text,
    (select count(*)::text from public.cita_confirmaciones where clinica_id = '00000000-0000-4000-8000-000000e1c001'));
  perform pg_temp.como('00000000-0000-4000-8000-000000e1b002');
  set local role authenticated;
  select count(*) into n from public.cita_confirmaciones c
    join public.appointments a on a.id = c.appointment_id where a.medico_id <> '00000000-0000-4000-8000-000000e1b002';
  reset role;
  perform pg_temp.esperar('caso 10 invitado, ajenas', n::text, '0');
  set local role authenticated;
  select count(*) into n from public.cita_confirmaciones;
  reset role;
  perform pg_temp.esperar('caso 10 invitado, suyas', n::text,
    (select count(*)::text from public.cita_confirmaciones c join public.appointments a on a.id = c.appointment_id
      where a.medico_id = '00000000-0000-4000-8000-000000e1b002'));
  if n = 0 then raise exception 'E1 caso 10: el invitado no ve ni sus enlaces'; end if;
  perform pg_temp.como('00000000-0000-4000-8000-000000e1b009');
  set local role authenticated;
  select count(*) into n from public.cita_confirmaciones where clinica_id = '00000000-0000-4000-8000-000000e1c001';
  reset role;
  perform pg_temp.esperar('caso 10 otra clínica', n::text, '0');
end $$;

rollback;
