-- Agenda tanda I, punto 2 — el enlace de UN SOLO USO reserva sin correo
-- (20261121120000_agenda_i2_unico_sin_correo.sql). El fijo sigue exigiendo
-- correo y código; el candado, el bloqueo manual, la ventana, lo de todo el
-- día y el «un solo uso» del único siguen igual.
-- Mutaciones comprobadas en rojo (tanda I, notas_i2.md):
--   · sin la migración (el cuerpo de seg1) → «caso 1» da 22023;
--   · cambiar el seudónimo por uno fijo → «caso 1»;
--   · ignorar el bloqueo manual en el único → «caso 5».
--   (Quitar el `IF p_correo_hmac IS NULL` del fijo NO se ve: sin él la ficha
--   tampoco casa y el resultado es el mismo correo_sin_verificar. Es una
--   defensa redundante, a propósito, y por eso no tiene mutación propia.)
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- ── Datos: c1 VIP encendida, médico b1 con consultorio k1, tipo de 30 min ──
insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-00000a12c001', 'i2 prueba', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-00000a12b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'i2-b1@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-00000a12c001', es_admin_de_clinica = true,
                           nombres = 'Médico', apellido_paterno = 'Idos', especialidad = 'Ortopedia'
 where id = '00000000-0000-4000-8000-00000a12b001';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-00000a12c001', true);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone) values
  ('00000000-0000-4000-8000-00000a12d001', '00000000-0000-4000-8000-00000a12c001', '00000000-0000-4000-8000-00000a12b001',
   'Consultorio i2', 'Idos', 'Calle 2', true, 'America/Mexico_City');
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo) values
  ('00000000-0000-4000-8000-00000a12a001', '00000000-0000-4000-8000-00000a12c001', null, 'Primera vez', 30, true);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values
  ('v1-prueba-i2', pg_temp.h('aviso'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-00000a12f001', '00000000-0000-4000-8000-00000a12c001', '00000000-0000-4000-8000-00000a12b001', 'fijo', pg_temp.h('f1'));

create function pg_temp.t(p_horas integer) returns timestamptz language sql as $$
  select date_trunc('hour', now()) + interval '2 days' + make_interval(hours => p_horas);
$$;
-- Como el servidor (service_role). p_correo NULL = sin correo (los dos argumentos NULL).
create function pg_temp.r(p_hash text, p_inicio timestamptz, p_tel text, p_correo text, p_cliente uuid default gen_random_uuid())
returns table (r_resultado text, r_cita_id uuid, r_inicio timestamptz, r_fin timestamptz, r_historial integer)
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  return query select * from public.reservar_por_enlace('00000000-0000-4000-8000-00000a12c001', p_hash,
    '00000000-0000-4000-8000-00000a12d001', '00000000-0000-4000-8000-00000a12a001', p_inicio, 'Persona Prueba',
    p_tel, case when p_correo is null then null else p_correo || '@prueba.local' end, pg_temp.h('t:' || p_tel),
    case when p_correo is null then null else pg_temp.h('c:' || p_correo) end, null,
    'v1-prueba-i2', pg_temp.h('aviso'), p_cliente);
  reset role;
end $$;
create function pg_temp.res(p_hash text, p_inicio timestamptz, p_tel text, p_correo text) returns text
language sql as $$ select r_resultado from pg_temp.r(p_hash, p_inicio, p_tel, p_correo) $$;
create function pg_temp.unico(p_nombre text) returns text language sql as $$
  insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en)
  values (gen_random_uuid(), '00000000-0000-4000-8000-00000a12c001', '00000000-0000-4000-8000-00000a12b001', 'unico', pg_temp.h(p_nombre), 7, now() + interval '7 days')
  returning codigo_hash;
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'i2 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
-- Integración I: también pg_temp.unico, que llama service_role. Con feature/limites-ajustables (P1) las
-- funciones de postgres nacen sin EXECUTE a PUBLIC, también las de pg_temp.
grant execute on function pg_temp.h(text), pg_temp.t(integer), pg_temp.unico(text), pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

-- ── Caso 1: el ÚNICO sin correo reserva; la fila no tiene correo y sí su seudónimo
--    propio; el enlace queda usado y la reserva auditada ──
do $$
declare v record; f record;
begin
  select * into v from pg_temp.r(pg_temp.unico('u1'), pg_temp.t(10), '5533330001', null);
  perform pg_temp.esperar('caso 1 resultado', v.r_resultado, 'ok');
  select reserva_correo, reserva_correo_hmac, reserva_canal, reserva_telefono into f from public.appointments where id = v.r_cita_id;
  perform pg_temp.esperar('caso 1 sin correo', coalesce(f.reserva_correo, '<null>'), '<null>');
  perform pg_temp.esperar('caso 1 seudónimo', f.reserva_correo_hmac, pg_temp.h('reserva-sin-correo:' || v.r_cita_id::text));
  perform pg_temp.esperar('caso 1 canal y teléfono', f.reserva_canal || '/' || f.reserva_telefono, 'unico/5533330001');
  perform pg_temp.esperar('caso 1 enlace usado', (select (usado_cita_id = v.r_cita_id)::text from public.reserva_enlaces
                                                  where codigo_hash = pg_temp.h('u1')), 'true');
  perform pg_temp.esperar('caso 1 auditada', (select count(*)::text from public.audit_log
                                              where accion = 'cita_reservada_enlace' and registro_id = v.r_cita_id), '1');
end $$;

-- ── Caso 2: dos reservas sin correo no comparten seudónimo (nada automático las junta),
--    y el único sigue siendo de UN solo uso (otro envío: enlace_usado; el mismo: repetida) ──
do $$
declare va record; vb record; v_c uuid := gen_random_uuid(); v_hash text := pg_temp.unico('u2');
begin
  select * into va from pg_temp.r(v_hash, pg_temp.t(12), '5533330002', null, v_c);
  select * into vb from pg_temp.r(pg_temp.unico('u3'), pg_temp.t(14), '5533330002', null);
  perform pg_temp.esperar('caso 2 las dos ok', va.r_resultado || '/' || vb.r_resultado, 'ok/ok');
  perform pg_temp.esperar('caso 2 seudónimos distintos', (select count(distinct reserva_correo_hmac)::text from public.appointments
                                                          where id in (va.r_cita_id, vb.r_cita_id)), '2');
  perform pg_temp.esperar('caso 2 otro envío al mismo único', pg_temp.res(v_hash, pg_temp.t(16), '5533330003', null), 'enlace_usado');
  perform pg_temp.esperar('caso 2 el mismo envío', (select r_resultado from pg_temp.r(v_hash, pg_temp.t(12), '5533330002', null, v_c)), 'repetida');
end $$;

-- ── Caso 3: el FIJO sin correo no reserva ni escribe nada (correo_sin_verificar) ──
do $$
declare n0 bigint; n1 bigint;
begin
  select count(*) into n0 from public.appointments where clinica_id = '00000000-0000-4000-8000-00000a12c001';
  perform pg_temp.esperar('caso 3 fijo sin correo', pg_temp.res(pg_temp.h('f1'), pg_temp.t(18), '5533330004', null), 'correo_sin_verificar');
  select count(*) into n1 from public.appointments where clinica_id = '00000000-0000-4000-8000-00000a12c001';
  perform pg_temp.esperar('caso 3 sin fila nueva', (n1 - n0)::text, '0');
  -- Y con correo pero sin ficha, como siempre (seg1).
  perform pg_temp.esperar('caso 3 fijo con correo sin ficha', pg_temp.res(pg_temp.h('f1'), pg_temp.t(18), '5533330004', 'x4'), 'correo_sin_verificar');
end $$;

-- ── Caso 4: correo y su hmac van JUNTOS: uno sin el otro es 22023 ──
do $$
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
    set local role service_role;
    perform public.reservar_por_enlace('00000000-0000-4000-8000-00000a12c001', pg_temp.unico('u4'),
      '00000000-0000-4000-8000-00000a12d001', '00000000-0000-4000-8000-00000a12a001', pg_temp.t(20), 'Persona',
      '5533330005', 'medio@prueba.local', pg_temp.h('t:5533330005'), null, null, 'v1-prueba-i2', pg_temp.h('aviso'), gen_random_uuid());
    raise exception 'i2 caso 4: aceptó correo sin hmac';
  exception when sqlstate '22023' then null;
  end;
  reset role;
end $$;

-- ── Caso 5: el bloqueo MANUAL sigue cortando el único: por teléfono (sin correo) y por
--    correo (con correo); lo automático no ──
insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en) values
  ('00000000-0000-4000-8000-00000a12c001', '00000000-0000-4000-8000-00000a12b001', pg_temp.h('t:5533330009'), 'telefono', now()),
  ('00000000-0000-4000-8000-00000a12c001', '00000000-0000-4000-8000-00000a12b001', pg_temp.h('c:bloq'), 'correo', now());
