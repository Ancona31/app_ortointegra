-- Agenda tanda L (L5, punto 13) — el aviso «confirmó su cita» cuando el
-- paciente confirma desde su enlace (20261124160000_agenda_l5_aviso_confirmacion_paciente.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback. La confirmación va por la RPC de verdad (cita_confirmacion_responder,
-- como service_role, que es lo que hace POST /api/confirmar/[codigo]).
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1: b1 administrador, b2 médico invitado. c2: otra clínica con la v2 APAGADA.
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-000000160c01', 'L5 uno', true, 'free'),
  ('00000000-0000-4000-8000-000000160c02', 'L5 dos', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000160b01'::uuid, 'l5-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000160b02'::uuid, 'l5-b2@prueba.local'),
               ('00000000-0000-4000-8000-000000160b03'::uuid, 'l5-b3@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000160c01', es_admin_de_clinica = (id::text like '%b01'), role = 'medico'
 where id in ('00000000-0000-4000-8000-000000160b01', '00000000-0000-4000-8000-000000160b02');
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000160c02', es_admin_de_clinica = true, role = 'medico'
 where id = '00000000-0000-4000-8000-000000160b03';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000160c01', true), ('00000000-0000-4000-8000-000000160c02', false);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'L5 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
-- La respuesta del paciente, como la ruta: la RPC con service_role.
create function pg_temp.responde(p_clinica uuid, p_codigo text, p_accion text) returns text language plpgsql as $$
declare v text;
begin
  set local role service_role;
  select r_resultado into v from public.cita_confirmacion_responder(p_clinica, pg_temp.h(p_codigo), p_accion);
  reset role;
  return v;
end $$;
-- Los avisos de confirmación de una cita: «total:sin revisar».
create function pg_temp.avisos(p_cita uuid) returns text language sql as $$
  select count(*)::text || ':' || count(*) filter (where revisado_en is null)::text
    from public.avisos_clinica where tipo = 'confirmacion_paciente' and cita_id = p_cita;
$$;
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text), pg_temp.como(uuid) to anon, authenticated, service_role;

insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-000000160f01', '00000000-0000-4000-8000-000000160c01', 'Paciente', 'Uno'),
  ('00000000-0000-4000-8000-000000160f02', '00000000-0000-4000-8000-000000160c02', 'Paciente', 'Dos');
-- a01 confirma el paciente; a02 la confirma el personal; a03 la cancela el paciente;
-- a04 de la clínica con la v2 apagada; a05 del médico invitado.
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status)
values
  ('00000000-0000-4000-8000-000000160a01', '00000000-0000-4000-8000-000000160c01', '00000000-0000-4000-8000-000000160f01', '00000000-0000-4000-8000-000000160b01',
   'Paciente Uno', date_trunc('day', now()) + interval '3 days 9 hours', date_trunc('day', now()) + interval '3 days 10 hours', 'scheduled'),
  ('00000000-0000-4000-8000-000000160a02', '00000000-0000-4000-8000-000000160c01', '00000000-0000-4000-8000-000000160f01', '00000000-0000-4000-8000-000000160b01',
   'Paciente Uno', date_trunc('day', now()) + interval '4 days 9 hours', date_trunc('day', now()) + interval '4 days 10 hours', 'scheduled'),
  ('00000000-0000-4000-8000-000000160a03', '00000000-0000-4000-8000-000000160c01', '00000000-0000-4000-8000-000000160f01', '00000000-0000-4000-8000-000000160b01',
   'Paciente Uno', date_trunc('day', now()) + interval '5 days 9 hours', date_trunc('day', now()) + interval '5 days 10 hours', 'scheduled'),
  ('00000000-0000-4000-8000-000000160a04', '00000000-0000-4000-8000-000000160c02', '00000000-0000-4000-8000-000000160f02', '00000000-0000-4000-8000-000000160b03',
   'Paciente Dos', date_trunc('day', now()) + interval '3 days 9 hours', date_trunc('day', now()) + interval '3 days 10 hours', 'scheduled'),
  ('00000000-0000-4000-8000-000000160a05', '00000000-0000-4000-8000-000000160c01', '00000000-0000-4000-8000-000000160f01', '00000000-0000-4000-8000-000000160b02',
   'Paciente Uno', date_trunc('day', now()) + interval '6 days 9 hours', date_trunc('day', now()) + interval '6 days 10 hours', 'scheduled');
insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id) values
  ('00000000-0000-4000-8000-000000160d01', '00000000-0000-4000-8000-000000160c01', '00000000-0000-4000-8000-000000160a01', pg_temp.h('l5-c01'), '00000000-0000-4000-8000-000000160f01'),
  ('00000000-0000-4000-8000-000000160d02', '00000000-0000-4000-8000-000000160c01', '00000000-0000-4000-8000-000000160a02', pg_temp.h('l5-c02'), '00000000-0000-4000-8000-000000160f01'),
  ('00000000-0000-4000-8000-000000160d03', '00000000-0000-4000-8000-000000160c01', '00000000-0000-4000-8000-000000160a03', pg_temp.h('l5-c03'), '00000000-0000-4000-8000-000000160f01'),
  ('00000000-0000-4000-8000-000000160d04', '00000000-0000-4000-8000-000000160c02', '00000000-0000-4000-8000-000000160a04', pg_temp.h('l5-c04'), '00000000-0000-4000-8000-000000160f02'),
  ('00000000-0000-4000-8000-000000160d05', '00000000-0000-4000-8000-000000160c01', '00000000-0000-4000-8000-000000160a05', pg_temp.h('l5-c05'), '00000000-0000-4000-8000-000000160f01');

