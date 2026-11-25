-- Avisos globales · M1 (20261202120000_avisos_globales_modelo.sql) — destinatario, actor,
-- avisos sin cita y los escritores nuevos. Se corre con scripts/pruebas-sql.sh. Crea sus
-- propios datos y termina en rollback. Falla si M1 no está o se deshace.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1 (v2 encendida): b1 médico administrador, b2 y b6 médicos invitados, b4 secretaria.
-- c2 (v2 apagada): b3 administrador, b5 secretaria.
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-0000001a0c01', 'AV1 uno', true, 'free'),
  ('00000000-0000-4000-8000-0000001a0c02', 'AV1 dos', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select ('00000000-0000-4000-8000-0000001a0b0' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'av1-b' || n || '@prueba.local', now(), now() from generate_series(1, 6) n;
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000001a0c01', role = 'medico', es_admin_de_clinica = (id::text like '%b01')
 where id::text ~ '1a0b0[126]$';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000001a0c01', role = 'secretaria', es_admin_de_clinica = false
 where id = '00000000-0000-4000-8000-0000001a0b04';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000001a0c02', role = 'medico', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-0000001a0b03';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000001a0c02', role = 'secretaria', es_admin_de_clinica = false
 where id = '00000000-0000-4000-8000-0000001a0b05';
-- Los médicos, con el perfil completo (appointments_gates_insert → perfil_completo()): datos y un consultorio activo.
update public.profiles set nombres = 'Médico', especialidad = 'Ortopedia', cedula_profesional = '1234567' where id::text ~ '1a0b0[1236]$';
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone)
select ('00000000-0000-4000-8000-0000001a050' || n)::uuid, pr.clinica_id, pr.id, 'Consultorio ' || n, 'C' || n, 'Calle falsa ' || n, true, 'America/Merida'
  from (values (1), (2), (3), (6)) x(n) join public.profiles pr on pr.id = ('00000000-0000-4000-8000-0000001a0b0' || x.n)::uuid;
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-0000001a0c01', true), ('00000000-0000-4000-8000-0000001a0c02', false);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-0000001a0f01', '00000000-0000-4000-8000-0000001a0c01', 'Paciente', 'Uno'),
  ('00000000-0000-4000-8000-0000001a0f02', '00000000-0000-4000-8000-0000001a0c02', 'Paciente', 'Dos');

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'AV1 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sin_sesion() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
$$;
-- Lo que VE una persona con su sesión (RLS): tipos de sus avisos sin revisar, ordenados.
create function pg_temp.ve(p_id uuid) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.como(p_id);
  set local role authenticated;
  select coalesce(string_agg(tipo, ',' order by tipo), '') into v from public.avisos_clinica where revisado_en is null;
  reset role;
  perform pg_temp.sin_sesion();
  return v;
end $$;
-- Lo que tiene PENDIENTE una persona (avisos_pendientes: lo que ve y no ha visto desde su último cambio).
create function pg_temp.pend(p_id uuid) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.como(p_id);
  set local role authenticated;
  select coalesce(string_agg(tipo, ',' order by tipo), '') into v
    from public.avisos_pendientes(array['cancelacion_paciente', 'confirmacion_paciente', 'personal_bloqueo', 'personal_desbloqueo'], 50);
  reset role;
  perform pg_temp.sin_sesion();
  return v;
end $$;
-- Una persona marca vistos sus avisos pendientes del tipo dado; devuelve cuántos.
create function pg_temp.marca(p_id uuid, p_tipo text) returns text language plpgsql as $$
declare v integer;
begin
  perform pg_temp.como(p_id);
  set local role authenticated;
  insert into public.avisos_vistos (aviso_id, usuario_id, clinica_id)
  select a.id, p_id, a.clinica_id from public.avisos_pendientes(array[p_tipo], 50) a
  on conflict (aviso_id, usuario_id) do update set visto_en = now();
  get diagnostics v = row_count;
  reset role;
  perform pg_temp.sin_sesion();
  return v::text;
end $$;
-- Una cita con paciente del médico dado, en c1, dentro de p_dias días; la escribe quien tenga la sesión p_actor.
create function pg_temp.agenda(p_actor uuid, p_medico uuid, p_dias int) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.como(p_actor);
  set local role authenticated;
  insert into public.appointments (clinica_id, paciente_id, medico_id, title, start_time, end_time, status)
  values ('00000000-0000-4000-8000-0000001a0c01', '00000000-0000-4000-8000-0000001a0f01', p_medico, 'Paciente Uno',
          date_trunc('day', now()) + make_interval(days => p_dias, hours => 9),
          date_trunc('day', now()) + make_interval(days => p_dias, hours => 10), 'scheduled')
  returning id into v;
  reset role;
  perform pg_temp.sin_sesion();
  return v;
end $$;
-- Lo que hace Google: una RPC de service_role que marca spinus.via y cambia la cita.
create function pg_temp.google(p_via text, p_cita uuid, p_que text) returns void language plpgsql as $$
begin
  set local role service_role;
  perform set_config('spinus.via', p_via, true);
  if p_que = 'mover' then
    update public.appointments set start_time = start_time + interval '2 hours', end_time = end_time + interval '2 hours' where id = p_cita;
  else
    update public.appointments set status = p_que where id = p_cita;
  end if;
  perform set_config('spinus.via', '', true);
  reset role;
end $$;
create temp table _c (nombre text primary key, id uuid) on commit drop;
grant select on _c to anon, authenticated, service_role;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

-- ── Caso 1: la secretaria agenda en la agenda de b2 → aviso SÓLO para b2 ──────
insert into _c values ('s_en_b2', pg_temp.agenda('00000000-0000-4000-8000-0000001a0b04', '00000000-0000-4000-8000-0000001a0b02', 3));
select pg_temp.esperar('caso 1 fila', (select tipo || '|' || right(destinatario_id::text, 2) || '|' || right(actor_id::text, 2)
  from public.avisos_clinica where cita_id = (select id from _c where nombre = 's_en_b2')), 'personal_agendo|02|04');
