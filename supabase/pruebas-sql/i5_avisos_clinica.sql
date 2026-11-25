-- Agenda tanda I (I5, puntos 19 y 20) — «Avisos» de la clínica y el
-- interruptor del correo a la clínica (20261121150000_agenda_i5_avisos_clinica.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback. Los escritores son disparadores: aquí se ejercen con la misma
-- escritura que hacen las RPC (las RPC mismas ya las prueban D3, E1, E6 y D11).
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1: b1 administrador, b2 médico invitado (no admin). c2: b3 administrador.
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-000000150c01', 'I5 uno', true, 'free'),
  ('00000000-0000-4000-8000-000000150c02', 'I5 dos', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000150b01'::uuid, 'i5-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000150b02'::uuid, 'i5-b2@prueba.local'),
               ('00000000-0000-4000-8000-000000150b03'::uuid, 'i5-b3@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000150c01', es_admin_de_clinica = (id::text like '%b01'), role = 'medico'
 where id in ('00000000-0000-4000-8000-000000150b01', '00000000-0000-4000-8000-000000150b02');
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000150c02', es_admin_de_clinica = true, role = 'medico'
 where id = '00000000-0000-4000-8000-000000150b03';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000150c01', true), ('00000000-0000-4000-8000-000000150c02', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'I5 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
-- Lo que ve una sesión: los avisos sin revisar, «tipo>cita-corta» en orden.
create function pg_temp.ve(p_id uuid) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.como(p_id);
  set local role authenticated;
  select coalesce(string_agg(tipo || '>' || right(cita_id::text, 4), ',' order by tipo, cita_id), '-') into v
    from public.avisos_clinica where revisado_en is null;
  reset role;
  return v;
end $$;
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text), pg_temp.como(uuid) to anon, authenticated, service_role;

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-i5', pg_temp.h('aviso-i5'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-000000150e01', '00000000-0000-4000-8000-000000150c01', '00000000-0000-4000-8000-000000150b01', 'fijo', pg_temp.h('i5-f1'));
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-000000150f01', '00000000-0000-4000-8000-000000150c01', 'Paciente', 'Uno');

-- ── Caso 1: reserva por enlace → «reserva_enlace» (b1) ────────────────
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
values ('00000000-0000-4000-8000-000000150a01', '00000000-0000-4000-8000-000000150c01', null, '00000000-0000-4000-8000-000000150b01',
        'Persona I5', date_trunc('day', now()) + interval '2 days 10 hours', date_trunc('day', now()) + interval '2 days 10 hours 30 min',
        'scheduled', '00000000-0000-4000-8000-000000150e01', 'fijo', 'Persona I5', '5500000015', 'i5@prueba.local',
        pg_temp.h('t:i5a01'), pg_temp.h('c:i5a01'), 'v1-prueba-i5', now(), 0);
select pg_temp.esperar('caso 1', (select string_agg(tipo || '@' || right(clinica_id::text, 4), ',') from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000150a01'), 'reserva_enlace@0c01');

-- ── Caso 2: Google por asignar, sólo sin paciente y con hora ──────────
-- g1 sí; g2 todo el día no; g3 con paciente no; s1 (origen spinus, sin paciente) no;
-- g5 ya pasada (la primera sincronización trae el pasado) no: el criterio de cita_asignacion_google().
-- Integración I: g1, g2, g3 y g5 entran como el sondeo (service_role con spinus.via = google, lo que
-- hace gcal_importar_evento); el aviso sigue la marca de I3 (google_asignacion), no una copia.
set local role service_role;
select set_config('spinus.via', 'google', true);
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, all_day, status, origen, consultorio_timezone)
values
  ('00000000-0000-4000-8000-000000150a11', '00000000-0000-4000-8000-000000150c01', null, '00000000-0000-4000-8000-000000150b02', 'Evento I5',
   date_trunc('day', now()) + interval '3 days 9 hours', date_trunc('day', now()) + interval '3 days 10 hours', false, 'scheduled', 'google', 'America/Merida'),
  ('00000000-0000-4000-8000-000000150a12', '00000000-0000-4000-8000-000000150c01', null, '00000000-0000-4000-8000-000000150b02', 'Vacaciones I5',
   (date_trunc('day', now() at time zone 'America/Merida') + interval '4 days') at time zone 'America/Merida',
   (date_trunc('day', now() at time zone 'America/Merida') + interval '5 days') at time zone 'America/Merida', true, 'scheduled', 'google', 'America/Merida'),
  ('00000000-0000-4000-8000-000000150a13', '00000000-0000-4000-8000-000000150c01', '00000000-0000-4000-8000-000000150f01', '00000000-0000-4000-8000-000000150b01', 'Con paciente I5',
   date_trunc('day', now()) + interval '3 days 11 hours', date_trunc('day', now()) + interval '3 days 12 hours', false, 'scheduled', 'google', 'America/Merida'),
  ('00000000-0000-4000-8000-000000150a15', '00000000-0000-4000-8000-000000150c01', null, '00000000-0000-4000-8000-000000150b02', 'Pasado I5',
   date_trunc('day', now()) - interval '3 days', date_trunc('day', now()) - interval '3 days' + interval '1 hour', false, 'scheduled', 'google', 'America/Merida');
select set_config('spinus.via', '', true);
reset role;
-- s1 (origen spinus) y g6: un evento de Google por venir y sin paciente que NO trae el sondeo
-- (aquí postgres, como la semilla o el SQL Editor): I3 no lo marca y el aviso tampoco salta.
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, all_day, status, origen, consultorio_timezone)
values
  ('00000000-0000-4000-8000-000000150a14', '00000000-0000-4000-8000-000000150c01', null, '00000000-0000-4000-8000-000000150b01', 'Junta I5',
   date_trunc('day', now()) + interval '3 days 13 hours', date_trunc('day', now()) + interval '3 days 14 hours', false, 'scheduled', 'spinus', 'America/Merida'),
  ('00000000-0000-4000-8000-000000150a16', '00000000-0000-4000-8000-000000150c01', null, '00000000-0000-4000-8000-000000150b02', 'Sin sondeo I5',
   date_trunc('day', now()) + interval '3 days 15 hours', date_trunc('day', now()) + interval '3 days 16 hours', false, 'scheduled', 'google', 'America/Merida');
select pg_temp.esperar('caso 2 marca', (select string_agg(right(id::text, 4) || '=' || coalesce(google_asignacion, '-'), ',' order by id)
  from public.appointments where id::text like '%150a1_'), '0a11=por_asignar,0a12=-,0a13=-,0a14=-,0a15=-,0a16=-');
select pg_temp.esperar('caso 2', (select string_agg(tipo || '>' || right(cita_id::text, 4), ',' order by cita_id) from public.avisos_clinica
  where cita_id::text like '%150a1_'), 'google_por_asignar>0a11');

-- ── Caso 3: cancelación por el paciente → su aviso. Tanda L (L5, punto 13):
--    confirmar por el enlace TAMBIÉN avisa ('confirmacion_paciente',
--    20261124160000; el detalle, en l5_aviso_confirmacion.sql) ────────────
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status)
values ('00000000-0000-4000-8000-000000150a21', '00000000-0000-4000-8000-000000150c01', '00000000-0000-4000-8000-000000150f01', '00000000-0000-4000-8000-000000150b01',
        'Paciente Uno', date_trunc('day', now()) + interval '5 days 9 hours', date_trunc('day', now()) + interval '5 days 10 hours', 'scheduled'),
       ('00000000-0000-4000-8000-000000150a22', '00000000-0000-4000-8000-000000150c01', '00000000-0000-4000-8000-000000150f01', '00000000-0000-4000-8000-000000150b01',
        'Paciente Uno', date_trunc('day', now()) + interval '6 days 9 hours', date_trunc('day', now()) + interval '6 days 10 hours', 'scheduled');
insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id) values
  ('00000000-0000-4000-8000-000000150d21', '00000000-0000-4000-8000-000000150c01', '00000000-0000-4000-8000-000000150a21', pg_temp.h('i5-c21'), '00000000-0000-4000-8000-000000150f01'),
  ('00000000-0000-4000-8000-000000150d22', '00000000-0000-4000-8000-000000150c01', '00000000-0000-4000-8000-000000150a22', pg_temp.h('i5-c22'), '00000000-0000-4000-8000-000000150f01');
update public.cita_confirmaciones set respuesta = 'cancelo', respondido_en = now() where id = '00000000-0000-4000-8000-000000150d21';
update public.cita_confirmaciones set respuesta = 'confirmo', respondido_en = now() where id = '00000000-0000-4000-8000-000000150d22';
select pg_temp.esperar('caso 3', (select string_agg(tipo || '>' || right(cita_id::text, 4), ',' order by cita_id) from public.avisos_clinica
  where cita_id::text like '%150a2_'), 'cancelacion_paciente>0a21,confirmacion_paciente>0a22');

-- ── Caso 4: reagendado por el paciente = UN aviso, no dos ─────────────
-- La cita nueva entra como reserva (deja «reserva_enlace») y en la misma
-- transacción se anota el reagendado: el aviso pasa a «reagendado_paciente».
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo, reserva_reagendados)
values ('00000000-0000-4000-8000-000000150a31', '00000000-0000-4000-8000-000000150c01', '00000000-0000-4000-8000-000000150f01', '00000000-0000-4000-8000-000000150b01',
        'Paciente Uno', date_trunc('day', now()) + interval '7 days 9 hours', date_trunc('day', now()) + interval '7 days 10 hours', 'scheduled',
        '00000000-0000-4000-8000-000000150e01', 'fijo', 'Paciente Uno', '5500000015', 'i5@prueba.local',
        pg_temp.h('t:i5a31'), pg_temp.h('c:i5a31'), 'v1-prueba-i5', now(), 0, 1);
