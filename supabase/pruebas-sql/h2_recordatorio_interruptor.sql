-- Agenda H2 (punto 9) — el recordatorio automático por correo con su propio
-- interruptor por clínica, APAGADO de fábrica
-- (20261120120000_agenda_h2_recordatorio_interruptor.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
-- MUTACIÓN (comprobada en rojo): quitar `AND j.recordatorio_encendido` del
-- listado → «caso 1» (la cita de la clínica apagada sale en el listado).
begin;

-- c1: VIP, v2 encendida, recordatorio de FÁBRICA (sin poner la columna).
-- c2: VIP, v2 encendida, recordatorio encendido. c3: v2 apagada con el recordatorio encendido.
insert into public.clinicas (id, nombre, es_vip_grant, stripe_subscription_id, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-0000000072c1', 'H2 fábrica',   true, null, 'free', false),
  ('00000000-0000-4000-8000-0000000072c2', 'H2 encendido', true, null, 'free', false),
  ('00000000-0000-4000-8000-0000000072c3', 'H2 sin v2',    true, null, 'free', false);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-0000000072a1'::uuid, 'h2-admin1@prueba.local'),
               ('00000000-0000-4000-8000-0000000072b1'::uuid, 'h2-medico1@prueba.local'),
               ('00000000-0000-4000-8000-0000000072d1'::uuid, 'h2-secre1@prueba.local'),
               ('00000000-0000-4000-8000-0000000072a2'::uuid, 'h2-admin2@prueba.local'),
               ('00000000-0000-4000-8000-0000000072a3'::uuid, 'h2-admin3@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000072c1', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000072a1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000072c1' where id = '00000000-0000-4000-8000-0000000072b1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000072c1', role = 'secretaria' where id = '00000000-0000-4000-8000-0000000072d1';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000072c2', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000072a2';
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000072c3', es_admin_de_clinica = true where id = '00000000-0000-4000-8000-0000000072a3';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000000072c1', true);
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida, recordatorio_encendido) values
  ('00000000-0000-4000-8000-0000000072c2', true, true),
  ('00000000-0000-4000-8000-0000000072c3', false, true);
insert into public.pacientes (id, clinica_id, nombre, apellidos, email, activo) values
  ('00000000-0000-4000-8000-0000000072f1', '00000000-0000-4000-8000-0000000072c1', 'Paciente', 'Uno', 'uno.h2@prueba.local', true),
  ('00000000-0000-4000-8000-0000000072f2', '00000000-0000-4000-8000-0000000072c2', 'Paciente', 'Dos', 'dos.h2@prueba.local', true),
  ('00000000-0000-4000-8000-0000000072f3', '00000000-0000-4000-8000-0000000072c3', 'Paciente', 'Tres', 'tres.h2@prueba.local', true);
-- Las tres a +5 h (dentro de la ventana de 24 h).
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day) values
  ('00000000-0000-4000-8000-0000000072e1', '00000000-0000-4000-8000-0000000072c1', '00000000-0000-4000-8000-0000000072f1', '00000000-0000-4000-8000-0000000072a1',
   'Cita 1', now() + interval '5 hours', now() + interval '5 hours 30 min', 'scheduled', false),
  ('00000000-0000-4000-8000-0000000072e2', '00000000-0000-4000-8000-0000000072c2', '00000000-0000-4000-8000-0000000072f2', '00000000-0000-4000-8000-0000000072a2',
   'Cita 2', now() + interval '5 hours', now() + interval '5 hours 30 min', 'scheduled', false),
  ('00000000-0000-4000-8000-0000000072e3', '00000000-0000-4000-8000-0000000072c3', '00000000-0000-4000-8000-0000000072f3', '00000000-0000-4000-8000-0000000072a3',
   'Cita 3', now() + interval '5 hours', now() + interval '5 hours 30 min', 'scheduled', false);

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'H2 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

-- El listado, como lo llama la tarea: service_role. Sólo las citas de ESTA prueba.
create function pg_temp.listadas() returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select string_agg(right(r_cita_id::text, 3), ',' order by r_cita_id) into v
    from public.cita_recordatorios_pendientes(500) where r_cita_id::text like '00000000-0000-4000-8000-0000000072%';
  reset role;
  return coalesce(v, '-');
end $$;

create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