select pg_temp.esperar('caso 1 lo ve el médico dueño', pg_temp.ve('00000000-0000-4000-8000-0000001a0b02'), 'personal_agendo');
select pg_temp.esperar('caso 1 quien lo hizo no lo ve', pg_temp.ve('00000000-0000-4000-8000-0000001a0b04'), '');
select pg_temp.esperar('caso 1 el administrador no lo ve', pg_temp.ve('00000000-0000-4000-8000-0000001a0b01'), '');
select pg_temp.esperar('caso 1 otro médico no lo ve', pg_temp.ve('00000000-0000-4000-8000-0000001a0b06'), '');

-- ── Caso 2: el médico en su propia agenda no avisa a nadie ────────────
insert into _c values ('b2_en_b2', pg_temp.agenda('00000000-0000-4000-8000-0000001a0b02', '00000000-0000-4000-8000-0000001a0b02', 4));
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b02');
  set local role authenticated;
  update public.appointments set start_time = start_time + interval '1 hour', end_time = end_time + interval '1 hour'
   where id = (select id from _c where nombre = 'b2_en_b2');
  update public.appointments set status = 'cancelled' where id = (select id from _c where nombre = 'b2_en_b2');
  reset role;
  perform pg_temp.sin_sesion();
end $$;
select pg_temp.esperar('caso 2', (select count(*)::text from public.avisos_clinica where cita_id = (select id from _c where nombre = 'b2_en_b2')), '0');

-- ── Caso 3: el administrador mueve y cancela una cita de b2 ───────────
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b01');
  set local role authenticated;
  update public.appointments set start_time = start_time + interval '1 hour', end_time = end_time + interval '1 hour'
   where id = (select id from _c where nombre = 's_en_b2');
  -- un segundo movimiento sin revisar NO crea otro: refresca el mismo.
  update public.appointments set start_time = start_time + interval '1 hour', end_time = end_time + interval '1 hour'
   where id = (select id from _c where nombre = 's_en_b2');
  -- un cambio que no es de hora ni de estado no avisa.
  update public.appointments set notes = 'nota' where id = (select id from _c where nombre = 's_en_b2');
  reset role;
  perform pg_temp.sin_sesion();
end $$;
select pg_temp.esperar('caso 3 mover', (select string_agg(tipo || ':' || right(actor_id::text, 2), ',' order by tipo) from public.avisos_clinica
  where cita_id = (select id from _c where nombre = 's_en_b2')), 'personal_agendo:04,personal_movio:01');
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b01');
  set local role authenticated;
  update public.appointments set status = 'cancelled' where id = (select id from _c where nombre = 's_en_b2');
  reset role;
  perform pg_temp.sin_sesion();
end $$;
select pg_temp.esperar('caso 3 cancelar', pg_temp.ve('00000000-0000-4000-8000-0000001a0b02'), 'personal_agendo,personal_cancelo,personal_movio');

-- ── Caso 4: Google «Sí» y «No» (spinus.via = google_rsvp) → avisos de TODA la clínica ──
insert into _c values ('rsvp_si', pg_temp.agenda('00000000-0000-4000-8000-0000001a0b02', '00000000-0000-4000-8000-0000001a0b02', 5)),
                      ('rsvp_no', pg_temp.agenda('00000000-0000-4000-8000-0000001a0b02', '00000000-0000-4000-8000-0000001a0b02', 6));
select pg_temp.google('google_rsvp', (select id from _c where nombre = 'rsvp_si'), 'confirmed');
select pg_temp.google('google_rsvp', (select id from _c where nombre = 'rsvp_no'), 'cancelled');
select pg_temp.esperar('caso 4 sí', (select tipo || '|' || coalesce(destinatario_id::text, 'todos') from public.avisos_clinica
  where cita_id = (select id from _c where nombre = 'rsvp_si')), 'confirmacion_paciente|todos');
select pg_temp.esperar('caso 4 no', (select tipo from public.avisos_clinica where cita_id = (select id from _c where nombre = 'rsvp_no')), 'cancelacion_paciente');
-- Los de toda la clínica: los ven el administrador y la secretaria; otro médico invitado, no (no ve la cita).
select pg_temp.esperar('caso 4 administrador', pg_temp.ve('00000000-0000-4000-8000-0000001a0b01'), 'cancelacion_paciente,confirmacion_paciente');
select pg_temp.esperar('caso 4 secretaria', pg_temp.ve('00000000-0000-4000-8000-0000001a0b04'), 'cancelacion_paciente,confirmacion_paciente');
select pg_temp.esperar('caso 4 otro médico', pg_temp.ve('00000000-0000-4000-8000-0000001a0b06'), '');
-- Sin la marca de Google, un cambio sin sesión no avisa (la confirmación de otra RPC, la semilla…).
insert into _c values ('sin_via', pg_temp.agenda('00000000-0000-4000-8000-0000001a0b02', '00000000-0000-4000-8000-0000001a0b02', 7));
select pg_temp.google('', (select id from _c where nombre = 'sin_via'), 'confirmed');
select pg_temp.google('enlace_paciente', (select id from _c where nombre = 'sin_via'), 'cancelled');
select pg_temp.esperar('caso 4 sin marca', (select count(*)::text from public.avisos_clinica where cita_id = (select id from _c where nombre = 'sin_via')), '0');

-- ── Caso 5: mover y borrar en Google (spinus.via = google) ────────────
insert into _c values ('g_mueve', pg_temp.agenda('00000000-0000-4000-8000-0000001a0b01', '00000000-0000-4000-8000-0000001a0b01', 8));
select pg_temp.google('google', (select id from _c where nombre = 'g_mueve'), 'mover');
select pg_temp.google('google', (select id from _c where nombre = 'g_mueve'), 'mover');
select pg_temp.esperar('caso 5 mover (uno, refrescado)', (select string_agg(tipo, ',') from public.avisos_clinica
  where cita_id = (select id from _c where nombre = 'g_mueve')), 'google_movio_cita');
select pg_temp.google('google', (select id from _c where nombre = 'g_mueve'), 'cancelled');
select pg_temp.esperar('caso 5 borrar', (select string_agg(tipo, ',' order by tipo) from public.avisos_clinica
  where cita_id = (select id from _c where nombre = 'g_mueve')), 'google_cancelo_cita,google_movio_cita');