do $$
begin
  perform pg_temp.esperar('caso 5 único sin correo, teléfono bloqueado', pg_temp.res(pg_temp.unico('u5'), pg_temp.t(22), '5533330009', null), 'bloqueado');
  perform pg_temp.esperar('caso 5 único con correo bloqueado', pg_temp.res(pg_temp.unico('u6'), pg_temp.t(22), '5533330010', 'bloq'), 'bloqueado');
  perform pg_temp.esperar('caso 5 único sin correo, teléfono libre', pg_temp.res(pg_temp.unico('u7'), pg_temp.t(22), '5533330010', null), 'ok');
end $$;

-- ── Caso 6: la ventana (anticipación y horizonte) y lo ocupado valen igual sin correo,
--    incluido un evento de TODO EL DÍA del médico ──
create function pg_temp.dia(p_horas integer) returns timestamptz language sql as $$
  select (date_trunc('day', pg_temp.t(p_horas) at time zone 'America/Mexico_City') at time zone 'America/Mexico_City');
$$;
grant execute on function pg_temp.dia(integer) to anon, authenticated, service_role;
insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status, origen, all_day, consultorio_timezone) values
  ('00000000-0000-4000-8000-00000a12c001', '00000000-0000-4000-8000-00000a12b001', 'Vacaciones',
   pg_temp.dia(200), pg_temp.dia(200) + interval '1 day', 'scheduled', 'spinus', true, 'America/Mexico_City');
