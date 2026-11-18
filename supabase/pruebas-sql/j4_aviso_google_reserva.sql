-- Agenda tanda J (J4, punto 10) — el aviso «Desde Google no se pueden mover las
-- citas reservadas por enlace» (20261122140000_agenda_j4_aviso_google_reserva.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
-- MUTACIONES (comprobadas en rojo): sin el ON CONFLICT de la RPC (dos sondeos del
-- mismo cambio dejan dos renglones: el INSERT revienta por la UNIQUE); sin el
-- filtro `a.clinica_id = p_clinica_id` (caso 5 registra en la otra clínica).
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1 (v2 encendida): b1 administrador. c2 (v2 encendida): b3 administrador. c3: v2 apagada.
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-000000140c01', 'J4 uno', true, 'free'),
  ('00000000-0000-4000-8000-000000140c02', 'J4 dos', true, 'free'),
  ('00000000-0000-4000-8000-000000140c03', 'J4 tres', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000140b01'::uuid, 'j4-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000140b03'::uuid, 'j4-b3@prueba.local'),
               ('00000000-0000-4000-8000-000000140b05'::uuid, 'j4-b5@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000140c01', es_admin_de_clinica = true, role = 'medico'
 where id = '00000000-0000-4000-8000-000000140b01';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000140c02', es_admin_de_clinica = true, role = 'medico'
 where id = '00000000-0000-4000-8000-000000140b03';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000140c03', es_admin_de_clinica = true, role = 'medico'
 where id = '00000000-0000-4000-8000-000000140b05';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000140c01', true), ('00000000-0000-4000-8000-000000140c02', true),
  ('00000000-0000-4000-8000-000000140c03', false);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'J4 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
-- La RPC como la llama la pasada de sincronización: service_role.
create function pg_temp.registrar(p_clinica uuid, p_cita uuid, p_updated timestamptz) returns text language plpgsql as $$
declare v boolean;
begin
  set local role service_role;
  v := public.cita_movimiento_google_registrar(p_clinica, p_cita, p_updated);
  reset role;
  return v::text;
end $$;
-- Lo que ve una sesión: los avisos sin revisar del tipo nuevo, por cita.
create function pg_temp.ve(p_id uuid) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select coalesce(string_agg(right(cita_id::text, 4), ',' order by cita_id), '-') into v
    from public.avisos_clinica where revisado_en is null and tipo = 'google_movimiento_rechazado';
  reset role;
  return v;
end $$;
grant execute on function pg_temp.esperar(text, text, text) to anon, authenticated, service_role;
create function pg_temp.pendientes(p_cita uuid) returns text language sql as $$
  select count(*)::text from public.avisos_clinica
   where cita_id = p_cita and tipo = 'google_movimiento_rechazado' and revisado_en is null;
$$;
create function pg_temp.todos(p_cita uuid) returns text language sql as $$
  select count(*)::text from public.avisos_clinica where cita_id = p_cita and tipo = 'google_movimiento_rechazado';
$$;

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-j4', pg_temp.h('aviso-j4'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-000000140e01', '00000000-0000-4000-8000-000000140c01', '00000000-0000-4000-8000-000000140b01', 'fijo', pg_temp.h('j4-f1')),
  ('00000000-0000-4000-8000-000000140e03', '00000000-0000-4000-8000-000000140c03', '00000000-0000-4000-8000-000000140b05', 'fijo', pg_temp.h('j4-f3'));

-- a01: reservada por enlace, futura (c1). a02: de Spinus, sin enlace (c1). a03: reservada por
-- enlace, ya empezó (c1). a05: reservada por enlace, futura, en c3 (v2 apagada).
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
values
  ('00000000-0000-4000-8000-000000140a01', '00000000-0000-4000-8000-000000140c01', null, '00000000-0000-4000-8000-000000140b01',
   'Persona J4', date_trunc('day', now()) + interval '2 days 10 hours', date_trunc('day', now()) + interval '2 days 10 hours 30 min',
   'scheduled', '00000000-0000-4000-8000-000000140e01', 'fijo', 'Persona J4', '5500000014', 'j4@prueba.local',
   pg_temp.h('t:j4a01'), pg_temp.h('c:j4a01'), 'v1-prueba-j4', now(), 0),
  ('00000000-0000-4000-8000-000000140a03', '00000000-0000-4000-8000-000000140c01', null, '00000000-0000-4000-8000-000000140b01',
   'Pasada J4', now() - interval '10 min', now() + interval '20 min',
   'scheduled', '00000000-0000-4000-8000-000000140e01', 'fijo', 'Pasada J4', '5500000034', 'j4c@prueba.local',
   pg_temp.h('t:j4a03'), pg_temp.h('c:j4a03'), 'v1-prueba-j4', now(), 0),
  ('00000000-0000-4000-8000-000000140a05', '00000000-0000-4000-8000-000000140c03', null, '00000000-0000-4000-8000-000000140b05',
   'Apagada J4', date_trunc('day', now()) + interval '2 days 11 hours', date_trunc('day', now()) + interval '2 days 11 hours 30 min',
   'scheduled', '00000000-0000-4000-8000-000000140e03', 'fijo', 'Apagada J4', '5500000054', 'j4e@prueba.local',
   pg_temp.h('t:j4a05'), pg_temp.h('c:j4a05'), 'v1-prueba-j4', now(), 0);
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status)
values ('00000000-0000-4000-8000-000000140a02', '00000000-0000-4000-8000-000000140c01', null, '00000000-0000-4000-8000-000000140b01',
        'Junta J4', date_trunc('day', now()) + interval '2 days 12 hours', date_trunc('day', now()) + interval '2 days 13 hours', 'scheduled');

-- ── Caso 1: un intento → un renglón y un aviso del tipo nuevo, en su clínica ─
select pg_temp.esperar('caso 1 · intento nuevo', pg_temp.registrar('00000000-0000-4000-8000-000000140c01',
  '00000000-0000-4000-8000-000000140a01', '2031-05-20T00:00:00Z'), 'true');
select pg_temp.esperar('caso 1 · aviso', (select string_agg(tipo || '@' || right(clinica_id::text, 4), ',') from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000140a01' and tipo = 'google_movimiento_rechazado'), 'google_movimiento_rechazado@0c01');

-- ── Caso 2: el MISMO intento (otro sondeo de la misma página) → nada ──
update public.avisos_clinica set creado_en = now() - interval '1 hour'
 where cita_id = '00000000-0000-4000-8000-000000140a01' and tipo = 'google_movimiento_rechazado';
select pg_temp.esperar('caso 2 · repetido', pg_temp.registrar('00000000-0000-4000-8000-000000140c01',
  '00000000-0000-4000-8000-000000140a01', '2031-05-20T00:00:00Z'), 'false');
select pg_temp.esperar('caso 2 · un renglón', (select count(*)::text from public.gcal_movimientos_rechazados
  where cita_id = '00000000-0000-4000-8000-000000140a01'), '1');
select pg_temp.esperar('caso 2 · el aviso no sube', (select (creado_en < now() - interval '30 min')::text from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000140a01' and tipo = 'google_movimiento_rechazado'), 'true');

-- ── Caso 3: otro intento con el aviso sin revisar → el mismo aviso sube ─
select pg_temp.esperar('caso 3 · intento nuevo', pg_temp.registrar('00000000-0000-4000-8000-000000140c01',
  '00000000-0000-4000-8000-000000140a01', '2031-05-20T00:05:00Z'), 'true');
select pg_temp.esperar('caso 3 · sigue uno', pg_temp.todos('00000000-0000-4000-8000-000000140a01'), '1');
select pg_temp.esperar('caso 3 · subió', (select (creado_en >= now() - interval '1 min')::text from public.avisos_clinica
  where cita_id = '00000000-0000-4000-8000-000000140a01' and tipo = 'google_movimiento_rechazado'), 'true');

-- ── Caso 4: revisado, otro intento → otro aviso ───────────────────────
update public.avisos_clinica set revisado_en = now(), revisado_por = '00000000-0000-4000-8000-000000140b01'
 where cita_id = '00000000-0000-4000-8000-000000140a01' and tipo = 'google_movimiento_rechazado';
select pg_temp.esperar('caso 4 · intento nuevo', pg_temp.registrar('00000000-0000-4000-8000-000000140c01',
  '00000000-0000-4000-8000-000000140a01', '2031-05-20T00:10:00Z'), 'true');
select pg_temp.esperar('caso 4 · dos avisos, uno pendiente', pg_temp.todos('00000000-0000-4000-8000-000000140a01')
  || '/' || pg_temp.pendientes('00000000-0000-4000-8000-000000140a01'), '2/1');

-- ── Caso 5: no aplica → false y nada (otra clínica, sin enlace, empezada, v2 apagada) ─
select pg_temp.esperar('caso 5 · otra clínica', pg_temp.registrar('00000000-0000-4000-8000-000000140c02',
  '00000000-0000-4000-8000-000000140a01', '2031-05-20T00:15:00Z'), 'false');
select pg_temp.esperar('caso 5 · sin enlace', pg_temp.registrar('00000000-0000-4000-8000-000000140c01',
  '00000000-0000-4000-8000-000000140a02', '2031-05-20T00:15:00Z'), 'false');
select pg_temp.esperar('caso 5 · empezada', pg_temp.registrar('00000000-0000-4000-8000-000000140c01',
  '00000000-0000-4000-8000-000000140a03', '2031-05-20T00:15:00Z'), 'false');
select pg_temp.esperar('caso 5 · v2 apagada', pg_temp.registrar('00000000-0000-4000-8000-000000140c03',
  '00000000-0000-4000-8000-000000140a05', '2031-05-20T00:15:00Z'), 'false');
select pg_temp.esperar('caso 5 · nada escrito', (select count(*)::text from public.gcal_movimientos_rechazados
  where cita_id <> '00000000-0000-4000-8000-000000140a01' or clinica_id <> '00000000-0000-4000-8000-000000140c01'), '0');

-- ── Caso 6: argumentos nulos → 22023 ──────────────────────────────────
do $$
begin
  perform pg_temp.registrar('00000000-0000-4000-8000-000000140c01', null, now());
  raise exception 'J4 caso 6: sin cita no lanzó';
exception when sqlstate '22023' then null;
end $$;

-- ── Caso 7: visibilidad por clínica (RLS de avisos_clinica, sin cambios) ─
select pg_temp.esperar('caso 7 · b1 lo ve', pg_temp.ve('00000000-0000-4000-8000-000000140b01'), '0a01');
select pg_temp.esperar('caso 7 · b3 no', pg_temp.ve('00000000-0000-4000-8000-000000140b03'), '-');

-- ── Caso 8: ni la tabla ni la RPC para una sesión (sólo service_role) ─
select pg_temp.esperar('caso 8 · EXECUTE anon/authenticated/service_role',
  has_function_privilege('anon', 'public.cita_movimiento_google_registrar(uuid, uuid, timestamptz)', 'EXECUTE')::text || '/'
  || has_function_privilege('authenticated', 'public.cita_movimiento_google_registrar(uuid, uuid, timestamptz)', 'EXECUTE')::text || '/'
  || has_function_privilege('service_role', 'public.cita_movimiento_google_registrar(uuid, uuid, timestamptz)', 'EXECUTE')::text,
  'false/false/true');
select pg_temp.esperar('caso 8 · tabla para authenticated', has_table_privilege('authenticated', 'public.gcal_movimientos_rechazados', 'SELECT')::text
  || '/' || has_table_privilege('authenticated', 'public.gcal_movimientos_rechazados', 'INSERT')::text
  || '/' || has_table_privilege('anon', 'public.gcal_movimientos_rechazados', 'SELECT')::text, 'false/false/false');
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000140b01', 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.cita_movimiento_google_registrar('00000000-0000-4000-8000-000000140c01',
    '00000000-0000-4000-8000-000000140a01', '2031-05-20T00:20:00Z');
  raise exception 'J4 caso 8: authenticated pudo llamar a la RPC';
exception when insufficient_privilege then reset role;
end $$;

rollback;