-- Un evento SIN paciente movido o borrado en Google no avisa.
insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time, status)
values ('00000000-0000-4000-8000-0000001a0a09', '00000000-0000-4000-8000-0000001a0c01', '00000000-0000-4000-8000-0000001a0b01',
        'Junta', date_trunc('day', now()) + interval '9 days 9 hours', date_trunc('day', now()) + interval '9 days 10 hours', 'scheduled');
select pg_temp.google('google', '00000000-0000-4000-8000-0000001a0a09', 'mover');
select pg_temp.google('google', '00000000-0000-4000-8000-0000001a0a09', 'cancelled');
select pg_temp.esperar('caso 5 evento sin paciente', (select count(*)::text from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-0000001a0a09'), '0');

-- ── Caso 6: la secretaria pone y quita un bloqueo de b2; b2 en lo suyo, nada ──
do $$
declare v uuid;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b04');
  set local role authenticated;
  insert into public.agenda_bloqueos (clinica_id, medico_id, inicio, fin, motivo)
  values ('00000000-0000-4000-8000-0000001a0c01', '00000000-0000-4000-8000-0000001a0b02',
          date_trunc('day', now()) + interval '20 days 9 hours', date_trunc('day', now()) + interval '20 days 12 hours', 'motivo que no debe viajar')
  returning id into v;
  delete from public.agenda_bloqueos where id = v;
  reset role;
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b02');
  set local role authenticated;
  insert into public.agenda_bloqueos (clinica_id, medico_id, inicio, fin)
  values ('00000000-0000-4000-8000-0000001a0c01', '00000000-0000-4000-8000-0000001a0b02',
          date_trunc('day', now()) + interval '21 days 9 hours', date_trunc('day', now()) + interval '21 days 12 hours');
  reset role;
  perform pg_temp.sin_sesion();
end $$;
select pg_temp.esperar('caso 6 filas', (select string_agg(tipo || '|' || right(destinatario_id::text, 2) || '|' || right(actor_id::text, 2)
  || '|' || (cita_id is null)::text || '|' || (datos ? 'inicio')::text, ',' order by tipo) from public.avisos_clinica where tipo like 'personal\_%bloqueo'),
  'personal_bloqueo|02|04|true|true,personal_desbloqueo|02|04|true|true');
select pg_temp.esperar('caso 6 el motivo del bloqueo no viaja', (select count(*)::text from public.avisos_clinica where datos::text like '%motivo%'), '0');
select pg_temp.esperar('caso 6 sólo los ve b2', (select (pg_temp.ve('00000000-0000-4000-8000-0000001a0b02') like '%personal_bloqueo,%personal_desbloqueo%')::text
  || (pg_temp.ve('00000000-0000-4000-8000-0000001a0b04') like '%bloqueo%')::text || (pg_temp.ve('00000000-0000-4000-8000-0000001a0b01') like '%bloqueo%')::text), 'truefalsefalse');

-- ── Caso 7: correos. Fallo sin reintento → correo_fallido; un recordatorio enviado NO avisa ──
insert into _c values ('correo1', pg_temp.agenda('00000000-0000-4000-8000-0000001a0b02', '00000000-0000-4000-8000-0000001a0b02', 10)),
                      ('correo2', pg_temp.agenda('00000000-0000-4000-8000-0000001a0b02', '00000000-0000-4000-8000-0000001a0b02', 11));
insert into public.cita_correos (id, clinica_id, appointment_id, tipo, inicio_cita, estado, intentos, testigo, tomado_en)
select ('00000000-0000-4000-8000-0000001a0e0' || x.n)::uuid, '00000000-0000-4000-8000-0000001a0c01', c.id, x.tipo, now() + interval '10 days',
       'enviando', x.intentos, gen_random_uuid(), now()
  from (values (1, 'correo1', 'comprobante', 1), (2, 'correo1', 'recordatorio', 1), (3, 'correo1', 'confirmacion', 1),
               (4, 'correo2', 'recordatorio', 3), (5, 'correo2', 'comprobante', 1)) x(n, cita, tipo, intentos)
  join _c c on c.nombre = x.cita;
update public.cita_correos set estado = 'fallido', motivo = 'transporte' where id = '00000000-0000-4000-8000-0000001a0e03'; -- a mano: no avisa
select pg_temp.esperar('caso 7 el envío a mano no avisa', (select count(*)::text from public.avisos_clinica where tipo = 'correo_fallido'), '0');
update public.cita_correos set estado = 'fallido', motivo = 'transporte' where id = '00000000-0000-4000-8000-0000001a0e02'; -- se reintentará: no avisa
select pg_temp.esperar('caso 7 el que se reintenta no avisa', (select count(*)::text from public.avisos_clinica where tipo = 'correo_fallido'), '0');
update public.cita_correos set estado = 'fallido', motivo = 'sin_destinatario' where id = '00000000-0000-4000-8000-0000001a0e05'; -- no es fallo de envío
select pg_temp.esperar('caso 7 sin destinatario no avisa', (select count(*)::text from public.avisos_clinica where tipo = 'correo_fallido'), '0');
update public.cita_correos set estado = 'fallido', motivo = 'transporte' where id = '00000000-0000-4000-8000-0000001a0e01'; -- comprobante
select pg_temp.esperar('caso 7 comprobante fallido', (select count(*)::text from public.avisos_clinica where tipo = 'correo_fallido'
  and cita_id = (select id from _c where nombre = 'correo1')), '1');
-- Un recordatorio ENVIADO no avisa (decisión de Angel: ni aviso ni burbuja).
update public.cita_correos set estado = 'enviado', enviado_en = now() where id = '00000000-0000-4000-8000-0000001a0e04';
update public.cita_correos set estado = 'enviando', motivo = null, tomado_en = now() where id = '00000000-0000-4000-8000-0000001a0e02';
update public.cita_correos set estado = 'enviado', enviado_en = now() where id = '00000000-0000-4000-8000-0000001a0e02';
select pg_temp.esperar('caso 7 los enviados no avisan', (select count(*)::text from public.avisos_clinica
  where cita_id in (select id from _c where nombre in ('correo1', 'correo2')) and tipo <> 'correo_fallido'), '0');
-- El tercer intento fallido de un recordatorio sí.
update public.cita_correos set estado = 'enviando', enviado_en = null, tomado_en = now() where id = '00000000-0000-4000-8000-0000001a0e04';
update public.cita_correos set estado = 'fallido', motivo = 'transporte' where id = '00000000-0000-4000-8000-0000001a0e04';
select pg_temp.esperar('caso 7 recordatorio sin más reintentos', (select count(*)::text from public.avisos_clinica where tipo = 'correo_fallido'
  and cita_id = (select id from _c where nombre = 'correo2')), '1');

-- ── Caso 8: Google se desconecta o deja de sincronizar ────────────────
insert into public.clinica_conexiones_google (id, clinica_id, user_id, rol, estado, calendar_id)
values ('00000000-0000-4000-8000-0000001a0d01', '00000000-0000-4000-8000-0000001a0c01', '00000000-0000-4000-8000-0000001a0b01', 'clinica', 'activa', 'cal-av1');
update public.clinica_conexiones_google set estado = 'revocada' where id = '00000000-0000-4000-8000-0000001a0d01';
update public.clinica_conexiones_google set estado = 'activa' where id = '00000000-0000-4000-8000-0000001a0d01';
update public.clinica_conexiones_google set estado = 'revocada' where id = '00000000-0000-4000-8000-0000001a0d01';
select pg_temp.esperar('caso 8 desconectado (uno sin revisar)', (select count(*)::text from public.avisos_clinica where tipo = 'google_desconectado'), '1');
update public.clinica_conexiones_google set estado = 'activa' where id = '00000000-0000-4000-8000-0000001a0d01';
insert into public.gcal_sync_estado (clinica_id, conexion_id, calendar_id, errores_seguidos)
values ('00000000-0000-4000-8000-0000001a0c01', '00000000-0000-4000-8000-0000001a0d01', 'cal-av1', 0);
update public.gcal_sync_estado set errores_seguidos = 2 where clinica_id = '00000000-0000-4000-8000-0000001a0c01';
select pg_temp.esperar('caso 8 dos fallos no avisan', (select count(*)::text from public.avisos_clinica where tipo = 'google_sin_sincronizar'), '0');
update public.gcal_sync_estado set errores_seguidos = 3 where clinica_id = '00000000-0000-4000-8000-0000001a0c01';
update public.gcal_sync_estado set errores_seguidos = 4 where clinica_id = '00000000-0000-4000-8000-0000001a0c01';
select pg_temp.esperar('caso 8 al tercero, uno', (select count(*)::text from public.avisos_clinica where tipo = 'google_sin_sincronizar'), '1');
-- Los de Google sin médico los ve toda la clínica, también el invitado.
select pg_temp.esperar('caso 8 el invitado los ve', (pg_temp.ve('00000000-0000-4000-8000-0000001a0b06') = 'google_desconectado,google_sin_sincronizar')::text, 'true');

-- ── Caso 9: UN AVISO QUE FALLA NO IMPIDE LA CITA (y deja un WARNING, no silencio) ──
alter table public.avisos_clinica add constraint av1_forzar_fallo check (tipo <> 'personal_agendo' or creado_en < now() - interval '1 hour') not valid;
insert into _c values ('aviso_roto', pg_temp.agenda('00000000-0000-4000-8000-0000001a0b04', '00000000-0000-4000-8000-0000001a0b06', 12));
select pg_temp.esperar('caso 9 la cita se guardó', (select count(*)::text from public.appointments where id = (select id from _c where nombre = 'aviso_roto')), '1');
select pg_temp.esperar('caso 9 sin aviso', (select count(*)::text from public.avisos_clinica where cita_id = (select id from _c where nombre = 'aviso_roto')), '0');
alter table public.avisos_clinica drop constraint av1_forzar_fallo;

-- ── Caso 10: la RPC del servidor ──────────────────────────────────────
do $$
declare v text;
begin
  set local role service_role;
  v := public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'reserva_frenada', null, '00000000-0000-4000-8000-0000001a0b02', null, '  Fulano de Tal ')::text
    -- el mismo nombre con otra caja: la misma línea, sube el contador.
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'reserva_frenada', null, '00000000-0000-4000-8000-0000001a0b02', null, 'FULANO DE TAL')::text
    -- otro nombre: otra línea. Uno de 300 caracteres se recorta a 120.
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'reserva_frenada', null, '00000000-0000-4000-8000-0000001a0b02', null, repeat('x', 300))::text
    -- sin nombre no hay aviso; un médico de OTRA clínica y uno que no existe: la misma respuesta.
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'reserva_frenada', null, '00000000-0000-4000-8000-0000001a0b02', null, '   ')::text
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'reserva_frenada', null, '00000000-0000-4000-8000-0000001a0b03', null, 'Fulano')::text
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'reserva_frenada', null, gen_random_uuid(), null, 'Fulano')::text
    -- con la v2 apagada, nada.
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c02', 'reserva_frenada', null, '00000000-0000-4000-8000-0000001a0b03', null, 'Fulano')::text
    -- «Reagendar» del personal: la cita de b1 movida por la secretaria; por el propio médico, nada; cita de otra clínica, nada.
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'personal_movio', (select id from _c where nombre = 'g_mueve'), null, '00000000-0000-4000-8000-0000001a0b04', null)::text
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'personal_movio', (select id from _c where nombre = 'g_mueve'), null, '00000000-0000-4000-8000-0000001a0b01', null)::text
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c02', 'personal_movio', (select id from _c where nombre = 'g_mueve'), null, '00000000-0000-4000-8000-0000001a0b05', null)::text
    -- «No asistirá» (el «No» de Google en la última hora): una sola vez por cita; cita de otra clínica, nada.
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'paciente_no_asistira', (select id from _c where nombre = 'sin_via'), null, null, null)::text
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'paciente_no_asistira', (select id from _c where nombre = 'sin_via'), null, null, null)::text
    || public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c02', 'paciente_no_asistira', (select id from _c where nombre = 'sin_via'), null, null, null)::text;
  reset role;
  perform pg_temp.esperar('caso 10 respuestas', v, 'truetruetruefalsefalsefalsefalsetruefalsefalsetruefalsefalse');
