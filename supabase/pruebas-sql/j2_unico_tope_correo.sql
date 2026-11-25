-- Agenda tanda J, punto 3 — el enlace de UN SOLO USO con tope de intentos y
-- con el correo que escribió la clínica al emitirlo
-- (20261122120000_agenda_j2_unico_tope_correo.sql).
-- Mutaciones comprobadas en rojo (notas_j2.md):
--   · el tope en 6 en vez de 5 → «caso 2»;
--   · «bloqueado» sin agotar el único → «caso 3»;
--   · el único con p_correo en vez del correo del enlace → «caso 1»;
--   · el disparador sin la comprobación del correo → «caso 5»;
--   · sin la comprobación del client_id ajeno → «caso 7» (23505 y el conteo deshecho).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- ── Datos: c1 VIP encendida, médico b1 con consultorio k1, tipo de 30 min ──
insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-00000a22c001', 'j2 prueba', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-00000a22b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'j2-b1@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-00000a22c001', es_admin_de_clinica = true,
                           nombres = 'Médico', apellido_paterno = 'Jdos', especialidad = 'Ortopedia'
 where id = '00000000-0000-4000-8000-00000a22b001';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-00000a22c001', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = excluded.agenda_v2_encendida;
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone) values
  ('00000000-0000-4000-8000-00000a22d001', '00000000-0000-4000-8000-00000a22c001', '00000000-0000-4000-8000-00000a22b001',
   'Consultorio j2', 'Jdos', 'Calle 2', true, 'America/Mexico_City');
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo) values
  ('00000000-0000-4000-8000-00000a22a001', '00000000-0000-4000-8000-00000a22c001', null, 'Primera vez', 30, true);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values
  ('v1-prueba-j2', pg_temp.h('aviso'), true, now());

create function pg_temp.t(p_horas integer) returns timestamptz language sql as $$
  select date_trunc('hour', now()) + interval '2 days' + make_interval(hours => p_horas);
$$;
-- Como el servidor: emite por la RPC de la clínica (service_role), con o sin correo.
create function pg_temp.unico(p_nombre text, p_correo text default null) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  perform public.reserva_enlace_emitir('00000000-0000-4000-8000-00000a22c001', '00000000-0000-4000-8000-00000a22b001',
    gen_random_uuid(), '00000000-0000-4000-8000-00000a22b001', 'unico', pg_temp.h(p_nombre), null,
    case when p_correo is null then null else p_correo || '@prueba.local' end,
    case when p_correo is null then null else pg_temp.h('c:' || p_correo) end);
  reset role;
  return pg_temp.h(p_nombre);
end $$;
-- Reserva como el servidor. p_correo es lo que TECLEA quien reserva (en el único no debe contar).
create function pg_temp.r(p_hash text, p_inicio timestamptz, p_tel text, p_correo text, p_cliente uuid default gen_random_uuid())
returns table (r_resultado text, r_cita_id uuid, r_inicio timestamptz, r_fin timestamptz, r_historial integer)
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  return query select * from public.reservar_por_enlace('00000000-0000-4000-8000-00000a22c001', p_hash,
    '00000000-0000-4000-8000-00000a22d001', '00000000-0000-4000-8000-00000a22a001', p_inicio, 'Persona Prueba',
    p_tel, case when p_correo is null then null else p_correo || '@prueba.local' end, pg_temp.h('t:' || p_tel),
    case when p_correo is null then null else pg_temp.h('c:' || p_correo) end, null,
    'v1-prueba-j2', pg_temp.h('aviso'), p_cliente);
  reset role;
end $$;
create function pg_temp.res(p_hash text, p_inicio timestamptz, p_tel text, p_correo text) returns text
language sql as $$ select r_resultado from pg_temp.r(p_hash, p_inicio, p_tel, p_correo) $$;
create function pg_temp.enl(p_hash text) returns text language sql as $$
  select intentos || '/' || (agotado_en is not null) || '/' || (usado_en is not null) from public.reserva_enlaces where codigo_hash = p_hash;
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'j2 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.h(text), pg_temp.t(integer), pg_temp.unico(text, text), pg_temp.enl(text),
  pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