insert into public.cita_reagendos (clinica_id, cita_origen_id, cita_nueva_id, confirmacion_id, numero) values
  ('00000000-0000-4000-8000-000000150c01', '00000000-0000-4000-8000-000000150a21', '00000000-0000-4000-8000-000000150a31',
   '00000000-0000-4000-8000-000000150d21', 1);
select pg_temp.esperar('caso 4', (select string_agg(tipo, ',') from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000150a31'), 'reagendado_paciente');

-- ── Caso 5: empalme con Google; un par más de la misma reserva no repite ──
insert into public.reserva_empalmes_google (clinica_id, cita_reserva_id, cita_otra_id) values
  ('00000000-0000-4000-8000-000000150c01', '00000000-0000-4000-8000-000000150a01', '00000000-0000-4000-8000-000000150a11'),
  ('00000000-0000-4000-8000-000000150c01', '00000000-0000-4000-8000-000000150a01', '00000000-0000-4000-8000-000000150a14');
select pg_temp.esperar('caso 5', (select count(*)::text from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000150a01' and tipo = 'empalme_google'), '1');

-- ── Caso 6: RLS. El administrador ve los de su clínica; el invitado, sólo
--    los de SUS citas; otra clínica, ninguno; anon, permiso denegado ──────
select pg_temp.esperar('caso 6 admin c1', pg_temp.ve('00000000-0000-4000-8000-000000150b01'),
  'cancelacion_paciente>0a21,confirmacion_paciente>0a22,empalme_google>0a01,google_por_asignar>0a11,reagendado_paciente>0a31,reserva_enlace>0a01');
select pg_temp.esperar('caso 6 invitado c1', pg_temp.ve('00000000-0000-4000-8000-000000150b02'), 'google_por_asignar>0a11');
select pg_temp.esperar('caso 6 otra clínica', pg_temp.ve('00000000-0000-4000-8000-000000150b03'), '-');
do $$
begin
  set local role anon;
  perform count(*) from public.avisos_clinica;
  raise exception 'I5 caso 6 anon: leyó avisos_clinica';
exception when insufficient_privilege then
  reset role;
end $$;

-- ── Caso 7: revisar. Una vez, con la hora del servidor, a nombre propio ──
do $$
declare v_n integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000150b01');
  set local role authenticated;
  update public.avisos_clinica set revisado_en = '2000-01-01', revisado_por = '00000000-0000-4000-8000-000000150b01'
   where cita_id = '00000000-0000-4000-8000-000000150a21' and tipo = 'cancelacion_paciente';
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.esperar('caso 7 marcado', v_n::text, '1');
  perform pg_temp.esperar('caso 7 hora del servidor', (select (revisado_en > now() - interval '1 minute')::text || ':' || right(revisado_por::text, 4)
    from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-000000150a21'), 'true:0b01');
  -- Ya revisado: nadie lo vuelve a tocar (la policy sólo deja los sin revisar).
  perform pg_temp.como('00000000-0000-4000-8000-000000150b01');
  set local role authenticated;
  update public.avisos_clinica set revisado_en = null, revisado_por = null where cita_id = '00000000-0000-4000-8000-000000150a21';
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.esperar('caso 7 revisado no se reabre', v_n::text, '0');
  perform pg_temp.esperar('caso 7 sale de la lista', pg_temp.ve('00000000-0000-4000-8000-000000150b01'),
    'confirmacion_paciente>0a22,empalme_google>0a01,google_por_asignar>0a11,reagendado_paciente>0a31,reserva_enlace>0a01');
end $$;

-- ── Caso 8: lo que la sesión NO puede: a nombre de otro, otra columna,
--    insertar, borrar, ni avisos de otra clínica ────────────────────────
do $$
declare v_sql text; v_n integer;
begin
  foreach v_sql in array array[
      'update public.avisos_clinica set revisado_en = now(), revisado_por = ''00000000-0000-4000-8000-000000150b02'' where cita_id = ''00000000-0000-4000-8000-000000150a11''',
      'update public.avisos_clinica set tipo = ''reserva_enlace'', revisado_en = now(), revisado_por = ''00000000-0000-4000-8000-000000150b01'' where cita_id = ''00000000-0000-4000-8000-000000150a11''',
      'insert into public.avisos_clinica (clinica_id, tipo, cita_id) values (''00000000-0000-4000-8000-000000150c01'', ''reserva_enlace'', gen_random_uuid())',
      'delete from public.avisos_clinica where cita_id = ''00000000-0000-4000-8000-000000150a11'''] loop
    begin
      perform pg_temp.como('00000000-0000-4000-8000-000000150b01');
      set local role authenticated;
      execute v_sql;
      reset role;
      raise exception 'I5 caso 8: la sesión pudo: %', v_sql;
    exception when insufficient_privilege then
      reset role;
    end;
  end loop;
  perform pg_temp.como('00000000-0000-4000-8000-000000150b03');
  set local role authenticated;
  update public.avisos_clinica set revisado_en = now(), revisado_por = '00000000-0000-4000-8000-000000150b03'
   where cita_id = '00000000-0000-4000-8000-000000150a11';
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.esperar('caso 8 otra clínica no revisa', v_n::text, '0');
end $$;

-- ── Caso 9: revisado, el mismo hecho otra vez sí vuelve a avisar ──────
update public.cita_confirmaciones set respuesta = null, respondido_en = null where id = '00000000-0000-4000-8000-000000150d21';
update public.cita_confirmaciones set respuesta = 'cancelo', respondido_en = now() where id = '00000000-0000-4000-8000-000000150d21';
select pg_temp.esperar('caso 9', (select count(*)::text || ':' || count(*) filter (where revisado_en is null)::text from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000150a21'), '2:1');

-- ── Caso 10: auditoría de cada aviso (log_tabla_change), sin datos personales ──
select pg_temp.esperar('caso 10', (select (count(*) > 0)::text || ':' || count(*) filter (where descripcion like '%Persona%' or descripcion like '%@%')::text
  from public.audit_log where tabla = 'avisos_clinica'
   and registro_id in (select id from public.avisos_clinica where clinica_id = '00000000-0000-4000-8000-000000150c01')), 'true:0');

-- ── Caso 11: el correo a la clínica nace apagado y el administrador lo enciende ──
select pg_temp.esperar('caso 11 de fábrica', (select correo_reserva_clinica::text from public.agenda_ajustes
  where clinica_id = '00000000-0000-4000-8000-000000150c01'), 'false');
do $$
declare v_n integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000150b01');
  set local role authenticated;
  update public.agenda_ajustes set correo_reserva_clinica = true where clinica_id = '00000000-0000-4000-8000-000000150c01';
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.esperar('caso 11 administrador', v_n::text, '1');
  perform pg_temp.como('00000000-0000-4000-8000-000000150b02');
  set local role authenticated;
  update public.agenda_ajustes set correo_reserva_clinica = false where clinica_id = '00000000-0000-4000-8000-000000150c01';
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.esperar('caso 11 invitado no', v_n::text, '0');
end $$;

rollback;