end $$;
select pg_temp.esperar('caso 10 frenada: una línea por nombre, con contador', (select string_agg(left(datos ->> 'nombre', 13) || ':' || char_length(datos ->> 'nombre') || ':' || (datos ->> 'intentos'), ',' order by datos ->> 'nombre')
  from public.avisos_clinica where tipo = 'reserva_frenada'), 'Fulano de Tal:13:2,xxxxxxxxxxxxx:120:1');
select pg_temp.esperar('caso 10 reagendar', (select right(destinatario_id::text, 2) || '|' || right(actor_id::text, 2) from public.avisos_clinica
  where tipo = 'personal_movio' and cita_id = (select id from _c where nombre = 'g_mueve')), '01|04');
select pg_temp.esperar('caso 10 no asistirá, uno', (select count(*)::text from public.avisos_clinica where tipo = 'paciente_no_asistira'), '1');
-- La frenada de b2: la ven b2, el administrador y la secretaria; otro médico invitado, no.
select pg_temp.esperar('caso 10 quién ve la frenada', (select (pg_temp.ve('00000000-0000-4000-8000-0000001a0b02') like '%reserva_frenada%')::text
  || (pg_temp.ve('00000000-0000-4000-8000-0000001a0b01') like '%reserva_frenada%')::text || (pg_temp.ve('00000000-0000-4000-8000-0000001a0b04') like '%reserva_frenada%')::text
  || (pg_temp.ve('00000000-0000-4000-8000-0000001a0b06') like '%reserva_frenada%')::text), 'truetruetruefalse');