-- ── Caso 1: el correo de la cita es el del ENLACE, nunca el tecleado; sin el de la clínica, ninguno ──
do $$
declare v record; f record; n integer;
begin
  select * into v from pg_temp.r(pg_temp.unico('u1', 'clinica1'), pg_temp.t(10), '5544440001', 'tercero1');
  perform pg_temp.esperar('caso 1 ok', v.r_resultado, 'ok');
  select reserva_correo, reserva_correo_hmac into f from public.appointments where id = v.r_cita_id;
  perform pg_temp.esperar('caso 1 correo del enlace', f.reserva_correo || '/' || f.reserva_correo_hmac, 'clinica1@prueba.local/' || pg_temp.h('c:clinica1'));
  -- Sin correo de la clínica: aunque se teclee uno, la cita queda sin correo y sin a quién escribir.
  select * into v from pg_temp.r(pg_temp.unico('u2'), pg_temp.t(12), '5544440002', 'tercero2');
  select reserva_correo, reserva_correo_hmac into f from public.appointments where id = v.r_cita_id;
  perform pg_temp.esperar('caso 1 sin correo', coalesce(f.reserva_correo, '<null>') || '/' || f.reserva_correo_hmac,
                          '<null>/' || pg_temp.h('reserva-sin-correo:' || v.r_cita_id::text));
  set local role service_role;
  select count(*) into n from public.cita_correo_tomar('00000000-0000-4000-8000-00000a22c001', v.r_cita_id, 'comprobante', gen_random_uuid());
  reset role;
  perform pg_temp.esperar('caso 1 sin a quién escribir', n::text, '0');
end $$;

-- ── Caso 2: tope de 5 intentos; el 5.º agota; después, enlace_agotado; un reenvío no cuenta ──
do $$
declare v_hash text := pg_temp.unico('u3'); v_c uuid := gen_random_uuid(); i integer;
begin
  -- Fuera de ventana: cada uno es un intento que no reserva.
  for i in 1..4 loop
    perform pg_temp.esperar('caso 2 intento ' || i, pg_temp.res(v_hash, date_trunc('hour', now()) + interval '1 hour', '5544440003', null), 'fuera_de_ventana');
  end loop;
  perform pg_temp.esperar('caso 2 tras 4', pg_temp.enl(v_hash), '4/false/false');
  -- El 5.º, bueno: reserva y además agota (y gasta).
  perform pg_temp.esperar('caso 2 el 5.º reserva', (select r_resultado from pg_temp.r(v_hash, pg_temp.t(14), '5544440003', null, v_c)), 'ok');
  perform pg_temp.esperar('caso 2 tras 5', pg_temp.enl(v_hash), '5/true/true');
  -- El reenvío del mismo envío sigue siendo «repetida», y no cuenta.
  perform pg_temp.esperar('caso 2 reenvío', (select r_resultado from pg_temp.r(v_hash, pg_temp.t(14), '5544440003', null, v_c)), 'repetida');
  perform pg_temp.esperar('caso 2 reenvío no cuenta', pg_temp.enl(v_hash), '5/true/true');
  -- Cinco intentos fallidos: agotado sin usar; el 6.º, enlace_agotado y no suma.
  v_hash := pg_temp.unico('u4');
  for i in 1..5 loop
    perform pg_temp.res(v_hash, date_trunc('hour', now()) + interval '1 hour', '5544440004', null);
  end loop;
  perform pg_temp.esperar('caso 2 agotado sin usar', pg_temp.enl(v_hash), '5/true/false');
  perform pg_temp.esperar('caso 2 el 6.º', pg_temp.res(v_hash, pg_temp.t(16), '5544440004', null), 'enlace_agotado');
  perform pg_temp.esperar('caso 2 el 6.º no suma', pg_temp.enl(v_hash), '5/true/false');
  perform pg_temp.esperar('caso 2 contexto', public.reserva_contexto(v_hash, 'v1-prueba-j2', pg_temp.h('aviso')) ->> 'estado', 'agotado');
end $$;

-- ── Caso 3: «bloqueado» agota el único en el acto (un teléfono por enlace) ──
insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en) values
  ('00000000-0000-4000-8000-00000a22c001', '00000000-0000-4000-8000-00000a22b001', pg_temp.h('t:5544440009'), 'telefono', now()),
  ('00000000-0000-4000-8000-00000a22c001', '00000000-0000-4000-8000-00000a22b001', pg_temp.h('c:bloq'), 'correo', now());
do $$
declare v_hash text := pg_temp.unico('u5');
begin
  perform pg_temp.esperar('caso 3 bloqueado', pg_temp.res(v_hash, pg_temp.t(18), '5544440009', null), 'bloqueado');
  perform pg_temp.esperar('caso 3 agotado', pg_temp.enl(v_hash), '1/true/false');
  perform pg_temp.esperar('caso 3 otro teléfono ya no', pg_temp.res(v_hash, pg_temp.t(18), '5544440010', null), 'enlace_agotado');
  -- El bloqueo por correo mira el correo del ENLACE, no el tecleado.
  perform pg_temp.esperar('caso 3 correo bloqueado del enlace', pg_temp.res(pg_temp.unico('u6', 'bloq'), pg_temp.t(18), '5544440011', null), 'bloqueado');
  perform pg_temp.esperar('caso 3 correo bloqueado tecleado no cuenta', pg_temp.res(pg_temp.unico('u7'), pg_temp.t(20), '5544440012', 'bloq'), 'ok');
