-- Agenda D3 — reservar por enlace: contexto público, ocupación, código al
-- correo y la reserva atómica (20261114140000_agenda_d3_reservar.sql).
-- Secuencial y en una sola transacción: la carrera de dos sesiones va aparte,
-- en scripts/reserva-carrera.sh.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1: VIP, interruptor encendido. Médicos b1 (consultorios k1 activo y k3 dado de baja) y b2 (k2).
-- c2: free degradada (tuvo premium y lo perdió), encendida. Médico b9, consultorio k9.
-- c3: VIP con el interruptor APAGADO. Médico b8, consultorio k8.
insert into public.clinicas (id, nombre, es_vip_grant, stripe_subscription_id, suscripcion_estado) values
  ('00000000-0000-4000-8000-000000d3c001', 'D3 VIP',        true,  null,       'free'),
  ('00000000-0000-4000-8000-000000d3c002', 'D3 degradada',  false, 'sub_d3_2', 'cancelado'),
  ('00000000-0000-4000-8000-000000d3c003', 'D3 apagada',    true,  null,       'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000d3b001'::uuid, 'd3-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000d3b002'::uuid, 'd3-b2@prueba.local'),
               ('00000000-0000-4000-8000-000000d3b009'::uuid, 'd3-b9@prueba.local'),
               ('00000000-0000-4000-8000-000000d3b008'::uuid, 'd3-b8@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d3c001', es_admin_de_clinica = (id::text like '%b001'),
                           nombres = 'Médico', apellido_paterno = 'Prueba', especialidad = 'Ortopedia'
 where id in ('00000000-0000-4000-8000-000000d3b001', '00000000-0000-4000-8000-000000d3b002');
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d3c002', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000d3b009';
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d3c003', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000d3b008';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000d3c001', true),
  ('00000000-0000-4000-8000-000000d3c002', true),
  ('00000000-0000-4000-8000-000000d3c003', false);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo) values
  ('00000000-0000-4000-8000-00000d3cc001', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001', 'Consultorio Uno', 'Uno', 'Calle 1', true),
  ('00000000-0000-4000-8000-00000d3cc003', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001', 'Consultorio Viejo', 'Viejo', 'Calle 3', false),
  ('00000000-0000-4000-8000-00000d3cc002', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b002', 'Consultorio Dos', 'Dos', 'Calle 2', true),
  ('00000000-0000-4000-8000-00000d3cc009', '00000000-0000-4000-8000-000000d3c002', '00000000-0000-4000-8000-000000d3b009', 'Consultorio Nueve', 'Nueve', 'Calle 9', true),
  ('00000000-0000-4000-8000-00000d3cc008', '00000000-0000-4000-8000-000000d3c003', '00000000-0000-4000-8000-000000d3b008', 'Consultorio Ocho', 'Ocho', 'Calle 8', true);
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo) values
  ('00000000-0000-4000-8000-000000d3a001', '00000000-0000-4000-8000-000000d3c001', null, 'Primera vez', 30, true),
  ('00000000-0000-4000-8000-000000d3a002', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b002', 'Sólo de b2', 20, true),
  ('00000000-0000-4000-8000-000000d3a003', '00000000-0000-4000-8000-000000d3c001', null, 'Archivado', 30, false),
  ('00000000-0000-4000-8000-000000d3a009', '00000000-0000-4000-8000-000000d3c002', null, 'Tipo c2', 30, true),
  ('00000000-0000-4000-8000-000000d3a008', '00000000-0000-4000-8000-000000d3c003', null, 'Tipo c3', 30, true);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
grant execute on function pg_temp.h(text) to anon, authenticated, service_role;

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values
  ('v1-prueba-d3', pg_temp.h('aviso'), true, now()),
  ('v0-sin-aprobar', pg_temp.h('aviso-viejo'), false, null);

-- Enlaces (como postgres; la protección no aplica, así que los únicos llevan su vigencia a mano).
--   f1 fijo b1 · u1 único b1 · u2 único b1 caducado · r1 fijo revocado (b2) · f2 fijo b2
--   f9 fijo b9 (c2, degradada) · f8 fijo b8 (c3, apagada)
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en, revocado_en) values
  ('00000000-0000-4000-8000-000000d3f001', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001', 'fijo',  pg_temp.h('f1'), null, null, null),
  ('00000000-0000-4000-8000-000000d3f002', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001', 'unico', pg_temp.h('u1'), 7, now() + interval '7 days', null),
  ('00000000-0000-4000-8000-000000d3f003', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001', 'unico', pg_temp.h('u2'), 1, now() - interval '1 minute', null),
  ('00000000-0000-4000-8000-000000d3f004', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b002', 'fijo',  pg_temp.h('r1'), null, null, now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000d3f005', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b002', 'fijo',  pg_temp.h('f2'), null, null, null),
  ('00000000-0000-4000-8000-000000d3f009', '00000000-0000-4000-8000-000000d3c002', '00000000-0000-4000-8000-000000d3b009', 'fijo',  pg_temp.h('f9'), null, null, null),
  ('00000000-0000-4000-8000-000000d3f008', '00000000-0000-4000-8000-000000d3c003', '00000000-0000-4000-8000-000000d3b008', 'fijo',  pg_temp.h('f8'), null, null, null);

-- Turnos alineados al minuto, dentro de la ventana (2 h a 60 días).
create function pg_temp.t(p_horas integer) returns timestamptz language sql as $$
  select date_trunc('hour', now()) + interval '2 days' + make_interval(hours => p_horas);
$$;

-- Llamadas como el servidor: service_role, sin sub en los claims. Los seudónimos de prueba son
-- sha256('t:'||tel), sha256('c:'||correo), sha256('ficha:'||ficha), sha256('cod:'||código).
create function pg_temp.r(p_hash text, p_cons uuid, p_tipo uuid, p_inicio timestamptz, p_tel text, p_correo text,
                          p_ficha text, p_client uuid,
                          p_clinica uuid default '00000000-0000-4000-8000-000000d3c001',
                          p_aviso text default 'v1-prueba-d3', p_aviso_sha text default null)
returns table (r_resultado text, r_cita_id uuid, r_inicio timestamptz, r_fin timestamptz, r_historial integer)
language plpgsql as $$
declare
  v_tel text := pg_temp.h('t:' || p_tel);
  v_cor text := pg_temp.h('c:' || p_correo);
  v_fh  text := case when p_ficha is null then null else pg_temp.h('ficha:' || p_ficha) end;
  v_sha text := coalesce(p_aviso_sha, pg_temp.h('aviso'));
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  return query select * from public.reservar_por_enlace(p_clinica, p_hash, p_cons, p_tipo, p_inicio, 'Persona Prueba',
                                                        p_tel, p_correo || '@prueba.local', v_tel, v_cor, v_fh,
                                                        p_aviso, v_sha, p_client);
  reset role;
end $$;
create function pg_temp.emitir(p_enlace uuid, p_correo text, p_codigo text,
                               p_clinica uuid default '00000000-0000-4000-8000-000000d3c001') returns text
language plpgsql as $$
declare v_cor text := pg_temp.h('c:' || p_correo); v_cod text := pg_temp.h('cod:' || p_codigo); v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  v := public.reserva_codigo_emitir(p_clinica, p_enlace, v_cor, v_cod);
  reset role;
  return v;
end $$;
create function pg_temp.verificar(p_enlace uuid, p_correo text, p_codigo text, p_ficha text) returns text
language plpgsql as $$
declare v_cor text := pg_temp.h('c:' || p_correo); v_cod text := pg_temp.h('cod:' || p_codigo);
        v_fh text := pg_temp.h('ficha:' || p_ficha); v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  v := public.reserva_codigo_verificar('00000000-0000-4000-8000-000000d3c001', p_enlace, v_cor, v_cod, v_fh);
  reset role;
  return v;
end $$;
create function pg_temp.res(p_hash text, p_cons uuid, p_tipo uuid, p_inicio timestamptz, p_tel text, p_correo text,
                            p_ficha text, p_client uuid default gen_random_uuid()) returns text language sql as $$
  select r_resultado from pg_temp.r(p_hash, p_cons, p_tipo, p_inicio, p_tel, p_correo, p_ficha, p_client);
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'D3 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
-- Sólo para esta prueba (rollback): se llaman ya con el rol cambiado.
grant execute on function pg_temp.t(integer), pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

-- ── Caso 1: una reserva correcta por el enlace ÚNICO (sin código, sin candado) ──
do $$
declare
  v record;
  a public.appointments%rowtype;
begin
  select * into v from pg_temp.r(pg_temp.h('u1'), '00000000-0000-4000-8000-00000d3cc001', '00000000-0000-4000-8000-000000d3a001',
                                 pg_temp.t(10), '5500000001', 'ana', null, '00000000-0000-4000-8000-000000d3e001');
  perform pg_temp.esperar('caso 1', v.r_resultado, 'ok');
  select * into a from public.appointments where id = v.r_cita_id;
  if a.paciente_id is not null or a.created_by is not null or a.reserva_canal <> 'unico' or a.title <> 'Persona Prueba'
     or a.medico_id <> '00000000-0000-4000-8000-000000d3b001' or a.end_time <> pg_temp.t(10) + interval '30 minutes'
     or a.status <> 'scheduled' or a.origen <> 'spinus' or a.gcal_sync_status <> 'pending'
     or a.consultorio_nombre <> 'Consultorio Uno' or a.tipo_cita_nombre <> 'Primera vez'
     or a.reserva_telefono <> '5500000001' or a.reserva_correo <> 'ana@prueba.local'
     or a.reserva_aviso_version <> 'v1-prueba-d3' or a.reserva_historial_previo <> 0 or a.reserva_reagendados <> 0 then
    raise exception 'D3 caso 1: la cita quedó mal (%)', row_to_json(a);
  end if;
  if v.r_inicio <> pg_temp.t(10) or v.r_fin <> pg_temp.t(10) + interval '30 minutes' or v.r_historial <> 0 then
    raise exception 'D3 caso 1: la fila devuelta no trae inicio/fin/historial';
  end if;
  if (select usado_cita_id from public.reserva_enlaces where id = '00000000-0000-4000-8000-000000d3f002') is distinct from v.r_cita_id then
    raise exception 'D3 caso 1: el enlace único no quedó usado por la cita';
  end if;
  if (select count(*) from public.audit_log where registro_id = v.r_cita_id and user_id = 'system'
        and accion in ('cita_alta', 'cita_reservada_enlace')) <> 2 then
    raise exception 'D3 caso 1: faltan cita_alta y cita_reservada_enlace en audit_log';
  end if;
  if exists (select 1 from public.audit_log where registro_id = v.r_cita_id
               and (descripcion ilike '%Persona%' or descripcion like '%5500000001%' or descripcion ilike '%ana@%')) then
    raise exception 'D3 caso 1: el audit_log lleva datos personales';
  end if;
end $$;

-- ── Caso 2: el mismo envío (client_id) devuelve «repetida»; el único ya no reserva otra vez;
--    el caducado y el revocado no reservan ──
do $$
declare v record;
begin
  select * into v from pg_temp.r(pg_temp.h('u1'), '00000000-0000-4000-8000-00000d3cc001', '00000000-0000-4000-8000-000000d3a001',
                                 pg_temp.t(10), '5500000001', 'ana', null, '00000000-0000-4000-8000-000000d3e001');
  perform pg_temp.esperar('caso 2 repetida', v.r_resultado, 'repetida');
  if v.r_cita_id is null or v.r_inicio <> pg_temp.t(10) then
    raise exception 'D3 caso 2: «repetida» no devolvió la cita original';
  end if;
  perform pg_temp.esperar('caso 2 usado', pg_temp.res(pg_temp.h('u1'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(12), '5500000002', 'beto', null), 'enlace_usado');
  perform pg_temp.esperar('caso 2 caducado', pg_temp.res(pg_temp.h('u2'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(12), '5500000002', 'beto', null), 'enlace_caducado');
  perform pg_temp.esperar('caso 2 revocado', pg_temp.res(pg_temp.h('r1'), '00000000-0000-4000-8000-00000d3cc002',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(12), '5500000002', 'beto', 'x'), 'enlace_invalido');
  perform pg_temp.esperar('caso 2 inexistente', pg_temp.res(pg_temp.h('nadie'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(12), '5500000002', 'beto', null), 'enlace_invalido');
  -- p_clinica_id de otra clínica con un código bueno: inválido (no cruza clínicas).
  select * into v from pg_temp.r(pg_temp.h('f1'), '00000000-0000-4000-8000-00000d3cc001', '00000000-0000-4000-8000-000000d3a001',
                                 pg_temp.t(12), '5500000002', 'beto', null, gen_random_uuid(), '00000000-0000-4000-8000-000000d3c002');
  perform pg_temp.esperar('caso 2 otra clínica', v.r_resultado, 'enlace_invalido');
  if (select count(*) from public.appointments where clinica_id = '00000000-0000-4000-8000-000000d3c001') <> 1 then
    raise exception 'D3 caso 2: un intento rechazado dejó cita';
  end if;
end $$;

-- ── Caso 3: código al correo y ficha (enlace fijo) ──
do $$
begin
  perform pg_temp.esperar('caso 3 sin código', pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'carla', '111111',
          'ficha-carla-0000000000000000000000000000000'), 'sin_codigo');
  perform pg_temp.esperar('caso 3 emitir', pg_temp.emitir('00000000-0000-4000-8000-000000d3f001', 'carla', '111111'), 'ok');
  perform pg_temp.esperar('caso 3 mal 1', pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'carla', '999999', 'x1'), 'incorrecto');
  perform pg_temp.esperar('caso 3 mal 2', pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'carla', '999998', 'x2'), 'incorrecto');
  perform pg_temp.esperar('caso 3 mal 3', pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'carla', '999997', 'x3'), 'incorrecto');
  perform pg_temp.esperar('caso 3 mal 4', pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'carla', '999996', 'x4'), 'incorrecto');
  perform pg_temp.esperar('caso 3 mal 5', pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'carla', '999995', 'x5'), 'agotado');
  perform pg_temp.esperar('caso 3 tarde', pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'carla', '111111', 'x6'), 'agotado');
  -- Uno nuevo invalida el anterior (aunque no estuviera agotado).
  perform pg_temp.emitir('00000000-0000-4000-8000-000000d3f001', 'carla', '222222');
  perform pg_temp.emitir('00000000-0000-4000-8000-000000d3f001', 'carla', '333333');
  if (select count(*) from public.reserva_verificaciones
       where enlace_id = '00000000-0000-4000-8000-000000d3f001' and correo_hmac = pg_temp.h('c:carla') and intentos < 5) <> 1 then
    raise exception 'D3 caso 3: pedir un código nuevo no invalidó el anterior';
  end if;
  perform pg_temp.esperar('caso 3 viejo', pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'carla', '222222', 'x7'), 'incorrecto');
  perform pg_temp.esperar('caso 3 bueno', pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'carla', '333333', 'ficha-carla'), 'ok');
  -- Vencido: 10 minutos.
  perform pg_temp.emitir('00000000-0000-4000-8000-000000d3f001', 'dora', '444444');
  update public.reserva_verificaciones set caduca_en = now() - interval '1 second'
   where correo_hmac = pg_temp.h('c:dora');
  perform pg_temp.esperar('caso 3 vencido', pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'dora', '444444', 'fd'), 'caducado');
  -- Sólo enlaces fijos, vigentes, de una clínica con acceso y el interruptor encendido.
  perform pg_temp.esperar('caso 3 único', pg_temp.emitir('00000000-0000-4000-8000-000000d3f002', 'eva', '555555'), 'enlace_invalido');
  perform pg_temp.esperar('caso 3 revocado', pg_temp.emitir('00000000-0000-4000-8000-000000d3f004', 'eva', '555555'), 'enlace_invalido');
  perform pg_temp.esperar('caso 3 degradada', pg_temp.emitir('00000000-0000-4000-8000-000000d3f009', 'eva', '555555',
          '00000000-0000-4000-8000-000000d3c002'), 'enlace_invalido');
  perform pg_temp.esperar('caso 3 apagada', pg_temp.emitir('00000000-0000-4000-8000-000000d3f008', 'eva', '555555',
          '00000000-0000-4000-8000-000000d3c003'), 'enlace_invalido');
  perform pg_temp.esperar('caso 3 otra clínica', pg_temp.emitir('00000000-0000-4000-8000-000000d3f001', 'eva', '555555',
          '00000000-0000-4000-8000-000000d3c002'), 'enlace_invalido');
