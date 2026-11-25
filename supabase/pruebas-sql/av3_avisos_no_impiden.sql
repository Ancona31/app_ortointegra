-- Avisos globales · M1 — «un aviso nunca impide la operación de origen», también DENTRO de los
-- seis escritores de F4 (auditoría independiente, hallazgos 5 y 6).
--   · Con el refresco de trg_avisos_clinica_reabrir FORZADO A FALLAR, se completan con las RPC
--     reales: reservar_por_enlace, la confirmación del paciente y la cancelación del paciente.
--   · Con auth.uid() fallando (claims rotos), las funciones de disparador nuevas dejan un WARNING
--     y la escritura de origen sigue.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
-- ⚠️ Deja SEIS líneas de WARNING a propósito, siempre las mismas y en este orden (DETERMINISTA: no
--   depende de la base ni de la hora):
--     1. aviso_clinica_reabrir: aviso reserva_enlace no refrescado (SQLSTATE P0001)        caso 1
--     2. aviso_clinica_reabrir: aviso confirmacion_paciente no refrescado (SQLSTATE P0001) caso 2
--     3. aviso_clinica_reabrir: aviso cancelacion_paciente no refrescado (SQLSTATE P0001)  caso 3
--     4. aviso_clinica_de_cambio_medico: médico de los avisos no actualizado (SQLSTATE P0001)  caso 3-bis
--     5. aviso_clinica_de_cambio_cita: aviso (sin decidir) no escrito (SQLSTATE 22P02)     caso 5
--     6. aviso_clinica_de_bloqueo: aviso no escrito (SQLSTATE 22P02)                        caso 5
--   Cualquier ERROR es un fallo. (Hasta la versión 2 el caso 1 no ejercía el fallo: una reserva crea
--   una cita NUEVA, sin aviso que refrescar, y el WARNING 1 sólo salía con el reabrir de la v1. Ahora
--   el aviso se presiembra: ver el caso 1.)
begin;

-- ── Datos (los de d3 y e1, lo mínimo) ─────────────────────────────────
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-0000003a0c01', 'AV3 uno', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000003a0b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'av3-b1@prueba.local', now(), now()),
  ('00000000-0000-4000-8000-0000003a0b02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'av3-b2@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000003a0c01', role = 'medico', es_admin_de_clinica = (id::text like '%b01'),
                           titulo = 'Dr.', nombres = 'Médico', apellido_paterno = 'Prueba', especialidad = 'Ortopedia', cedula_profesional = '1234567'
 where id in ('00000000-0000-4000-8000-0000003a0b01', '00000000-0000-4000-8000-0000003a0b02');
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000003a0c01', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo) values
  ('00000000-0000-4000-8000-0000003a0501', '00000000-0000-4000-8000-0000003a0c01', '00000000-0000-4000-8000-0000003a0b01', 'Consultorio Uno', 'Uno', 'Calle 1', true);
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo) values
  ('00000000-0000-4000-8000-0000003a0701', '00000000-0000-4000-8000-0000003a0c01', null, 'Primera vez', 30, true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000003a0f01', '00000000-0000-4000-8000-0000003a0c01', 'Paciente', 'Uno');

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'AV3 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-av3', pg_temp.h('aviso-av3'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en) values
  ('00000000-0000-4000-8000-0000003a0e01', '00000000-0000-4000-8000-0000003a0c01', '00000000-0000-4000-8000-0000003a0b01', 'unico', pg_temp.h('av3-u1'), 7, now() + interval '7 days');
-- Dos citas con paciente (a01 para confirmar, a02 para cancelar), con su enlace de confirmación.
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status) values
  ('00000000-0000-4000-8000-0000003a0a01', '00000000-0000-4000-8000-0000003a0c01', '00000000-0000-4000-8000-0000003a0f01', '00000000-0000-4000-8000-0000003a0b01',
   'Paciente Uno', date_trunc('hour', now()) + interval '3 days', date_trunc('hour', now()) + interval '3 days 30 min', 'scheduled'),
  ('00000000-0000-4000-8000-0000003a0a02', '00000000-0000-4000-8000-0000003a0c01', '00000000-0000-4000-8000-0000003a0f01', '00000000-0000-4000-8000-0000003a0b01',
   'Paciente Uno', date_trunc('hour', now()) + interval '4 days', date_trunc('hour', now()) + interval '4 days 30 min', 'scheduled');
insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id) values
  ('00000000-0000-4000-8000-0000003a0d01', '00000000-0000-4000-8000-0000003a0c01', '00000000-0000-4000-8000-0000003a0a01', pg_temp.h('av3-c01'), '00000000-0000-4000-8000-0000003a0f01'),
  ('00000000-0000-4000-8000-0000003a0d02', '00000000-0000-4000-8000-0000003a0c01', '00000000-0000-4000-8000-0000003a0a02', pg_temp.h('av3-c02'), '00000000-0000-4000-8000-0000003a0f01');