-- El nombre sólo cabe en reserva_frenada.
do $$
begin
  insert into public.avisos_clinica (clinica_id, tipo, datos) values ('00000000-0000-4000-8000-0000001a0c01', 'google_desconectado', '{"nombre": "x"}');
  raise exception 'AV1 caso 10: admitió un nombre fuera de reserva_frenada';
exception when check_violation then null;
end $$;
do $$
begin
  set local role service_role;
  perform public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'personal_agendo', null, null, null, null);
  reset role;
  raise exception 'AV1 caso 10: aceptó un tipo fuera de la lista blanca';
exception when invalid_parameter_value then reset role;
end $$;
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b01');
  set local role authenticated;
  perform public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'reserva_frenada', null, '00000000-0000-4000-8000-0000001a0b02', null, 'Fulano');
  reset role;
  raise exception 'AV1 caso 10: la sesión pudo llamar a la RPC';
exception when insufficient_privilege then reset role; perform pg_temp.sin_sesion();
end $$;

-- ── Caso 11: con la v2 APAGADA nada avisa (c2) ────────────────────────
do $$
declare v uuid;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b05');
  set local role authenticated;
  insert into public.appointments (clinica_id, paciente_id, medico_id, title, start_time, end_time, status)
  values ('00000000-0000-4000-8000-0000001a0c02', '00000000-0000-4000-8000-0000001a0f02', '00000000-0000-4000-8000-0000001a0b03', 'Paciente Dos',
          date_trunc('day', now()) + interval '3 days 9 hours', date_trunc('day', now()) + interval '3 days 10 hours', 'scheduled')
  returning id into v;
  update public.appointments set status = 'cancelled' where id = v;
  reset role;
  perform pg_temp.sin_sesion();
end $$;
select pg_temp.esperar('caso 11', (select count(*)::text from public.avisos_clinica where clinica_id = '00000000-0000-4000-8000-0000001a0c02'), '0');

-- ── Caso 12: aislamiento entre clínicas ───────────────────────────────
select pg_temp.esperar('caso 12 c2 no ve nada de c1', pg_temp.ve('00000000-0000-4000-8000-0000001a0b03') || pg_temp.ve('00000000-0000-4000-8000-0000001a0b05'), '');

-- ── Caso 13: revisar. El dueño revisa el suyo; nadie más puede ni verlo ni tocarlo ──
do $$
declare v_n integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b04');
  set local role authenticated;
  update public.avisos_clinica set revisado_en = now(), revisado_por = '00000000-0000-4000-8000-0000001a0b04' where tipo = 'personal_bloqueo';
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.esperar('caso 13 quien lo hizo no lo revisa', v_n::text, '0');
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b02');
  set local role authenticated;
  update public.avisos_clinica set revisado_en = now(), revisado_por = '00000000-0000-4000-8000-0000001a0b02' where tipo = 'personal_bloqueo';
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.sin_sesion();
  perform pg_temp.esperar('caso 13 el dueño sí', v_n::text, '1');
end $$;
-- La sesión no puede cambiar a quién va dirigido un aviso ni quién lo hizo.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b02');
  set local role authenticated;
  update public.avisos_clinica set destinatario_id = null where tipo = 'personal_desbloqueo';
  reset role;
  raise exception 'AV1 caso 13: la sesión cambió destinatario_id';
exception when insufficient_privilege then reset role; perform pg_temp.sin_sesion();
end $$;

-- ── Caso 14: los avisos de F4 se ven como antes (columnas nuevas en NULL) ──
insert into public.avisos_clinica (clinica_id, tipo, cita_id)
values ('00000000-0000-4000-8000-0000001a0c01', 'reserva_enlace', (select id from _c where nombre = 'correo2'));
select pg_temp.esperar('caso 14', (select (pg_temp.ve('00000000-0000-4000-8000-0000001a0b01') like '%reserva_enlace%')::text
  || (pg_temp.ve('00000000-0000-4000-8000-0000001a0b02') like '%reserva_enlace%')::text || (pg_temp.ve('00000000-0000-4000-8000-0000001a0b04') like '%reserva_enlace%')::text
  || (pg_temp.ve('00000000-0000-4000-8000-0000001a0b06') like '%reserva_enlace%')::text), 'truetruetruefalse');

-- ── Caso 15: la forma. Tipo ↔ cita, y ningún privilegio de más ─────────
do $$
begin
  insert into public.avisos_clinica (clinica_id, tipo) values ('00000000-0000-4000-8000-0000001a0c01', 'reserva_enlace');
  raise exception 'AV1 caso 15: admitió un aviso de cita sin cita';