-- ── Caso 1: de fábrica el recordatorio está APAGADO; sólo sale la clínica que lo encendió ──
do $$
begin
  perform pg_temp.esperar('caso 1 fábrica', (select recordatorio_encendido::text from public.agenda_ajustes
                                              where clinica_id = '00000000-0000-4000-8000-0000000072c1'), 'false');
  -- c1 apagado (fábrica) no sale; c2 encendido sí; c3 encendido pero sin v2, no.
  perform pg_temp.esperar('caso 1 listado', pg_temp.listadas(), '2e2');
end $$;

-- ── Caso 2: el administrador lo enciende con su sesión (policy de UPDATE de B1, sin cambio) y entra ──
do $$
declare v_n integer;
begin
  perform pg_temp.como('00000000-0000-4000-8000-0000000072a1');
  set local role authenticated;
  update public.agenda_ajustes set recordatorio_encendido = true where clinica_id = '00000000-0000-4000-8000-0000000072c1';
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.esperar('caso 2 filas', v_n::text, '1');
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.esperar('caso 2 listado', pg_temp.listadas(), '2e1,2e2');
  -- Y queda en audit_log (log_tabla_change), a su nombre.
  perform pg_temp.esperar('caso 2 auditoría', (select count(*)::text from public.audit_log
    where tabla = 'agenda_ajustes' and accion = 'UPDATE' and user_id = '00000000-0000-4000-8000-0000000072a1'), '1');
end $$;

-- ── Caso 3: el médico invitado y la secretaria NO lo pueden cambiar (0 filas) ──
do $$
declare v_quien uuid; v_n integer;
begin
  foreach v_quien in array array['00000000-0000-4000-8000-0000000072b1', '00000000-0000-4000-8000-0000000072d1']::uuid[] loop
    perform pg_temp.como(v_quien);
    set local role authenticated;
    update public.agenda_ajustes set recordatorio_encendido = false where clinica_id = '00000000-0000-4000-8000-0000000072c1';
    get diagnostics v_n = row_count;
    reset role;
    perform pg_temp.esperar('caso 3 ' || v_quien::text, v_n::text, '0');
  end loop;
  -- El administrador de OTRA clínica tampoco.
  perform pg_temp.como('00000000-0000-4000-8000-0000000072a2');
  set local role authenticated;
  update public.agenda_ajustes set recordatorio_encendido = false where clinica_id = '00000000-0000-4000-8000-0000000072c1';
  get diagnostics v_n = row_count;
  reset role;
  perform pg_temp.esperar('caso 3 otra clínica', v_n::text, '0');
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ── Caso 4: apagarlo lo saca del listado ──
update public.agenda_ajustes set recordatorio_encendido = false where clinica_id = '00000000-0000-4000-8000-0000000072c2';
select pg_temp.esperar('caso 4 listado', pg_temp.listadas(), '2e1');

-- ── Caso 5: el comprobante y la confirmación NO dependen del interruptor (c2 ya apagado) ──
do $$
declare v_para text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_para into v_para from public.cita_correo_tomar('00000000-0000-4000-8000-0000000072c2',
    '00000000-0000-4000-8000-0000000072e2', 'confirmacion', gen_random_uuid());
  reset role;
  perform pg_temp.esperar('caso 5 confirmación', v_para, 'dos.h2@prueba.local');
  set local role service_role;
  select r_para into v_para from public.cita_correo_tomar('00000000-0000-4000-8000-0000000072c2',
    '00000000-0000-4000-8000-0000000072e2', 'comprobante', gen_random_uuid());
  reset role;
  perform pg_temp.esperar('caso 5 comprobante', v_para, 'dos.h2@prueba.local');
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ── Caso 6: permisos de la función nueva: sólo service_role ──
do $$
begin
  perform pg_temp.esperar('caso 6 permisos',
    has_function_privilege('anon', 'public.cita_recordatorios_pendientes(integer)', 'EXECUTE')::text || ','
    || has_function_privilege('authenticated', 'public.cita_recordatorios_pendientes(integer)', 'EXECUTE')::text || ','
    || has_function_privilege('service_role', 'public.cita_recordatorios_pendientes(integer)', 'EXECUTE')::text,
    'false,false,true');
end $$;
-- authenticated de verdad recibe 42501.
select pg_temp.como('00000000-0000-4000-8000-0000000072a1');
set local role authenticated;
do $$
begin
  perform public.cita_recordatorios_pendientes(10);
  raise exception 'H2 caso 6: authenticated pudo listar entre clínicas';
exception when insufficient_privilege then null;
end $$;
reset role;

rollback;