end $$;

-- ── Caso 4: el enlace fijo exige la ficha de ESE correo, una sola vez; 1 cita activa ──
do $$
begin
  perform pg_temp.esperar('caso 4 sin ficha', pg_temp.res(pg_temp.h('f1'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(14), '5500000003', 'carla', null), 'correo_sin_verificar');
  perform pg_temp.esperar('caso 4 ficha ajena', pg_temp.res(pg_temp.h('f1'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(14), '5500000003', 'otra', 'ficha-carla'), 'correo_sin_verificar');
  perform pg_temp.esperar('caso 4 ok', pg_temp.res(pg_temp.h('f1'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(14), '5500000003', 'carla', 'ficha-carla'), 'ok');
  perform pg_temp.esperar('caso 4 ficha usada', pg_temp.res(pg_temp.h('f1'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(16), '5500000003', 'carla', 'ficha-carla'), 'correo_sin_verificar');
  -- Ficha nueva, mismo correo: ya tiene 1 cita activa con este médico.
  perform pg_temp.emitir('00000000-0000-4000-8000-000000d3f001', 'carla', '666666');
  perform pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'carla', '666666', 'ficha-carla-2');
  perform pg_temp.esperar('caso 4 activa', pg_temp.res(pg_temp.h('f1'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(16), '5599999999', 'carla', 'ficha-carla-2'), 'ya_tiene_cita');
  -- Ficha vencida (30 min).
  update public.reserva_verificaciones set ficha_caduca_en = now() - interval '1 second'
   where ficha_hmac = pg_temp.h('ficha:ficha-carla-2');
  perform pg_temp.esperar('caso 4 ficha vencida', pg_temp.res(pg_temp.h('f1'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(16), '5599999999', 'carla', 'ficha-carla-2'), 'correo_sin_verificar');
  -- Con la cita cancelada ya no está activa (y la cancelación queda como incidencia, D2).
  update public.appointments set status = 'cancelled'
   where clinica_id = '00000000-0000-4000-8000-000000d3c001' and reserva_correo_hmac = pg_temp.h('c:carla');
  update public.reserva_verificaciones set ficha_caduca_en = now() + interval '10 minutes'
   where ficha_hmac = pg_temp.h('ficha:ficha-carla-2');
  perform pg_temp.esperar('caso 4 tras cancelar', pg_temp.res(pg_temp.h('f1'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(16), '5599999999', 'carla', 'ficha-carla-2'), 'ok');
  if (select reserva_historial_previo from public.appointments
       where reserva_correo_hmac = pg_temp.h('c:carla') and status = 'scheduled') <> 1 then
    raise exception 'D3 caso 4: la cita nueva no trae el historial (1 cancelación)';
  end if;
end $$;

-- ── Caso 5: bloqueado. seg1 (20261117130000): el bloqueo MANUAL corta también el único; el
--    único se salta lo automático y la regla de 1 activa ──
do $$
begin
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en)
  values ('00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001', pg_temp.h('t:5500000004'), 'telefono', now());
  perform pg_temp.emitir('00000000-0000-4000-8000-000000d3f001', 'fede', '777777');
  perform pg_temp.verificar('00000000-0000-4000-8000-000000d3f001', 'fede', '777777', 'ficha-fede');
  perform pg_temp.esperar('caso 5 bloqueado', pg_temp.res(pg_temp.h('f1'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(18), '5500000004', 'fede', 'ficha-fede'), 'bloqueado');
  -- La ficha no se gastó con el rechazo.
  if (select consumida_en from public.reserva_verificaciones where ficha_hmac = pg_temp.h('ficha:ficha-fede')) is not null then
    raise exception 'D3 caso 5: un rechazo gastó la ficha';
  end if;
  -- Único nuevo de b1 (vigencia a mano, como postgres).
  insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en) values
    ('00000000-0000-4000-8000-000000d3f006', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001',
     'unico', pg_temp.h('u3'), 7, now() + interval '7 days'),
    ('00000000-0000-4000-8000-000000d3f007', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001',
     'unico', pg_temp.h('u4'), 7, now() + interval '7 days');
  perform pg_temp.esperar('caso 5 único con bloqueo manual', pg_temp.res(pg_temp.h('u3'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(18), '5500000004', 'fede', null), 'bloqueado');
  perform pg_temp.esperar('caso 5 único sin bloqueo manual', pg_temp.res(pg_temp.h('u3'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(18), '5500000005', 'fede', null), 'ok');
  perform pg_temp.esperar('caso 5 único salta 1 activa', pg_temp.res(pg_temp.h('u4'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(20), '5500000005', 'fede', null), 'ok');
end $$;

-- ── Caso 6: ocupación. Cita del personal y fila de Google ocupan; no_show, cancelada y de todo
--    el día no (seg1, 20261117130000: lo de todo el día SÍ ocupa en el enlace; va en un día lejos
--    de los demás turnos para no taparlos según la hora a la que corra la prueba); tocar el
--    extremo no es empalme; otro médico no cuenta ──
insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time, status, origen, all_day, consultorio_timezone) values
  ('00000000-0000-4000-8000-000000d3d001', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001',
   'Personal', pg_temp.t(30), pg_temp.t(30) + interval '1 hour', 'scheduled', 'spinus', false, null),
  ('00000000-0000-4000-8000-000000d3d002', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001',
   'De Google', pg_temp.t(32), pg_temp.t(32) + interval '1 hour', 'scheduled', 'google', false, null),
  ('00000000-0000-4000-8000-000000d3d003', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001',
   'Faltó', pg_temp.t(34), pg_temp.t(34) + interval '1 hour', 'no_show', 'spinus', false, null),
  ('00000000-0000-4000-8000-000000d3d004', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001',
   'Cancelada', pg_temp.t(36), pg_temp.t(36) + interval '1 hour', 'cancelled', 'spinus', false, null),
  ('00000000-0000-4000-8000-000000d3d005', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b002',
   'De b2', pg_temp.t(38), pg_temp.t(38) + interval '1 hour', 'scheduled', 'spinus', false, null),
  ('00000000-0000-4000-8000-000000d3d006', '00000000-0000-4000-8000-000000d3c001', '00000000-0000-4000-8000-000000d3b001',
   'Vacaciones', (date_trunc('day', pg_temp.t(120) at time zone 'America/Mexico_City') at time zone 'America/Mexico_City'),
   (date_trunc('day', pg_temp.t(120) at time zone 'America/Mexico_City') at time zone 'America/Mexico_City') + interval '1 day',
   'scheduled', 'spinus', true, 'America/Mexico_City');
do $$
declare
  v_n integer;
  v_cols text;
begin
  insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en)
  select ('00000000-0000-4000-8000-000000d3f1' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-4000-8000-000000d3c001',
         '00000000-0000-4000-8000-000000d3b001', 'unico', pg_temp.h('o' || n), 7, now() + interval '7 days'
    from generate_series(1, 9) n;
  perform pg_temp.esperar('caso 6 personal', pg_temp.res(pg_temp.h('o1'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(30) + interval '30 minutes', '5500000011', 'g1', null), 'ocupado');
  perform pg_temp.esperar('caso 6 google', pg_temp.res(pg_temp.h('o2'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(32), '5500000012', 'g2', null), 'ocupado');
  perform pg_temp.esperar('caso 6 empieza antes', pg_temp.res(pg_temp.h('o2'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(30) - interval '15 minutes', '5500000012', 'g2', null), 'ocupado');
  perform pg_temp.esperar('caso 6 toca el extremo', pg_temp.res(pg_temp.h('o3'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(31), '5500000013', 'g3', null), 'ok');
  perform pg_temp.esperar('caso 6 no_show', pg_temp.res(pg_temp.h('o4'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(34), '5500000014', 'g4', null), 'ok');
  perform pg_temp.esperar('caso 6 cancelada', pg_temp.res(pg_temp.h('o5'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(36), '5500000015', 'g5', null), 'ok');
  perform pg_temp.esperar('caso 6 otro médico', pg_temp.res(pg_temp.h('o6'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(38), '5500000016', 'g6', null), 'ok');
  perform pg_temp.esperar('caso 6 todo el día', pg_temp.res(pg_temp.h('o7'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(120), '5500000017', 'g7', null), 'ocupado');
  perform pg_temp.esperar('caso 6 fuera del día de todo el día', pg_temp.res(pg_temp.h('o7'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(48), '5500000017', 'g7', null), 'ok');
  -- reserva_ocupacion: sólo dos columnas, sólo del médico del enlace, ≤ 15 días, apagada → nada.
  select string_agg(n, ',' order by o) into v_cols
    from pg_proc p, unnest(p.proargnames, p.proargmodes::text[]) with ordinality u(n, m, o)
   where p.oid = 'public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)'::regprocedure and m = 't';
  perform pg_temp.esperar('caso 6 columnas', v_cols, 'start_time,end_time');
  set local role service_role;
  select count(*) into v_n from public.reserva_ocupacion('00000000-0000-4000-8000-000000d3c001',
         '00000000-0000-4000-8000-000000d3f001', pg_temp.t(29), pg_temp.t(40));
  reset role;
  -- Personal (30), Google (32) y las reservas de b1 a las 31, 34, 36 y 38 → 6. No: no_show,
  -- cancelada, la cita de b2.
  perform pg_temp.esperar('caso 6 ocupación', v_n::text, '6');
  set local role service_role;
  select count(*) into v_n from public.reserva_ocupacion('00000000-0000-4000-8000-000000d3c001',
         '00000000-0000-4000-8000-000000d3f001', pg_temp.t(0), pg_temp.t(0) + interval '16 days');
  reset role;
  perform pg_temp.esperar('caso 6 más de 15 días', v_n::text, '0');
  set local role service_role;
  select count(*) into v_n from public.reserva_ocupacion('00000000-0000-4000-8000-000000d3c002',
         '00000000-0000-4000-8000-000000d3f001', pg_temp.t(29), pg_temp.t(40));
  reset role;
  perform pg_temp.esperar('caso 6 otra clínica', v_n::text, '0');
  update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = '00000000-0000-4000-8000-000000d3c001';
  set local role service_role;
  select count(*) into v_n from public.reserva_ocupacion('00000000-0000-4000-8000-000000d3c001',
         '00000000-0000-4000-8000-000000d3f001', pg_temp.t(29), pg_temp.t(40));
  reset role;
  update public.agenda_ajustes set agenda_v2_encendida = true where clinica_id = '00000000-0000-4000-8000-000000d3c001';
  perform pg_temp.esperar('caso 6 apagada', v_n::text, '0');
end $$;

-- ── Caso 7: consultorio y tipo inválidos; ventana; interruptor, aviso y puerta S3 ──
do $$
declare v record;
begin
  perform pg_temp.esperar('caso 7 consultorio de otro', pg_temp.res(pg_temp.h('o8'), '00000000-0000-4000-8000-00000d3cc002',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(50), '5500000018', 'g8', null), 'consultorio_invalido');
  perform pg_temp.esperar('caso 7 consultorio de baja', pg_temp.res(pg_temp.h('o8'), '00000000-0000-4000-8000-00000d3cc003',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(50), '5500000018', 'g8', null), 'consultorio_invalido');
  perform pg_temp.esperar('caso 7 tipo de otro', pg_temp.res(pg_temp.h('o8'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a002', pg_temp.t(50), '5500000018', 'g8', null), 'tipo_invalido');
  perform pg_temp.esperar('caso 7 tipo archivado', pg_temp.res(pg_temp.h('o8'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a003', pg_temp.t(50), '5500000018', 'g8', null), 'tipo_invalido');
  perform pg_temp.esperar('caso 7 tipo de otra clínica', pg_temp.res(pg_temp.h('o8'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a009', pg_temp.t(50), '5500000018', 'g8', null), 'tipo_invalido');
  perform pg_temp.esperar('caso 7 anticipación', pg_temp.res(pg_temp.h('o8'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', date_trunc('minute', now()) + interval '1 hour', '5500000018', 'g8', null),
          'fuera_de_ventana');
  perform pg_temp.esperar('caso 7 horizonte', pg_temp.res(pg_temp.h('o8'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', date_trunc('minute', now()) + interval '60 days 1 minute', '5500000018', 'g8', null),
          'fuera_de_ventana');
  select * into v from pg_temp.r(pg_temp.h('o8'), '00000000-0000-4000-8000-00000d3cc001', '00000000-0000-4000-8000-000000d3a001',
                                 pg_temp.t(50), '5500000018', 'g8', null, gen_random_uuid(), p_aviso => 'v0-sin-aprobar',
                                 p_aviso_sha => pg_temp.h('aviso-viejo'));
  perform pg_temp.esperar('caso 7 aviso sin aprobar', v.r_resultado, 'aviso_no_aprobado');
  select * into v from pg_temp.r(pg_temp.h('o8'), '00000000-0000-4000-8000-00000d3cc001', '00000000-0000-4000-8000-000000d3a001',
                                 pg_temp.t(50), '5500000018', 'g8', null, gen_random_uuid(), p_aviso_sha => pg_temp.h('otro texto'));
  perform pg_temp.esperar('caso 7 aviso con otro texto', v.r_resultado, 'aviso_no_aprobado');
  select * into v from pg_temp.r(pg_temp.h('f9'), '00000000-0000-4000-8000-00000d3cc009', '00000000-0000-4000-8000-000000d3a009',
                                 pg_temp.t(50), '5500000018', 'g8', 'x', gen_random_uuid(), '00000000-0000-4000-8000-000000d3c002');
  perform pg_temp.esperar('caso 7 degradada (S3)', v.r_resultado, 'clinica_sin_acceso');
  select * into v from pg_temp.r(pg_temp.h('f8'), '00000000-0000-4000-8000-00000d3cc008', '00000000-0000-4000-8000-000000d3a008',
                                 pg_temp.t(50), '5500000018', 'g8', 'x', gen_random_uuid(), '00000000-0000-4000-8000-000000d3c003');
  perform pg_temp.esperar('caso 7 apagada', v.r_resultado, 'apagado');
  -- Suspendida: la puerta S3 también la cierra.
  update public.clinicas set suspendida = true where id = '00000000-0000-4000-8000-000000d3c001';
  perform pg_temp.esperar('caso 7 suspendida', pg_temp.res(pg_temp.h('o8'), '00000000-0000-4000-8000-00000d3cc001',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(50), '5500000018', 'g8', null), 'clinica_sin_acceso');
  update public.clinicas set suspendida = false where id = '00000000-0000-4000-8000-000000d3c001';
  -- El médico que dejó la clínica: el enlace deja de servir.
  update public.profiles set clinica_id = null where id = '00000000-0000-4000-8000-000000d3b002';
  perform pg_temp.esperar('caso 7 médico ido', pg_temp.res(pg_temp.h('f2'), '00000000-0000-4000-8000-00000d3cc002',
          '00000000-0000-4000-8000-000000d3a001', pg_temp.t(50), '5500000018', 'g8', 'x'), 'enlace_invalido');
  update public.profiles set clinica_id = '00000000-0000-4000-8000-000000d3c001' where id = '00000000-0000-4000-8000-000000d3b002';
end $$;

-- ── Caso 8: forma inválida → 22023 ──
do $$
begin
  begin
    perform pg_temp.res(pg_temp.h('o9'), '00000000-0000-4000-8000-00000d3cc001', '00000000-0000-4000-8000-000000d3a001',
                        pg_temp.t(52) + interval '30 seconds', '5500000019', 'g9', null);
    raise exception 'D3 caso 8: un inicio con segundos pasó';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform pg_temp.res(pg_temp.h('o9'), '00000000-0000-4000-8000-00000d3cc001', '00000000-0000-4000-8000-000000d3a001',
                        pg_temp.t(52), '55-123', 'g9', null);
    raise exception 'D3 caso 8: un teléfono mal formado pasó';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform pg_temp.res(pg_temp.h('o9'), null, '00000000-0000-4000-8000-000000d3a001', pg_temp.t(52), '5500000019', 'g9', null);
    raise exception 'D3 caso 8: un consultorio NULL pasó';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform pg_temp.res('no-es-hash', '00000000-0000-4000-8000-00000d3cc001', '00000000-0000-4000-8000-000000d3a001',
                        pg_temp.t(52), '5500000019', 'g9', null);
    raise exception 'D3 caso 8: un hash mal formado pasó';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- ── Caso 9: reserva_contexto ──
do $$
declare
  v jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  v := public.reserva_contexto(pg_temp.h('f1'), 'v1-prueba-d3', pg_temp.h('aviso'));
  reset role;
  if v ->> 'estado' <> 'vigente' or v ->> 'clinica_id' <> '00000000-0000-4000-8000-000000d3c001'
     or v -> 'medico' ->> 'especialidad' <> 'Ortopedia'
     or jsonb_array_length(v -> 'consultorios') <> 1 or v -> 'consultorios' -> 0 ->> 'nombre' <> 'Consultorio Uno'
     or (select string_agg(t ->> 'nombre', ',' order by t ->> 'nombre') from jsonb_array_elements(v -> 'tipos') t) <> 'Primera vez'
     or v -> 'ajustes' ->> 'anticipacion_min_horas' <> '2' then
    raise exception 'D3 caso 9: contexto del fijo mal formado (%)', v;
  end if;
  if v::text ilike '%5500000001%' or v::text ilike '%Persona Prueba%' then
    raise exception 'D3 caso 9: el contexto filtra datos de citas';
  end if;
  set local role service_role;
  perform pg_temp.esperar('caso 9 usado', public.reserva_contexto(pg_temp.h('u1'), 'v1-prueba-d3', pg_temp.h('aviso')) ->> 'estado', 'usado');
  perform pg_temp.esperar('caso 9 caducado', public.reserva_contexto(pg_temp.h('u2'), 'v1-prueba-d3', pg_temp.h('aviso')) ->> 'estado', 'caducado');
  perform pg_temp.esperar('caso 9 revocado', public.reserva_contexto(pg_temp.h('r1'), 'v1-prueba-d3', pg_temp.h('aviso'))::text, null);
  perform pg_temp.esperar('caso 9 inexistente', public.reserva_contexto(pg_temp.h('nadie'), 'v1-prueba-d3', pg_temp.h('aviso'))::text, null);
  perform pg_temp.esperar('caso 9 aviso', public.reserva_contexto(pg_temp.h('f1'), 'v1-prueba-d3', pg_temp.h('otro'))::text, null);
  perform pg_temp.esperar('caso 9 degradada', public.reserva_contexto(pg_temp.h('f9'), 'v1-prueba-d3', pg_temp.h('aviso'))::text, null);
  perform pg_temp.esperar('caso 9 apagada', public.reserva_contexto(pg_temp.h('f8'), 'v1-prueba-d3', pg_temp.h('aviso'))::text, null);
  perform pg_temp.esperar('caso 9 basura', public.reserva_contexto('x', 'v1-prueba-d3', pg_temp.h('aviso'))::text, null);
  reset role;
end $$;

-- ── Caso 10: nadie más que service_role ejecuta las cinco; authenticated no lee verificaciones ──
do $$
declare
  v_rol text;
  v_llamada text;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    foreach v_llamada in array array[
        'select public.reserva_contexto(''x'', ''v'', ''s'')',
        'select * from public.reserva_ocupacion(null, null, null, null)',
        'select public.reserva_codigo_emitir(null, null, null, null)',
        'select public.reserva_codigo_verificar(null, null, null, null, null)',
        'select * from public.reservar_por_enlace(null, null, null, null, null, null, null, null, null, null, null, null, null, null)',
        'select 1 from public.reserva_verificaciones'] loop
      execute format('set local role %I', v_rol);
      begin
        execute v_llamada;
        raise exception 'D3 caso 10: % pudo «%»', v_rol, v_llamada;
      exception when insufficient_privilege then null;
      end;
      reset role;
    end loop;
  end loop;
end $$;

rollback;