exception when check_violation then null;
end $$;
do $$
begin
  insert into public.avisos_clinica (clinica_id, tipo, cita_id) values ('00000000-0000-4000-8000-0000001a0c01', 'google_desconectado', gen_random_uuid());
  raise exception 'AV1 caso 15: admitió un aviso sin cita con cita';
exception when check_violation then null;
end $$;
select pg_temp.esperar('caso 15 privilegios', (select string_agg(r || ':' || p, ',' order by r, p)
  from unnest(array['anon', 'authenticated', 'service_role']) r cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
  where has_table_privilege(r, 'public.avisos_clinica', p)), 'authenticated:SELECT');
-- Realtime no se toca: la campana relee, no escucha (decisión de Angel).
select pg_temp.esperar('caso 15 fuera de Realtime', (select count(*)::text from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'avisos_clinica'), '0');

-- ── Caso 16: «REVISADO» POR USUARIO. Que uno lo vea no se lo quita a nadie; un hecho nuevo lo reabre ──
-- (los dos avisos del caso 4, de toda la clínica: los tienen pendientes el administrador y la secretaria.)
select pg_temp.esperar('caso 16 antes', pg_temp.pend('00000000-0000-4000-8000-0000001a0b01') || ' / ' || pg_temp.pend('00000000-0000-4000-8000-0000001a0b04'),
  'cancelacion_paciente,confirmacion_paciente / cancelacion_paciente,confirmacion_paciente');
select pg_temp.esperar('caso 16 la secretaria marca la confirmación', pg_temp.marca('00000000-0000-4000-8000-0000001a0b04', 'confirmacion_paciente'), '1');
select pg_temp.esperar('caso 16 a ella se le va; al administrador no', pg_temp.pend('00000000-0000-4000-8000-0000001a0b04') || ' / ' || pg_temp.pend('00000000-0000-4000-8000-0000001a0b01'),
  'cancelacion_paciente / cancelacion_paciente,confirmacion_paciente');
select pg_temp.esperar('caso 16 nadie cerró el aviso para todos', (select count(*)::text from public.avisos_clinica where tipo = 'confirmacion_paciente' and revisado_en is not null), '0');
-- Otro hecho del mismo tipo y cita (el paciente vuelve a confirmar): no nace otro aviso, el mismo se REABRE para quien ya lo vio.
update public.appointments set status = 'scheduled' where id = (select id from _c where nombre = 'rsvp_si');
select pg_temp.google('google_rsvp', (select id from _c where nombre = 'rsvp_si'), 'confirmed');
select pg_temp.esperar('caso 16 sigue siendo uno', (select count(*)::text from public.avisos_clinica where cita_id = (select id from _c where nombre = 'rsvp_si')), '1');
select pg_temp.esperar('caso 16 reabierto para la secretaria', pg_temp.pend('00000000-0000-4000-8000-0000001a0b04'), 'cancelacion_paciente,confirmacion_paciente');
-- Un escritor de F4 (ON CONFLICT DO NOTHING, sin tocar) también reabre: la reserva por enlace del caso 14.
select pg_temp.esperar('caso 16 F4: lo marca', (select count(*)::text from (select pg_temp.marca('00000000-0000-4000-8000-0000001a0b04', 'reserva_enlace')) x), '1');
insert into public.avisos_clinica (clinica_id, tipo, cita_id)
values ('00000000-0000-4000-8000-0000001a0c01', 'reserva_enlace', (select id from _c where nombre = 'correo2'))
on conflict (tipo, cita_id) where revisado_en is null do nothing;
select pg_temp.esperar('caso 16 F4: uno, y más nuevo que su marca', (select count(*)::text || '|' || bool_and(a.creado_en > v.visto_en)::text
  from public.avisos_clinica a join public.avisos_vistos v on v.aviso_id = a.id where a.tipo = 'reserva_enlace'), '1|true');
-- Nadie marca por otro, ni un aviso que no ve; el error es el mismo exista o no el aviso.
do $$
declare v_dirigido uuid := (select id from public.avisos_clinica where tipo = 'personal_desbloqueo' limit 1);
        v_caso record;
begin
  for v_caso in select * from (values
      ('por otra persona',          '00000000-0000-4000-8000-0000001a0b04'::uuid, (select id from public.avisos_clinica where tipo = 'cancelacion_paciente' limit 1), '00000000-0000-4000-8000-0000001a0b01'::uuid, '00000000-0000-4000-8000-0000001a0c01'::uuid),
      ('un aviso dirigido a otro',  '00000000-0000-4000-8000-0000001a0b04', v_dirigido, '00000000-0000-4000-8000-0000001a0b04', '00000000-0000-4000-8000-0000001a0c01'),
      ('desde otra clínica',        '00000000-0000-4000-8000-0000001a0b03', v_dirigido, '00000000-0000-4000-8000-0000001a0b03', '00000000-0000-4000-8000-0000001a0c02'),
      ('con la clínica de otro',    '00000000-0000-4000-8000-0000001a0b03', v_dirigido, '00000000-0000-4000-8000-0000001a0b03', '00000000-0000-4000-8000-0000001a0c01'),
      ('un aviso que no existe',    '00000000-0000-4000-8000-0000001a0b04', gen_random_uuid(), '00000000-0000-4000-8000-0000001a0b04', '00000000-0000-4000-8000-0000001a0c01')
    ) t(caso, sesion, aviso, usuario, clinica) loop
    begin
      perform pg_temp.como(v_caso.sesion);
      set local role authenticated;
      insert into public.avisos_vistos (aviso_id, usuario_id, clinica_id) values (v_caso.aviso, v_caso.usuario, v_caso.clinica);
      reset role;
      raise exception 'AV1 caso 16: se pudo marcar %', v_caso.caso;
    exception when insufficient_privilege or check_violation then reset role;
    end;
  end loop;
  perform pg_temp.sin_sesion();
end $$;
-- Cada quien lee sólo sus marcas; y nadie borra ni vacía la tabla.
select pg_temp.esperar('caso 16 privilegios', (select string_agg(r || ':' || p, ',' order by r, p)
  from unnest(array['anon', 'authenticated', 'service_role']) r cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
  where has_table_privilege(r, 'public.avisos_vistos', p)), 'authenticated:SELECT');