-- Ya hay un aviso sin cerrar de cada tipo y cita: así el alta del escritor de F4 pasa por el
-- REFRESCO de reabrir (que es lo que se va a romper). Con hora vieja, para ver que NO se refrescó.
insert into public.avisos_clinica (clinica_id, tipo, cita_id, creado_en) values
  ('00000000-0000-4000-8000-0000003a0c01', 'confirmacion_paciente', '00000000-0000-4000-8000-0000003a0a01', now() - interval '3 hours'),
  ('00000000-0000-4000-8000-0000003a0c01', 'cancelacion_paciente', '00000000-0000-4000-8000-0000003a0a02', now() - interval '3 hours');

-- La respuesta del paciente por su enlace, como el servidor.
create function pg_temp.responder(p_hash text, p_accion text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_resultado into v from public.cita_confirmacion_responder('00000000-0000-4000-8000-0000003a0c01', p_hash, p_accion);
  reset role;
  perform set_config('spinus.via', '', true);
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;

-- ── EL FALLO FORZADO: todo UPDATE de avisos_clinica revienta (de sentencia: también cuando no
--    hay fila que refrescar, como en una reserva nueva). Sólo en esta transacción. ─────────────
create function public.av3_romper() returns trigger language plpgsql as $$
begin
  raise exception 'AV3: refresco forzado a fallar' using errcode = 'P0001';
end $$;
create trigger av3_romper before update on public.avisos_clinica for each statement execute function public.av3_romper();

-- ── Caso 1: reservar_por_enlace se completa ───────────────────────────
-- Para que el alta del aviso de la reserva PASE POR EL REFRESCO (lo que está roto), ya tiene que
-- haber un aviso sin cerrar de esa cita. La cita es nueva y su id no se sabe antes, así que un
-- disparador de la prueba lo siembra al nacer la cita (BEFORE INSERT, con hora vieja). Después, el
-- escritor de F4 inserta el suyo → reabrir lo ve → el refresco revienta → WARNING 1 y el alta sigue.
create function public.av3_presembrar() returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  insert into public.avisos_clinica (clinica_id, tipo, cita_id, creado_en) values (NEW.clinica_id, 'reserva_enlace', NEW.id, now() - interval '3 hours');
  return NEW;
end $f$;
create trigger av3_presembrar before insert on public.appointments for each row when (NEW.reserva_canal is not null)
  execute function public.av3_presembrar();
do $$
declare v record;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select * into v from public.reservar_por_enlace('00000000-0000-4000-8000-0000003a0c01', pg_temp.h('av3-u1'),
      '00000000-0000-4000-8000-0000003a0501', '00000000-0000-4000-8000-0000003a0701', date_trunc('hour', now()) + interval '2 days 10 hours',
      'Persona Prueba', '5500000031', 'av3@prueba.local', pg_temp.h('t:5500000031'), pg_temp.h('c:av3'), null,
      'v1-prueba-av3', pg_temp.h('aviso-av3'), '00000000-0000-4000-8000-0000003a0e99');
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.esperar('caso 1 la reserva se hizo', v.r_resultado, 'ok');
  perform pg_temp.esperar('caso 1 la cita existe', (select count(*)::text from public.appointments where id = v.r_cita_id), '1');
  -- El refresco falló y el alta siguió hasta el ON CONFLICT de F4: sigue UN aviso, el presembrado, SIN refrescar.
  perform pg_temp.esperar('caso 1 un aviso, sin refrescar', (select string_agg(tipo, ',') || ':' || bool_and(creado_en < now() - interval '2 hours')::text
    from public.avisos_clinica where cita_id = v.r_cita_id), 'reserva_enlace:true');
end $$;
drop trigger av3_presembrar on public.appointments;
drop function public.av3_presembrar();

-- ── Caso 2: la confirmación del paciente se completa ──────────────────
select pg_temp.esperar('caso 2 respuesta', pg_temp.responder(pg_temp.h('av3-c01'), 'confirmar'), 'confirmada');
select pg_temp.esperar('caso 2 la cita quedó confirmada', (select status from public.appointments where id = '00000000-0000-4000-8000-0000003a0a01'), 'confirmed');
select pg_temp.esperar('caso 2 el aviso sigue, uno y SIN refrescar', (select count(*)::text || ':' || bool_and(creado_en < now() - interval '2 hours')::text
  from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-0000003a0a01' and tipo = 'confirmacion_paciente'), '1:true');

-- ── Caso 3: la cancelación del paciente se completa ───────────────────
select pg_temp.esperar('caso 3 respuesta', pg_temp.responder(pg_temp.h('av3-c02'), 'cancelar'), 'cancelada');
select pg_temp.esperar('caso 3 la cita quedó cancelada', (select status from public.appointments where id = '00000000-0000-4000-8000-0000003a0a02'), 'cancelled');
select pg_temp.esperar('caso 3 el aviso sigue, uno y SIN refrescar', (select count(*)::text || ':' || bool_and(creado_en < now() - interval '2 hours')::text
  from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-0000003a0a02' and tipo = 'cancelacion_paciente'), '1:true');

-- ── Caso 3-bis: el cambio de MÉDICO de una cita se completa aunque la copia del médico en sus avisos
--    no se pueda poner al día (aviso_clinica_de_cambio_medico hace un UPDATE: revienta) ──
update public.appointments set medico_id = '00000000-0000-4000-8000-0000003a0b02' where id = '00000000-0000-4000-8000-0000003a0a01';
select pg_temp.esperar('caso 3-bis la cita cambió de médico', (select right(medico_id::text, 4) from public.appointments where id = '00000000-0000-4000-8000-0000003a0a01'), '0b02');
select pg_temp.esperar('caso 3-bis el aviso conserva la copia vieja', (select string_agg(right(coalesce(medico_id::text, '-'), 4), ',')
  from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-0000003a0a01'), '0b01');

-- ── Caso 4: sin el fallo forzado, el mismo hecho SÍ refresca (el camino normal sigue vivo) ──
drop trigger av3_romper on public.avisos_clinica;
drop function public.av3_romper();
update public.cita_confirmaciones set respuesta = null, respondido_en = null where id = '00000000-0000-4000-8000-0000003a0d02';
update public.cita_confirmaciones set respuesta = 'cancelo', respondido_en = now() where id = '00000000-0000-4000-8000-0000003a0d02';
select pg_temp.esperar('caso 4 refrescado, y sigue siendo uno', (select count(*)::text || ':' || bool_and(creado_en > now() - interval '1 minute')::text
  from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-0000003a0a02' and tipo = 'cancelacion_paciente'), '1:true');
-- Y el cambio de médico, ya sin el fallo, sí pone al día la copia del médico en los avisos de la cita.
update public.appointments set medico_id = '00000000-0000-4000-8000-0000003a0b01' where id = '00000000-0000-4000-8000-0000003a0a01';
update public.appointments set medico_id = '00000000-0000-4000-8000-0000003a0b02' where id = '00000000-0000-4000-8000-0000003a0a01';
select pg_temp.esperar('caso 4 la copia del médico sigue a la cita', (select string_agg(right(coalesce(medico_id::text, '-'), 4), ',')
  from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-0000003a0a01'), '0b02');

-- ── Caso 5: la SESIÓN no se puede leer (auth.uid() lanza) → WARNING y la escritura sigue ──
-- No se puede probar sobre appointments: con los claims rotos fallan ANTES los disparadores de
-- auditoría de siempre (log_cita_change también llama a auth.uid()), con o sin M1. Así que las
-- funciones REALES de M1 se cuelgan de dos tablas temporales con las columnas que leen.
create temp table _citas (id uuid default gen_random_uuid(), clinica_id uuid, medico_id uuid, paciente_id uuid, reserva_canal text,
                          status text, start_time timestamptz, end_time timestamptz) on commit drop;
create trigger t_alta after insert on _citas for each row execute function public.aviso_clinica_de_cambio_cita();
create trigger t_cambio after update on _citas for each row execute function public.aviso_clinica_de_cambio_cita();
create temp table _bloqueos (id uuid default gen_random_uuid(), clinica_id uuid, medico_id uuid, inicio timestamptz, fin timestamptz,
                             todo_el_dia boolean, zona text) on commit drop;
create trigger t_bloqueo after insert or delete on _bloqueos for each row execute function public.aviso_clinica_de_bloqueo();
select set_config('request.jwt.claims', '{"sub": "esto-no-es-un-uuid", "role": "authenticated"}', true);
do $$
begin
  perform auth.uid();
  raise exception 'AV3 caso 5: auth.uid() no lanzó con los claims rotos (la prueba no prueba nada)';
exception when invalid_text_representation then null;
end $$;
insert into _citas (clinica_id, medico_id, status, start_time, end_time)
values ('00000000-0000-4000-8000-0000003a0c01', '00000000-0000-4000-8000-0000003a0b01', 'scheduled', now(), now() + interval '30 min');
insert into _bloqueos (clinica_id, medico_id, inicio, fin, todo_el_dia, zona)
values ('00000000-0000-4000-8000-0000003a0c01', '00000000-0000-4000-8000-0000003a0b01', now(), now() + interval '1 hour', false, 'America/Merida');
select set_config('request.jwt.claims', '', true);
select pg_temp.esperar('caso 5 las dos escrituras se hicieron', (select count(*) from _citas)::text || ':' || (select count(*) from _bloqueos)::text, '1:1');

rollback;