-- ── Caso 1: el paciente confirma por su enlace → UN aviso ─────────────
select pg_temp.esperar('caso 1 respuesta', pg_temp.responde('00000000-0000-4000-8000-000000160c01', 'l5-c01', 'confirmar'), 'confirmada');
select pg_temp.esperar('caso 1 aviso', (select string_agg(tipo || '@' || right(clinica_id::text, 4), ',') from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000160a01'), 'confirmacion_paciente@0c01');

-- ── Caso 2: un segundo POST (ya confirmada) no crea otro ──────────────
select pg_temp.esperar('caso 2 respuesta', pg_temp.responde('00000000-0000-4000-8000-000000160c01', 'l5-c01', 'confirmar'), 'ya_confirmada');
select pg_temp.esperar('caso 2', pg_temp.avisos('00000000-0000-4000-8000-000000160a01'), '1:1');

-- ── Caso 3: cambios posteriores de la cita (hora, Google) no crean otro ──
update public.appointments set start_time = start_time + interval '30 min', end_time = end_time + interval '30 min'
 where id = '00000000-0000-4000-8000-000000160a01';
update public.appointments set gcal_etag = '"l5-etag"', gcal_sync_status = 'synced', google_event_id = 'l5-evento'
 where id = '00000000-0000-4000-8000-000000160a01';
select pg_temp.esperar('caso 3', pg_temp.avisos('00000000-0000-4000-8000-000000160a01'), '1:1');
-- (auditoría L5) revocar el enlace de una confirmada tampoco: el disparador mira sólo respuesta/respondido_en.
update public.cita_confirmaciones set revocado_en = now() where id = '00000000-0000-4000-8000-000000160c01';
select pg_temp.esperar('caso 3 revocar', pg_temp.avisos('00000000-0000-4000-8000-000000160a01'), '1:1');

-- ── Caso 4: la confirmación del personal no avisa (sesión del administrador) ──
do $$
declare v_n integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000160b01');
  set local role authenticated;
  update public.appointments set status = 'confirmed' where id = '00000000-0000-4000-8000-000000160a02';
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.esperar('caso 4 confirmada por el personal', v_n::text, '1');
end $$;
select pg_temp.esperar('caso 4', (select count(*)::text from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-000000160a02'), '0');
-- …y el personal no puede escribir la respuesta del paciente para fingirla.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000160b01');
  set local role authenticated;
  update public.cita_confirmaciones set respuesta = 'confirmo', respondido_en = now() where id = '00000000-0000-4000-8000-000000160d02';
  reset role;
  raise exception 'L5 caso 4: la sesión escribió cita_confirmaciones';
exception when insufficient_privilege then
  reset role;
end $$;

-- ── Caso 5: cancelar por el enlace da el aviso de cancelación, no uno de confirmación ──
select pg_temp.esperar('caso 5 respuesta', pg_temp.responde('00000000-0000-4000-8000-000000160c01', 'l5-c03', 'cancelar'), 'cancelada');
select pg_temp.esperar('caso 5', (select string_agg(tipo, ',' order by tipo) from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000160a03'), 'cancelacion_paciente');
-- …y confirmar primero y cancelar después deja los dos avisos (dos hechos).
select pg_temp.esperar('caso 5 confirma a01 y cancela', pg_temp.responde('00000000-0000-4000-8000-000000160c01', 'l5-c01', 'cancelar'), 'cancelada');
select pg_temp.esperar('caso 5 los dos', (select string_agg(tipo, ',' order by tipo) from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000160a01'), 'cancelacion_paciente,confirmacion_paciente');

-- ── Caso 6: con la v2 apagada no hay confirmación ni aviso ────────────
select pg_temp.esperar('caso 6 respuesta', pg_temp.responde('00000000-0000-4000-8000-000000160c02', 'l5-c04', 'confirmar'), 'invalido');
select pg_temp.esperar('caso 6', (select count(*)::text from public.avisos_clinica where cita_id = '00000000-0000-4000-8000-000000160a04'), '0');

-- ── Caso 7: otra confirmación de verdad (el personal la devolvió a «agendada»):
--    sin revisar el aviso, no se repite; revisado, nace otro ─────────────
select pg_temp.esperar('caso 7 primera', pg_temp.responde('00000000-0000-4000-8000-000000160c01', 'l5-c05', 'confirmar'), 'confirmada');
update public.appointments set status = 'scheduled' where id = '00000000-0000-4000-8000-000000160a05';
select pg_temp.esperar('caso 7 segunda sin revisar', pg_temp.responde('00000000-0000-4000-8000-000000160c01', 'l5-c05', 'confirmar'), 'confirmada');
select pg_temp.esperar('caso 7 sin revisar', pg_temp.avisos('00000000-0000-4000-8000-000000160a05'), '1:1');
do $$
declare v_n integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000160b01');
  set local role authenticated;
  update public.avisos_clinica set revisado_en = now(), revisado_por = '00000000-0000-4000-8000-000000160b01'
   where cita_id = '00000000-0000-4000-8000-000000160a05' and tipo = 'confirmacion_paciente';
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.esperar('caso 7 revisado', v_n::text, '1');
end $$;
update public.appointments set status = 'scheduled' where id = '00000000-0000-4000-8000-000000160a05';
select pg_temp.esperar('caso 7 tercera', pg_temp.responde('00000000-0000-4000-8000-000000160c01', 'l5-c05', 'confirmar'), 'confirmada');
select pg_temp.esperar('caso 7 revisado nace otro', pg_temp.avisos('00000000-0000-4000-8000-000000160a05'), '2:1');

-- ── Caso 8: RLS de siempre. El administrador ve los de su clínica; el
--    invitado, sólo los de SUS citas; otra clínica, ninguno ──────────────
create function pg_temp.ve(p_id uuid) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.como(p_id);
  set local role authenticated;
  select coalesce(string_agg(right(cita_id::text, 4), ',' order by cita_id), '-') into v
    from public.avisos_clinica where revisado_en is null and tipo = 'confirmacion_paciente';
  reset role;
  return v;
end $$;
select pg_temp.esperar('caso 8 admin', pg_temp.ve('00000000-0000-4000-8000-000000160b01'), '0a01,0a05');
select pg_temp.esperar('caso 8 invitado', pg_temp.ve('00000000-0000-4000-8000-000000160b02'), '0a05');
select pg_temp.esperar('caso 8 otra clínica', pg_temp.ve('00000000-0000-4000-8000-000000160b03'), '-');

-- ── Caso 9: auditoría del aviso (log_tabla_change), sin datos personales ──
select pg_temp.esperar('caso 9', (select (count(*) > 0)::text || ':' || count(*) filter (where descripcion like '%Paciente%' or descripcion like '%@%')::text
  from public.audit_log where tabla = 'avisos_clinica'
   and registro_id in (select id from public.avisos_clinica where tipo = 'confirmacion_paciente'
                         and clinica_id = '00000000-0000-4000-8000-000000160c01')), 'true:0');

rollback;