do $$
begin
  perform pg_temp.esperar('caso 6 antes de la anticipación', pg_temp.res(pg_temp.unico('w1'), date_trunc('hour', now()) + interval '1 hour',
          '5533330011', null), 'fuera_de_ventana');
  perform pg_temp.esperar('caso 6 más allá del horizonte', pg_temp.res(pg_temp.unico('w2'), date_trunc('hour', now()) + interval '400 days',
          '5533330011', null), 'fuera_de_ventana');
  perform pg_temp.esperar('caso 6 todo el día', pg_temp.res(pg_temp.unico('w3'), pg_temp.dia(200) + interval '10 hours',
          '5533330011', null), 'ocupado');
  perform pg_temp.esperar('caso 6 empalme con una reserva', pg_temp.res(pg_temp.unico('w4'), pg_temp.t(10), '5533330011', null), 'ocupado');
end $$;

-- ── Caso 7: sin correo no hay correo que tomar (comprobante, confirmación, recordatorio:
--    `cita_correo_tomar` no devuelve fila), pero sí enlace de confirmación (WhatsApp) ──
do $$
declare v uuid; v_ctl uuid; n integer; v_conf uuid;
begin
  select r_cita_id into v from pg_temp.r(pg_temp.unico('u8'), pg_temp.t(30), '5533330012', null);
  -- Testigo: la misma reserva CON correo sí tiene a quién escribir.
  select r_cita_id into v_ctl from pg_temp.r(pg_temp.unico('u9'), pg_temp.t(32), '5533330013', 'testigo7');
  set local role service_role;
  select count(*) into n from public.cita_correo_tomar('00000000-0000-4000-8000-00000a12c001', v_ctl, 'confirmacion', gen_random_uuid());
  perform pg_temp.esperar('caso 7 testigo con correo', n::text, '1');
  select count(*) into n from public.cita_correo_tomar('00000000-0000-4000-8000-00000a12c001', v, 'recordatorio', gen_random_uuid());
  perform pg_temp.esperar('caso 7 recordatorio sin para', n::text, '0');
  select count(*) into n from public.cita_correo_tomar('00000000-0000-4000-8000-00000a12c001', v, 'confirmacion', gen_random_uuid());
  perform pg_temp.esperar('caso 7 confirmación sin para', n::text, '0');
  select r_id into v_conf from public.cita_confirmacion_emitir('00000000-0000-4000-8000-00000a12c001', v, gen_random_uuid(),
                                                              pg_temp.h('codigo:i2'), null);
  reset role;
  perform pg_temp.esperar('caso 7 enlace de confirmación', (v_conf is not null)::text, 'true');
end $$;

-- ── Caso 8: permisos sin cambio: sólo service_role ejecuta ──
do $$
declare f constant text := 'public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)';
begin
  perform pg_temp.esperar('caso 8 EXECUTE', has_function_privilege('anon', f, 'EXECUTE')::text || ','
    || has_function_privilege('authenticated', f, 'EXECUTE')::text || ',' || has_function_privilege('service_role', f, 'EXECUTE')::text,
    'false,false,true');
end $$;

rollback;