do $$
declare v integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b01');
  set local role authenticated;
  select count(*) into v from public.avisos_vistos;
  reset role;
  perform pg_temp.sin_sesion();
  perform pg_temp.esperar('caso 16 el administrador no lee las marcas de otros', v::text, '0');
end $$;

-- ── Caso 17: la reserva frenada exige que el «médico» SEA médico (no cualquier perfil de la clínica) ──
do $$
declare v text;
begin
  set local role service_role;
  -- b4 es la secretaria de c1: existe y es de la clínica, pero no es médico.
  v := public.aviso_clinica_registrar('00000000-0000-4000-8000-0000001a0c01', 'reserva_frenada', null, '00000000-0000-4000-8000-0000001a0b04', null, 'Zutano')::text;
  reset role;
  perform pg_temp.esperar('caso 17 respuesta', v, 'false');
  perform pg_temp.esperar('caso 17 sin aviso', (select count(*)::text from public.avisos_clinica where datos ->> 'nombre' = 'Zutano'), '0');
end $$;

-- ── Caso 18: la lectura de la campana está ACOTADA: ventana de 60 días y tope de 500 ──
-- b6 (médico invitado) no tiene nada pendiente de estos tipos. Como postgres, 510 avisos sin cita suyos:
-- 5 de hace 61 días (fuera de la ventana) y 505 recientes, cada uno un segundo más viejo que el anterior.
select pg_temp.esperar('caso 18 antes', (select count(*)::text from public.avisos_clinica where medico_id = '00000000-0000-4000-8000-0000001a0b06'), '0');
insert into public.avisos_clinica (clinica_id, tipo, medico_id, destinatario_id, datos, creado_en)
select '00000000-0000-4000-8000-0000001a0c01', 'personal_bloqueo', '00000000-0000-4000-8000-0000001a0b06', '00000000-0000-4000-8000-0000001a0b06',
       jsonb_build_object('n', n), case when n <= 5 then now() - interval '61 days' else now() - make_interval(secs => n) end
  from generate_series(1, 510) n;
create function pg_temp.pend_b6(p_limite int) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b06');
  set local role authenticated;
  select count(*)::text || ':' || coalesce(min((datos ->> 'n')::int)::text, '-') || ':' || coalesce(max((datos ->> 'n')::int)::text, '-') into v
    from public.avisos_pendientes(array['personal_bloqueo'], p_limite);
  reset role;
  perform pg_temp.sin_sesion();
  return v;
end $$;
-- El límite pedido manda hasta 200; salen los más nuevos (n = 6 es el más nuevo de los recientes).
select pg_temp.esperar('caso 18 los más nuevos', pg_temp.pend_b6(50), '50:6:55');
select pg_temp.esperar('caso 18 tope de la respuesta (200)', pg_temp.pend_b6(1000), '200:6:205');
-- Ve los 500 más nuevos (n de 6 a 505) y los marca vistos: los 5 recientes que quedan detrás (506 a 510)
-- ya no salen (tope de 500), y los 5 de hace 61 días, tampoco (ventana). Nada se borró: siguen en la tabla.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b06');
  set local role authenticated;
  insert into public.avisos_vistos (aviso_id, usuario_id, clinica_id)
  select a.id, '00000000-0000-4000-8000-0000001a0b06', a.clinica_id from public.avisos_clinica a
   where a.medico_id = '00000000-0000-4000-8000-0000001a0b06' and (a.datos ->> 'n')::int between 6 and 505;
  reset role;
  perform pg_temp.sin_sesion();
end $$;
select pg_temp.esperar('caso 18 visto todo lo que cabe en el tope', pg_temp.pend_b6(50), '0:-:-');
select pg_temp.esperar('caso 18 nada se borra ni se cierra', (select count(*)::text || ':' || count(*) filter (where revisado_en is null)::text
  from public.avisos_clinica where medico_id = '00000000-0000-4000-8000-0000001a0b06'), '510:510');
-- Un aviso viejo que se REABRE (creado_en nuevo) vuelve a entrar en la ventana.
update public.avisos_clinica set creado_en = clock_timestamp() where medico_id = '00000000-0000-4000-8000-0000001a0b06' and (datos ->> 'n')::int = 1;
select pg_temp.esperar('caso 18 reabierto, vuelve', pg_temp.pend_b6(50), '1:1:1');

-- ── Caso 19: lo que la lectura acotada deja fuera SE DICE (avisos_mas_antiguos) ──
create function pg_temp.mas(p_id uuid) returns text language plpgsql as $$
declare v boolean;
begin
  perform pg_temp.como(p_id);
  set local role authenticated;
  v := public.avisos_mas_antiguos(array['personal_bloqueo', 'google_desconectado', 'google_sin_sincronizar']);
  reset role;
  perform pg_temp.sin_sesion();
  return v::text;
end $$;
-- b6 tiene 506 avisos suyos dentro de la ventana (caso 18): pasa del tope de 500.
select pg_temp.esperar('caso 19 el tope se dice', pg_temp.mas('00000000-0000-4000-8000-0000001a0b06'), 'true');
-- El administrador no ve los de b6 (van dirigidos): de estos tipos sólo los dos de Google del caso 8, recientes.
select pg_temp.esperar('caso 19 sin nada fuera', pg_temp.mas('00000000-0000-4000-8000-0000001a0b01'), 'false');
-- Uno suyo sale de la ventana (61 días) sin haberlo visto: se dice. Al verlo, deja de decirse.
update public.avisos_clinica set creado_en = now() - interval '61 days' where tipo = 'google_desconectado' and clinica_id = '00000000-0000-4000-8000-0000001a0c01';
select pg_temp.esperar('caso 19 la ventana se dice', pg_temp.mas('00000000-0000-4000-8000-0000001a0b01'), 'true');
select pg_temp.esperar('caso 19 la secretaria también lo tiene sin ver', pg_temp.mas('00000000-0000-4000-8000-0000001a0b04'), 'true');
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b01');
  set local role authenticated;
  insert into public.avisos_vistos (aviso_id, usuario_id, clinica_id)
  select a.id, '00000000-0000-4000-8000-0000001a0b01', a.clinica_id from public.avisos_clinica a where a.tipo = 'google_desconectado';
  reset role;
  perform pg_temp.sin_sesion();
