-- Agenda G3 — el correo de CONFIRMACIÓN de Spinus registrado en cita_correos
-- (20261119140000_agenda_g3_correo_confirmacion.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
-- MUTACIÓN (comprobada en rojo): correr este archivo contra la base SIN la
-- migración (la cita_correo_tomar de E4) → «caso 1» da 22023; quitar
-- 'confirmacion' sólo de la lista de cita_correo_tomar → «caso 1» igual;
-- exigir la ventana del recordatorio también a la confirmación
-- (`p_tipo = 'comprobante' OR …`) → «caso 1» (la cita a +5 días no se toma).
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- g1: VIP, encendida, N = 24. g2: VIP con el interruptor APAGADO.
insert into public.clinicas (id, nombre, es_vip_grant, stripe_subscription_id, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-000000063c01', 'G3 VIP',     true, null, 'free', false),
  ('00000000-0000-4000-8000-000000063c02', 'G3 apagada', true, null, 'free', false);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000063b01'::uuid, 'g3-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000063b02'::uuid, 'g3-b2@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000063c01', es_admin_de_clinica = true,
                           titulo = 'Dra.', nombres = 'Ana', apellido_paterno = 'Prueba', apellido_materno = null
 where id = '00000000-0000-4000-8000-000000063b01';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000063c02', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000063b02';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida, recordatorio_horas) values
  ('00000000-0000-4000-8000-000000063c01', true, 24),
  ('00000000-0000-4000-8000-000000063c02', false, 24);
insert into public.pacientes (id, clinica_id, nombre, apellidos, email, activo) values
  ('00000000-0000-4000-8000-000000063f01', '00000000-0000-4000-8000-000000063c01', 'Paciente', 'Uno', 'uno.g3@prueba.local', true),
  ('00000000-0000-4000-8000-000000063f02', '00000000-0000-4000-8000-000000063c01', 'Paciente', 'Sin correo', null, true),
  ('00000000-0000-4000-8000-000000063f03', '00000000-0000-4000-8000-000000063c02', 'Paciente', 'Apagada', 'apagada.g3@prueba.local', true);

create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'G3 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

-- Citas: a01 +5 días (fuera de la ventana del recordatorio) · a02 +3 h (dentro) ·
-- a03 cancelada · a04 todo el día · a05 pasada · a06 sin correo · a07 sin paciente ·
-- a08 de la clínica apagada · a09 atendida · a10 confirmada +2 días.
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day,
                                 consultorio_timezone, consultorio_nombre, consultorio_direccion, consultorio_telefono) values
  ('00000000-0000-4000-8000-000000063a01', '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063f01', '00000000-0000-4000-8000-000000063b01',
   'Cita 1', now() + interval '5 days', now() + interval '5 days 30 min', 'scheduled', false, 'America/Merida', 'Consultorio G3', 'Calle 3, Centro', '9990000000'),
  ('00000000-0000-4000-8000-000000063a02', '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063f01', '00000000-0000-4000-8000-000000063b01',
   'Cita 2', now() + interval '3 hours', now() + interval '3 hours 30 min', 'scheduled', false, null, null, null, null),
  ('00000000-0000-4000-8000-000000063a03', '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063f01', '00000000-0000-4000-8000-000000063b01',
   'Cita 3', now() + interval '2 days', now() + interval '2 days 30 min', 'cancelled', false, null, null, null, null),
  ('00000000-0000-4000-8000-000000063a04', '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063f01', '00000000-0000-4000-8000-000000063b01',
   'Cita 4', (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '3 days') at time zone 'America/Mexico_City',
             (date_trunc('day', now() at time zone 'America/Mexico_City') + interval '4 days') at time zone 'America/Mexico_City',
   'scheduled', true, 'America/Mexico_City', null, null, null),
  ('00000000-0000-4000-8000-000000063a05', '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063f01', '00000000-0000-4000-8000-000000063b01',
   'Cita 5', now() - interval '2 hours', now() - interval '1 hour', 'scheduled', false, null, null, null, null),
  ('00000000-0000-4000-8000-000000063a06', '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063f02', '00000000-0000-4000-8000-000000063b01',
   'Cita 6', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', false, null, null, null, null),
  ('00000000-0000-4000-8000-000000063a07', '00000000-0000-4000-8000-000000063c01', null, '00000000-0000-4000-8000-000000063b01',
   'Junta', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', false, null, null, null, null),
  ('00000000-0000-4000-8000-000000063a08', '00000000-0000-4000-8000-000000063c02', '00000000-0000-4000-8000-000000063f03', '00000000-0000-4000-8000-000000063b02',
   'Cita 8', now() + interval '2 days', now() + interval '2 days 30 min', 'scheduled', false, null, null, null, null),
  ('00000000-0000-4000-8000-000000063a09', '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063f01', '00000000-0000-4000-8000-000000063b01',
   'Cita 9', now() + interval '2 days', now() + interval '2 days 30 min', 'attended', false, null, null, null, null),
  ('00000000-0000-4000-8000-000000063a10', '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063f01', '00000000-0000-4000-8000-000000063b01',
   'Cita 10', now() + interval '2 days', now() + interval '2 days 30 min', 'confirmed', false, null, null, null, null);

-- Llamadas como el servidor: service_role, sin sub (como e4_correos_cita.sql).
create function pg_temp.tomar(p_clinica uuid, p_cita uuid, p_tipo text, p_testigo uuid)
returns table (r_envio_id uuid, r_para text, r_inicio timestamptz, r_fin timestamptz, r_zona text,
               r_estado text, r_medico jsonb, r_consultorio jsonb) language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  return query select * from public.cita_correo_tomar(p_clinica, p_cita, p_tipo, p_testigo);
  reset role;
end $$;
create function pg_temp.toma(p_cita uuid, p_testigo uuid, p_tipo text default 'confirmacion',
                             p_clinica uuid default '00000000-0000-4000-8000-000000063c01') returns uuid language sql as $$
  select r_envio_id from pg_temp.tomar(p_clinica, p_cita, p_tipo, p_testigo);
$$;
create function pg_temp.marcar(p_envio uuid, p_testigo uuid, p_estado text, p_motivo text) returns boolean language plpgsql as $$
declare v boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  v := public.cita_correo_marcar('00000000-0000-4000-8000-000000063c01', p_envio, p_testigo, p_estado, p_motivo);
  reset role;
  return v;
end $$;

-- ── Caso 1: una confirmación se toma para cualquier cita futura (también fuera
--    de la ventana del recordatorio), con lo justo para componer el correo ──
do $$
declare v record;
begin
  select * into v from pg_temp.tomar('00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063a01', 'confirmacion',
                                     '00000000-0000-4000-8000-000000006301');
  perform pg_temp.esperar('caso 1 para', v.r_para, 'uno.g3@prueba.local');
  perform pg_temp.esperar('caso 1 estado', v.r_estado, 'scheduled');
  perform pg_temp.esperar('caso 1 consultorio', (v.r_consultorio ->> 'nombre') || ' / ' || (v.r_consultorio ->> 'direccion'), 'Consultorio G3 / Calle 3, Centro');
  perform pg_temp.esperar('caso 1 médico', v.r_medico ->> 'nombres', 'Ana');
  perform pg_temp.esperar('caso 1 fila', (select tipo || '/' || estado || '/' || intentos from public.cita_correos where id = v.r_envio_id),
                          'confirmacion/enviando/1');
  -- La confirmada también (el correo dirá «avisar que no podré asistir»).
  perform pg_temp.esperar('caso 1 confirmada', (select r_estado from pg_temp.tomar('00000000-0000-4000-8000-000000063c01',
            '00000000-0000-4000-8000-000000063a10', 'confirmacion', gen_random_uuid())), 'confirmed');
end $$;

-- ── Caso 2: UNA por hora de inicio. Ni mientras sale, ni ya enviada ──────
do $$
declare v_envio uuid;
begin
  v_envio := (select id from public.cita_correos where appointment_id = '00000000-0000-4000-8000-000000063a01' and tipo = 'confirmacion');
  perform pg_temp.esperar('caso 2 en curso', pg_temp.toma('00000000-0000-4000-8000-000000063a01', gen_random_uuid())::text, null);
  perform pg_temp.esperar('caso 2 marcar', pg_temp.marcar(v_envio, '00000000-0000-4000-8000-000000006301', 'enviado', null)::text, 'true');
  perform pg_temp.esperar('caso 2 ya enviada', pg_temp.toma('00000000-0000-4000-8000-000000063a01', gen_random_uuid())::text, null);
  -- Reagendada (inicio nuevo): se puede volver a mandar.
  update public.appointments set start_time = start_time + interval '1 day', end_time = end_time + interval '1 day'
   where id = '00000000-0000-4000-8000-000000063a01';
  if pg_temp.toma('00000000-0000-4000-8000-000000063a01', gen_random_uuid()) is null then
    raise exception 'G3 caso 2: tras reagendar no se pudo tomar otra';
  end if;
end $$;

-- ── Caso 3: un fallo del transporte se reintenta (hasta 3); un duplicado, no ──
do $$
declare v_envio uuid; v_t uuid := gen_random_uuid(); v_t2 uuid := gen_random_uuid();
begin
  v_envio := pg_temp.toma('00000000-0000-4000-8000-000000063a10', v_t, 'confirmacion');
  -- (la toma del caso 1 sigue «enviando»: se suelta como si hubieran pasado 10 min)
  if v_envio is null then
    update public.cita_correos set tomado_en = now() - interval '11 minutes'
     where appointment_id = '00000000-0000-4000-8000-000000063a10' and tipo = 'confirmacion';
    v_envio := pg_temp.toma('00000000-0000-4000-8000-000000063a10', v_t, 'confirmacion');
  end if;
  perform pg_temp.esperar('caso 3 marcar fallido', pg_temp.marcar(v_envio, v_t, 'fallido', 'transporte')::text, 'true');
  perform pg_temp.esperar('caso 3 reintento', (pg_temp.toma('00000000-0000-4000-8000-000000063a10', v_t2) = v_envio)::text, 'true');
  perform pg_temp.esperar('caso 3 marcar duplicado', pg_temp.marcar(v_envio, v_t2, 'fallido', 'duplicado')::text, 'true');
  perform pg_temp.esperar('caso 3 tras duplicado', pg_temp.toma('00000000-0000-4000-8000-000000063a10', gen_random_uuid())::text, null);
end $$;

-- ── Caso 4: no se toma (y no se escribe nada) donde no aplica ──────────
do $$
declare v_caso record; n0 integer; n1 integer;
begin
  select count(*) into n0 from public.cita_correos;
  for v_caso in select * from (values
      ('cancelada',     '00000000-0000-4000-8000-000000063c01'::uuid, '00000000-0000-4000-8000-000000063a03'::uuid),
      ('todo el día',   '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063a04'),
      ('pasada',        '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063a05'),
      ('sin correo',    '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063a06'),
      ('sin paciente',  '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063a07'),
      ('atendida',      '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063a09'),
      ('apagada',       '00000000-0000-4000-8000-000000063c02', '00000000-0000-4000-8000-000000063a08'),
      ('otra clínica',  '00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063a08')) t(caso, clinica, cita) loop
    perform pg_temp.esperar('caso 4 ' || v_caso.caso,
      (select r_envio_id::text from pg_temp.tomar(v_caso.clinica, v_caso.cita, 'confirmacion', gen_random_uuid())), null);
  end loop;
  select count(*) into n1 from public.cita_correos;
  perform pg_temp.esperar('caso 4 nada escrito', n1::text, n0::text);
end $$;

-- ── Caso 5: la confirmación NO quita el recordatorio (sólo el comprobante lo hace) ──
do $$
declare v_t uuid := gen_random_uuid(); v_envio uuid;
begin
  v_envio := pg_temp.toma('00000000-0000-4000-8000-000000063a02', v_t, 'confirmacion');
  perform pg_temp.esperar('caso 5 marcar', pg_temp.marcar(v_envio, v_t, 'enviado', null)::text, 'true');
  if pg_temp.toma('00000000-0000-4000-8000-000000063a02', gen_random_uuid(), 'recordatorio') is null then
    raise exception 'G3 caso 5: una confirmación enviada impidió el recordatorio';
  end if;
end $$;

-- ── Caso 6: lo que no cambia: tipo desconocido 22023, CHECK, permisos ──
do $$
begin
  begin
    perform pg_temp.toma('00000000-0000-4000-8000-000000063a02', gen_random_uuid(), 'otro');
    raise exception 'G3 caso 6: aceptó el tipo «otro»';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.cita_correos (clinica_id, appointment_id, tipo, inicio_cita, estado, testigo, tomado_en)
    values ('00000000-0000-4000-8000-000000063c01', '00000000-0000-4000-8000-000000063a02', 'otro', now(), 'enviando', gen_random_uuid(), now());
    raise exception 'G3 caso 6: el CHECK dejó pasar «otro»';
  exception when check_violation then null;
  end;
  perform pg_temp.esperar('caso 6 EXECUTE', has_function_privilege('anon', 'public.cita_correo_tomar(uuid, uuid, text, uuid)', 'EXECUTE')::text
    || ',' || has_function_privilege('authenticated', 'public.cita_correo_tomar(uuid, uuid, text, uuid)', 'EXECUTE')::text
    || ',' || has_function_privilege('service_role', 'public.cita_correo_tomar(uuid, uuid, text, uuid)', 'EXECUTE')::text, 'false,false,true');
  -- La sesión ve QUÉ salió de sus citas (la ruta lo usa para decir «ya se envió»).
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000063b01', 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform pg_temp.esperar('caso 6 la sesión ve sus confirmaciones',
    (select count(*)::text from public.cita_correos where tipo = 'confirmacion' and estado = 'enviado'
        and appointment_id = '00000000-0000-4000-8000-000000063a02'), '1');
  reset role;
end $$;

rollback;