end $$;

-- ── Caso 4: la emisión: correo y hmac juntos, sólo en el único; el fijo, como siempre ──
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  begin
    perform public.reserva_enlace_emitir('00000000-0000-4000-8000-00000a22c001', '00000000-0000-4000-8000-00000a22b001',
      gen_random_uuid(), '00000000-0000-4000-8000-00000a22b001', 'fijo', pg_temp.h('f-mal'), null, 'x@prueba.local', pg_temp.h('c:x'));
    raise exception 'j2 caso 4: aceptó correo en el fijo';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.reserva_enlace_emitir('00000000-0000-4000-8000-00000a22c001', '00000000-0000-4000-8000-00000a22b001',
      gen_random_uuid(), '00000000-0000-4000-8000-00000a22b001', 'unico', pg_temp.h('u-mal'), null, 'x@prueba.local', null);
    raise exception 'j2 caso 4: aceptó correo sin hmac';
  exception when sqlstate '22023' then null;
  end;
  perform public.reserva_enlace_emitir('00000000-0000-4000-8000-00000a22c001', '00000000-0000-4000-8000-00000a22b001',
    gen_random_uuid(), '00000000-0000-4000-8000-00000a22b001', 'fijo', pg_temp.h('f1'), null, null, null);
  reset role;
  perform pg_temp.esperar('caso 4 fijo emitido', (select (correo is null and intentos = 0)::text from public.reserva_enlaces where codigo_hash = pg_temp.h('f1')), 'true');
end $$;

-- ── Caso 5: el disparador: el correo no cambia; los intentos sólo los sube service_role ──
do $$
declare v_hash text := pg_temp.unico('u8', 'fijo8');
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  begin
    update public.reserva_enlaces set correo = 'otro@prueba.local', correo_hmac = pg_temp.h('c:otro') where codigo_hash = v_hash;
    raise exception 'j2 caso 5: cambió el correo';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public.reserva_enlaces set intentos = 3 where codigo_hash = v_hash;
    update public.reserva_enlaces set intentos = 0 where codigo_hash = v_hash;
    raise exception 'j2 caso 5: bajó los intentos';
  exception when sqlstate '42501' then null;
  end;
  reset role;
  -- La sesión de la clínica (authenticated, con su policy de revocar) tampoco reinicia ni des-agota.
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', '00000000-0000-4000-8000-00000a22b001')::text, true);
  set local role authenticated;
  begin
    update public.reserva_enlaces set intentos = 9 where codigo_hash = v_hash;
    raise exception 'j2 caso 5: la sesión tocó los intentos';
  exception when sqlstate '42501' then null;
  end;
  update public.reserva_enlaces set revocado_en = now() where codigo_hash = v_hash;
  reset role;
  perform pg_temp.esperar('caso 5 revocar sigue', (select (revocado_en is not null)::text from public.reserva_enlaces where codigo_hash = v_hash), 'true');
end $$;

-- ── Caso 7 (auditoría H1): un client_id que ya es de OTRA cita se corta después de contar y antes
--    de mirar a la persona: no revela «bloqueado» y no se escapa del tope ──
do $$
declare v_otro uuid; v_hash text := pg_temp.unico('u9');
begin
  select r_cita_id into v_otro from pg_temp.r(pg_temp.unico('u10'), pg_temp.t(24), '5544440013', null);
  perform pg_temp.esperar('caso 7 client_id ajeno', (select r_resultado from pg_temp.r(v_hash, pg_temp.t(26), '5544440009', null,
          (select client_id::uuid from public.appointments where id = v_otro))), 'client_id_en_uso');
  perform pg_temp.esperar('caso 7 contado y sin agotar', pg_temp.enl(v_hash), '1/false/false');
end $$;

-- ── Caso 6: permisos ──
do $$
declare
  e constant text := 'public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text)';
  r constant text := 'public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)';
begin
  perform pg_temp.esperar('caso 6 emitir', has_function_privilege('anon', e, 'EXECUTE')::text || ','
    || has_function_privilege('authenticated', e, 'EXECUTE')::text || ',' || has_function_privilege('service_role', e, 'EXECUTE')::text, 'false,false,true');
  perform pg_temp.esperar('caso 6 reservar', has_function_privilege('anon', r, 'EXECUTE')::text || ','
    || has_function_privilege('authenticated', r, 'EXECUTE')::text || ',' || has_function_privilege('service_role', r, 'EXECUTE')::text, 'false,false,true');
  -- La de 7 args se retiró en el conjunto fundido (F3): no existe, así que nadie la ejecuta.
  perform pg_temp.esperar('caso 6 emitir de 7 args',
    (to_regprocedure('public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text)') is null)::text, 'true');
end $$;

rollback;
