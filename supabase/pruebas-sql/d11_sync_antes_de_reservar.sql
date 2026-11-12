-- Agenda D11 — frescura de la sincronización y avisos de empalme con
-- reservas por enlace (20261116120000_agenda_d11_sync_antes_de_reservar.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1: encendida (médicos b1 y b4). c2: encendida (b2). c3: APAGADA (b3).
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values
  ('00000000-0000-4000-8000-000000d1c001', 'D11 uno', true, 'free'),
  ('00000000-0000-4000-8000-000000d1c002', 'D11 dos', true, 'free'),
  ('00000000-0000-4000-8000-000000d1c003', 'D11 apagada', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000d1b001'::uuid, 'd11-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000d1b002'::uuid, 'd11-b2@prueba.local'),
               ('00000000-0000-4000-8000-000000d1b003'::uuid, 'd11-b3@prueba.local'),
               ('00000000-0000-4000-8000-000000d1b004'::uuid, 'd11-b4@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d1c001', es_admin_de_clinica = true
 where id in ('00000000-0000-4000-8000-000000d1b001', '00000000-0000-4000-8000-000000d1b004');
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d1c002', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-000000d1b002';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d1c003', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-000000d1b003';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000d1c001', true), ('00000000-0000-4000-8000-000000d1c002', true),
  ('00000000-0000-4000-8000-000000d1c003', false);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'D11 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
-- Como service_role (la única que puede): la llamada que hace el código.
create function pg_temp.registrar(p_clinica uuid, p_citas uuid[]) returns integer language plpgsql as $$
declare v integer;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  v := public.reserva_empalmes_registrar(p_clinica, p_citas);
  reset role;
  return v;
end $$;
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values ('v1-prueba-d11', pg_temp.h('aviso-d11'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-000000d1e001', '00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1b001', 'fijo', pg_temp.h('d11-f1')),
  ('00000000-0000-4000-8000-000000d1e002', '00000000-0000-4000-8000-000000d1c002', '00000000-0000-4000-8000-000000d1b002', 'fijo', pg_temp.h('d11-f2')),
  ('00000000-0000-4000-8000-000000d1e003', '00000000-0000-4000-8000-000000d1c003', '00000000-0000-4000-8000-000000d1b003', 'fijo', pg_temp.h('d11-f3'));

-- Reservas por enlace: r1 (c1, b1, +2 d 10:00-10:30), r2 (c1, b1, PASADA),
-- r3 (c2, b2, +2 d), r4 (c3 apagada, b3, +2 d), r5 (c1, b1, +2 d, CANCELADA).
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
select x.id, x.clinica, null, x.medico, 'Persona D11', x.ini, x.ini + interval '30 min', x.estado,
       x.enlace, 'fijo', 'Persona D11', '5500000011', 'd11@prueba.local',
       pg_temp.h('t:' || x.id), pg_temp.h('c:' || x.id), 'v1-prueba-d11', now(), 0
  from (values
    ('00000000-0000-4000-8000-000000d1a001'::uuid, '00000000-0000-4000-8000-000000d1c001'::uuid, '00000000-0000-4000-8000-000000d1b001'::uuid,
     date_trunc('day', now()) + interval '2 days 10 hours', 'scheduled', '00000000-0000-4000-8000-000000d1e001'::uuid),
    ('00000000-0000-4000-8000-000000d1a002', '00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1b001',
     now() - interval '3 hours', 'scheduled', '00000000-0000-4000-8000-000000d1e001'),
    ('00000000-0000-4000-8000-000000d1a003', '00000000-0000-4000-8000-000000d1c002', '00000000-0000-4000-8000-000000d1b002',
     date_trunc('day', now()) + interval '2 days 10 hours', 'scheduled', '00000000-0000-4000-8000-000000d1e002'),
    ('00000000-0000-4000-8000-000000d1a004', '00000000-0000-4000-8000-000000d1c003', '00000000-0000-4000-8000-000000d1b003',
     date_trunc('day', now()) + interval '2 days 10 hours', 'scheduled', '00000000-0000-4000-8000-000000d1e003'),
    ('00000000-0000-4000-8000-000000d1a005', '00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1b001',
     date_trunc('day', now()) + interval '2 days 12 hours', 'cancelled', '00000000-0000-4000-8000-000000d1e001')
  ) x(id, clinica, medico, ini, estado, enlace);

-- Eventos «de Google» (sin paciente). g1 se empalma con r1 · g2 otro médico ·
-- g3 cancelado · g5 justo al acabar r1 (10:30, no se empalma) · g6 con r2
-- (pasada) · g7 de c2 con r3 · g8 de c3 con r4 · g9 con r5 (cancelada) ·
-- g10 se empalma con r1, como el g1.
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status, origen)
select x.id, x.clinica, null, x.medico, 'Evento D11', x.ini, x.fin, x.estado, 'google'
  from (values
    ('00000000-0000-4000-8000-000000d1a101'::uuid, '00000000-0000-4000-8000-000000d1c001'::uuid, '00000000-0000-4000-8000-000000d1b001'::uuid,
     date_trunc('day', now()) + interval '2 days 10 hours 15 min', date_trunc('day', now()) + interval '2 days 11 hours', 'scheduled'),
    ('00000000-0000-4000-8000-000000d1a102', '00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1b004',
     date_trunc('day', now()) + interval '2 days 10 hours', date_trunc('day', now()) + interval '2 days 11 hours', 'scheduled'),
    ('00000000-0000-4000-8000-000000d1a103', '00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1b001',
     date_trunc('day', now()) + interval '2 days 10 hours', date_trunc('day', now()) + interval '2 days 11 hours', 'cancelled'),
    ('00000000-0000-4000-8000-000000d1a105', '00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1b001',
     date_trunc('day', now()) + interval '2 days 10 hours 30 min', date_trunc('day', now()) + interval '2 days 11 hours', 'scheduled'),
    ('00000000-0000-4000-8000-000000d1a106', '00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1b001',
     now() - interval '3 hours', now() - interval '2 hours', 'scheduled'),
    ('00000000-0000-4000-8000-000000d1a107', '00000000-0000-4000-8000-000000d1c002', '00000000-0000-4000-8000-000000d1b002',
     date_trunc('day', now()) + interval '2 days 10 hours', date_trunc('day', now()) + interval '2 days 11 hours', 'scheduled'),
    ('00000000-0000-4000-8000-000000d1a108', '00000000-0000-4000-8000-000000d1c003', '00000000-0000-4000-8000-000000d1b003',
     date_trunc('day', now()) + interval '2 days 10 hours', date_trunc('day', now()) + interval '2 days 11 hours', 'scheduled'),
    ('00000000-0000-4000-8000-000000d1a109', '00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1b001',
     date_trunc('day', now()) + interval '2 days 12 hours', date_trunc('day', now()) + interval '2 days 13 hours', 'scheduled'),
    ('00000000-0000-4000-8000-000000d1a110', '00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1b001',
     date_trunc('day', now()) + interval '2 days 9 hours 45 min', date_trunc('day', now()) + interval '2 days 10 hours 5 min', 'scheduled')
  ) x(id, clinica, medico, ini, fin, estado);

-- ── Caso 1: un par nuevo, auditado; lo que no se empalma no cuenta ──
select pg_temp.esperar('caso 1 (pares nuevos)', pg_temp.registrar('00000000-0000-4000-8000-000000d1c001',
  array['00000000-0000-4000-8000-000000d1a101', '00000000-0000-4000-8000-000000d1a102', '00000000-0000-4000-8000-000000d1a103',
        '00000000-0000-4000-8000-000000d1a105', '00000000-0000-4000-8000-000000d1a106', '00000000-0000-4000-8000-000000d1a109']::uuid[])::text, '1');
select pg_temp.esperar('caso 1 (fila)', (select string_agg(cita_reserva_id || '>' || cita_otra_id || '@' || clinica_id, ',')
  from public.reserva_empalmes_google where clinica_id in ('00000000-0000-4000-8000-000000d1c001', '00000000-0000-4000-8000-000000d1c002')),
  '00000000-0000-4000-8000-000000d1a001>00000000-0000-4000-8000-000000d1a101@00000000-0000-4000-8000-000000d1c001');
select pg_temp.esperar('caso 1 (auditoría)', (select count(*)::text || ':' || min(user_id) || ':' || min(registro_id::text)
  from public.audit_log where accion = 'reserva_empalme_google' and descripcion like '%000000d1c001%'),
  '1:system:00000000-0000-4000-8000-000000d1a001');
select pg_temp.esperar('caso 1 (auditoría sin datos personales)', (select count(*)::text from public.audit_log
  where accion = 'reserva_empalme_google' and (descripcion like '%Persona%' or descripcion like '%5500000011%' or descripcion like '%@%')), '0');

-- ── Caso 2: resincronizar no repite (ni el par ni la auditoría) ──
select pg_temp.esperar('caso 2 (repetido)', pg_temp.registrar('00000000-0000-4000-8000-000000d1c001',
  array['00000000-0000-4000-8000-000000d1a101']::uuid[])::text, '0');
select pg_temp.esperar('caso 2 (auditoría)', (select count(*)::text from public.audit_log
  where accion = 'reserva_empalme_google' and descripcion like '%000000d1c001%'), '1');

-- ── Caso 3: la RESERVA movida (D4 acepta su hora desde Google): avisa sólo
--    del par que faltaba (g10); el de g1 ya estaba. Después, g10 no repite ──
select pg_temp.esperar('caso 3 (la reserva movida)', pg_temp.registrar('00000000-0000-4000-8000-000000d1c001',
  array['00000000-0000-4000-8000-000000d1a001']::uuid[])::text, '1');
select pg_temp.esperar('caso 3 (g10 ya avisado)', pg_temp.registrar('00000000-0000-4000-8000-000000d1c001',
  array['00000000-0000-4000-8000-000000d1a110']::uuid[])::text, '0');
select pg_temp.esperar('caso 3 (auditoría)', (select count(*)::text from public.audit_log
  where accion = 'reserva_empalme_google' and descripcion like '%000000d1c001%'), '2');

-- ── Caso 4: otra clínica: las citas de c2 no cuentan para c1, sí para c2 ──
select pg_temp.esperar('caso 4 (c1 con cita de c2)', pg_temp.registrar('00000000-0000-4000-8000-000000d1c001',
  array['00000000-0000-4000-8000-000000d1a107']::uuid[])::text, '0');
select pg_temp.esperar('caso 4 (c2)', pg_temp.registrar('00000000-0000-4000-8000-000000d1c002',
  array['00000000-0000-4000-8000-000000d1a107']::uuid[])::text, '1');
select pg_temp.esperar('caso 4 (clínica de la fila)', (select clinica_id::text from public.reserva_empalmes_google
  where cita_otra_id = '00000000-0000-4000-8000-000000d1a107'), '00000000-0000-4000-8000-000000d1c002');

-- ── Caso 5: interruptor apagado y lista vacía → 0 sin escribir ──
select pg_temp.esperar('caso 5 (apagada)', pg_temp.registrar('00000000-0000-4000-8000-000000d1c003',
  array['00000000-0000-4000-8000-000000d1a108']::uuid[])::text, '0');
select pg_temp.esperar('caso 5 (vacía)', pg_temp.registrar('00000000-0000-4000-8000-000000d1c001', array[]::uuid[])::text, '0');
select pg_temp.esperar('caso 5 (sin filas de c3)', (select count(*)::text from public.reserva_empalmes_google
  where clinica_id = '00000000-0000-4000-8000-000000d1c003'), '0');

-- ── Caso 5-bis: dos reservas por enlace empalmadas entre sí → UN par (la de id menor como reserva) ──
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status,
                                 reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo,
                                 reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
select x.id, '00000000-0000-4000-8000-000000d1c001', null, '00000000-0000-4000-8000-000000d1b001', 'Persona D11 bis',
       date_trunc('day', now()) + interval '3 days 10 hours', date_trunc('day', now()) + interval '3 days 10 hours 30 min', 'scheduled',
       '00000000-0000-4000-8000-000000d1e001', 'fijo', 'Persona D11 bis', '5500000012', 'd11bis@prueba.local',
       pg_temp.h('t:' || x.id), pg_temp.h('c:' || x.id), 'v1-prueba-d11', now(), 0
  from (values ('00000000-0000-4000-8000-000000d1a201'::uuid), ('00000000-0000-4000-8000-000000d1a202'::uuid)) x(id);
select pg_temp.esperar('caso 5-bis (un par)', pg_temp.registrar('00000000-0000-4000-8000-000000d1c001',
  array['00000000-0000-4000-8000-000000d1a202']::uuid[])::text, '1');
select pg_temp.esperar('caso 5-bis (orden canónico)', (select cita_reserva_id || '>' || cita_otra_id from public.reserva_empalmes_google
  where cita_reserva_id in ('00000000-0000-4000-8000-000000d1a201', '00000000-0000-4000-8000-000000d1a202')),
  '00000000-0000-4000-8000-000000d1a201>00000000-0000-4000-8000-000000d1a202');
select pg_temp.esperar('caso 5-bis (repetido desde la otra)', pg_temp.registrar('00000000-0000-4000-8000-000000d1c001',
  array['00000000-0000-4000-8000-000000d1a201']::uuid[])::text, '0');

-- ── Caso 6: argumentos inválidos → 22023 (500 ids todavía valen) ──
select pg_temp.esperar('caso 6 (500 ids)', pg_temp.registrar('00000000-0000-4000-8000-000000d1c001',
  array_fill('00000000-0000-4000-8000-000000d1a105'::uuid, array[500]))::text, '0');
do $$
begin
  begin
    perform pg_temp.registrar(null, array[]::uuid[]);
    raise exception 'D11 caso 6: clínica NULL no lanzó';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform pg_temp.registrar('00000000-0000-4000-8000-000000d1c001', array[null]::uuid[]);
    raise exception 'D11 caso 6: id NULL no lanzó';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform pg_temp.registrar('00000000-0000-4000-8000-000000d1c001', array_fill(gen_random_uuid(), array[501]));
    raise exception 'D11 caso 6: 501 ids no lanzó';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- ── Caso 7: frescura ──
do $$
declare v_n integer; v_ok timestamptz; v_ocupada boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select count(*) into v_n from public.gcal_sync_frescura('00000000-0000-4000-8000-000000d1c001');
  reset role;
  perform pg_temp.esperar('caso 7 (sin fila)', v_n::text, '0');
  insert into public.gcal_sync_estado (clinica_id, conexion_id, calendar_id, fase, sync_token, ultima_ok, candado, candado_hasta)
  values ('00000000-0000-4000-8000-000000d1c001', gen_random_uuid(), 'cal-d11', 'incremental', 'tok', now() - interval '5 minutes',
          gen_random_uuid(), now() + interval '30 seconds'),
         ('00000000-0000-4000-8000-000000d1c002', gen_random_uuid(), 'cal-d11-2', 'completa', null, null,
          gen_random_uuid(), now() - interval '1 second');
  set local role service_role;
  select r_ultima_ok, r_ocupada into v_ok, v_ocupada from public.gcal_sync_frescura('00000000-0000-4000-8000-000000d1c001');
  reset role;
  perform pg_temp.esperar('caso 7 (c1)', (v_ok = now() - interval '5 minutes')::text || '/' || v_ocupada::text, 'true/true');
  set local role service_role;
  select r_ultima_ok, r_ocupada into v_ok, v_ocupada from public.gcal_sync_frescura('00000000-0000-4000-8000-000000d1c002');
  reset role;
  -- Candado caducado = libre; nunca terminó una buena = NULL.
  perform pg_temp.esperar('caso 7 (c2)', coalesce(v_ok::text, 'null') || '/' || v_ocupada::text, 'null/false');
end $$;

-- ── Caso 8: anon y authenticated no ejecutan ninguna, ni escriben la tabla ──
do $$
declare v_rol text;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000d1b001', 'role', v_rol)::text, true);
    begin
      execute format('set local role %I', v_rol);
      perform public.reserva_empalmes_registrar('00000000-0000-4000-8000-000000d1c001', array['00000000-0000-4000-8000-000000d1a101']::uuid[]);
      raise exception 'D11 caso 8: % ejecutó registrar', v_rol;
    exception when insufficient_privilege then null;
    end;
    reset role;
    begin
      execute format('set local role %I', v_rol);
      perform public.gcal_sync_frescura('00000000-0000-4000-8000-000000d1c001');
      raise exception 'D11 caso 8: % ejecutó frescura', v_rol;
    exception when insufficient_privilege then null;
    end;
    reset role;
    begin
      execute format('set local role %I', v_rol);
      insert into public.reserva_empalmes_google (clinica_id, cita_reserva_id, cita_otra_id)
      values ('00000000-0000-4000-8000-000000d1c001', gen_random_uuid(), gen_random_uuid());
      raise exception 'D11 caso 8: % insertó en la tabla', v_rol;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
end $$;

-- ── Caso 9: RLS — cada sesión ve sólo los de su clínica; anon, nada ──
do $$
declare v_n text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000d1b001', 'role', 'authenticated')::text, true);
  set local role authenticated;
  select string_agg(cita_otra_id::text, ',' order by cita_otra_id) into v_n from public.reserva_empalmes_google;
  reset role;
  perform pg_temp.esperar('caso 9 (c1)', v_n, '00000000-0000-4000-8000-000000d1a101,00000000-0000-4000-8000-000000d1a110,00000000-0000-4000-8000-000000d1a202');
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000d1b002', 'role', 'authenticated')::text, true);
  set local role authenticated;
  select string_agg(cita_otra_id::text, ',') into v_n from public.reserva_empalmes_google;
  reset role;
  perform pg_temp.esperar('caso 9 (c2)', v_n, '00000000-0000-4000-8000-000000d1a107');
  begin
    set local role anon;
    perform count(*) from public.reserva_empalmes_google;
    raise exception 'D11 caso 9: anon leyó la tabla';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

rollback;