end $$;
select pg_temp.esperar('caso 19 visto, ya no se dice', pg_temp.mas('00000000-0000-4000-8000-0000001a0b01'), 'false');
select pg_temp.esperar('caso 19 que uno lo vea no se lo quita a otro', pg_temp.mas('00000000-0000-4000-8000-0000001a0b04'), 'true');
-- Más de 120 días: deja de anunciarse (la búsqueda está acotada), y sigue en la tabla.
update public.avisos_clinica set creado_en = now() - interval '121 days' where tipo = 'google_desconectado' and clinica_id = '00000000-0000-4000-8000-0000001a0c01';
select pg_temp.esperar('caso 19 más de 120 días no se anuncia', pg_temp.mas('00000000-0000-4000-8000-0000001a0b04'), 'false');
-- Sólo la sesión: ni anon ni service_role la ejecutan.
select pg_temp.esperar('caso 19 privilegios', has_function_privilege('anon', 'public.avisos_mas_antiguos(text[])', 'EXECUTE')::text
  || has_function_privilege('authenticated', 'public.avisos_mas_antiguos(text[])', 'EXECUTE')::text
  || has_function_privilege('service_role', 'public.avisos_mas_antiguos(text[])', 'EXECUTE')::text, 'falsetruefalse');

-- ── Caso 20: «Marcar todos como revisados» (avisos_revisar_todos → avisos_vistos_hasta) ──
-- b6 sigue con lo del caso 18/19: el tope se anuncia (caso 19). Un solo gesto lo resuelve TODO,
-- también lo que la lista no enseñaba; lo que se reabre DESPUÉS vuelve; y es sólo suyo.
create function pg_temp.revisar_todos(p_id uuid, p_hasta timestamptz) returns text language plpgsql as $$
declare v boolean;
begin
  perform pg_temp.como(p_id);
  set local role authenticated;
  v := public.avisos_revisar_todos(p_hasta);
  reset role;
  perform pg_temp.sin_sesion();
  return v::text;
end $$;
update public.avisos_clinica set creado_en = now() - interval '61 days' where tipo = 'google_desconectado' and clinica_id = '00000000-0000-4000-8000-0000001a0c01';
select pg_temp.esperar('caso 20 antes: b6 tiene algo fuera de la lista', pg_temp.mas('00000000-0000-4000-8000-0000001a0b06'), 'true');
select pg_temp.esperar('caso 20 el gesto', pg_temp.revisar_todos('00000000-0000-4000-8000-0000001a0b06', null), 'true');
select pg_temp.esperar('caso 20 después: nada pendiente', pg_temp.pend_b6(50), '0:-:-');
select pg_temp.esperar('caso 20 después: nada fuera', pg_temp.mas('00000000-0000-4000-8000-0000001a0b06'), 'false');
select pg_temp.esperar('caso 20 no se escribió una fila por aviso', (select count(*)::text from public.avisos_vistos_hasta where usuario_id = '00000000-0000-4000-8000-0000001a0b06'), '1');
-- Sólo suyo: la secretaria sigue teniendo el de Google sin ver (61 días: fuera de la lista, se anuncia).
select pg_temp.esperar('caso 20 que uno marque todo no se lo quita a otro', pg_temp.mas('00000000-0000-4000-8000-0000001a0b04'), 'true');
-- Un hecho nuevo DESPUÉS del gesto reabre (creado_en nuevo): vuelve a estar pendiente.
update public.avisos_clinica set creado_en = clock_timestamp() where medico_id = '00000000-0000-4000-8000-0000001a0b06' and (datos ->> 'n')::int = 2;
select pg_temp.esperar('caso 20 lo reabierto después vuelve', pg_temp.pend_b6(50), '1:2:2');
-- p_hasta: marcar «hasta lo que tenía a la vista» no marca lo que llegó después; y la marca nunca
-- va hacia atrás ni al futuro.
select pg_temp.revisar_todos('00000000-0000-4000-8000-0000001a0b06', now() - interval '1 day');
select pg_temp.esperar('caso 20 nunca hacia atrás', pg_temp.pend_b6(50), '1:2:2');
select pg_temp.revisar_todos('00000000-0000-4000-8000-0000001a0b06', now() + interval '10 years');
select pg_temp.esperar('caso 20 nunca al futuro', (select (hasta <= clock_timestamp())::text from public.avisos_vistos_hasta
  where usuario_id = '00000000-0000-4000-8000-0000001a0b06'), 'true');
-- La sesión sólo ve y escribe LA SUYA; ni anon ni service_role la tocan.
do $$
declare v integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000001a0b04');
  set local role authenticated;
  select count(*) into v from public.avisos_vistos_hasta;
  update public.avisos_vistos_hasta set hasta = now() where usuario_id = '00000000-0000-4000-8000-0000001a0b06';
  reset role;
  perform pg_temp.sin_sesion();
  perform pg_temp.esperar('caso 20 no ve la de otro', v::text, '0');
  begin
    perform pg_temp.como('00000000-0000-4000-8000-0000001a0b04');
    set local role authenticated;
    insert into public.avisos_vistos_hasta (usuario_id, clinica_id) values ('00000000-0000-4000-8000-0000001a0b06', '00000000-0000-4000-8000-0000001a0c01');
    reset role;
    raise exception 'AV1 caso 20: la secretaria escribió la marca de otro';
  exception when insufficient_privilege then reset role; perform pg_temp.sin_sesion();
  end;
end $$;
select pg_temp.esperar('caso 20 privilegios del gesto', has_function_privilege('anon', 'public.avisos_revisar_todos(timestamptz)', 'EXECUTE')::text
  || has_function_privilege('authenticated', 'public.avisos_revisar_todos(timestamptz)', 'EXECUTE')::text
  || has_function_privilege('service_role', 'public.avisos_revisar_todos(timestamptz)', 'EXECUTE')::text
  || has_table_privilege('anon', 'public.avisos_vistos_hasta', 'SELECT')::text
  || has_table_privilege('authenticated', 'public.avisos_vistos_hasta', 'DELETE')::text, 'falsetruefalsefalsefalse');

rollback;
