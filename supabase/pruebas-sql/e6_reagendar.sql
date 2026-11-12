-- Agenda E6 — reagendar desde «no podré asistir» con el enlace fijo del médico
-- y el tope de 2 (20261115130000_agenda_e6_reagendar.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- c1: VIP, encendida. b1 administrador y médico (fijo f1, único u1, consultorio k1), b2 médico (fijo f2).
-- c2: VIP SUSPENDIDA, encendida. b7 (fijo f7, consultorio k7).
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-000000e6c001', 'E6 VIP',        true, 'free', false),
  ('00000000-0000-4000-8000-000000e6c002', 'E6 suspendida', true, 'free', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, now(), now()
  from (values ('00000000-0000-4000-8000-000000e6b001'::uuid, 'e6-b1@prueba.local'),
               ('00000000-0000-4000-8000-000000e6b002'::uuid, 'e6-b2@prueba.local'),
               ('00000000-0000-4000-8000-000000e6b007'::uuid, 'e6-b7@prueba.local')) u(id, email);
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e6c001', es_admin_de_clinica = (id::text like '%b001'),
                           nombres = 'Médico', apellido_paterno = 'Prueba'
 where id in ('00000000-0000-4000-8000-000000e6b001', '00000000-0000-4000-8000-000000e6b002');
update public.profiles set clinica_id = '00000000-0000-4000-8000-000000e6c002', es_admin_de_clinica = true
 where id = '00000000-0000-4000-8000-000000e6b007';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-000000e6c001', true),
  ('00000000-0000-4000-8000-000000e6c002', true);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo) values
  ('00000000-0000-4000-8000-00000e6cc001', '00000000-0000-4000-8000-000000e6c001', '00000000-0000-4000-8000-000000e6b001', 'Consultorio Uno', 'Uno', 'Calle 1', true),
  ('00000000-0000-4000-8000-00000e6cc007', '00000000-0000-4000-8000-000000e6c002', '00000000-0000-4000-8000-000000e6b007', 'Consultorio Siete', 'Siete', 'Calle 7', true);
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo) values
  ('00000000-0000-4000-8000-000000e6a001', '00000000-0000-4000-8000-000000e6c001', null, 'Consulta', 30, true),
  ('00000000-0000-4000-8000-000000e6a007', '00000000-0000-4000-8000-000000e6c002', null, 'Consulta', 30, true);
insert into public.pacientes (id, clinica_id, nombre, apellidos) values
  ('00000000-0000-4000-8000-000000e6f001', '00000000-0000-4000-8000-000000e6c001', 'Paciente', 'Uno'),
  ('00000000-0000-4000-8000-000000e6f007', '00000000-0000-4000-8000-000000e6c002', 'Paciente', 'Siete');

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'E6 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values
  ('v1-prueba-e6', pg_temp.h('aviso'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en) values
  ('00000000-0000-4000-8000-000000e6e001', '00000000-0000-4000-8000-000000e6c001', '00000000-0000-4000-8000-000000e6b001', 'fijo',  pg_temp.h('f1'), null, null),
  ('00000000-0000-4000-8000-000000e6e002', '00000000-0000-4000-8000-000000e6c001', '00000000-0000-4000-8000-000000e6b001', 'unico', pg_temp.h('u1'), 7, now() + interval '7 days'),
  ('00000000-0000-4000-8000-000000e6e003', '00000000-0000-4000-8000-000000e6c001', '00000000-0000-4000-8000-000000e6b002', 'fijo',  pg_temp.h('f2'), null, null),
  ('00000000-0000-4000-8000-000000e6e007', '00000000-0000-4000-8000-000000e6c002', '00000000-0000-4000-8000-000000e6b007', 'fijo',  pg_temp.h('f7'), null, null);

-- Turnos alineados a la hora, dentro de la ventana (2 h a 60 días).
create function pg_temp.t(p_horas integer) returns timestamptz language sql as $$
  select date_trunc('hour', now()) + interval '5 days' + make_interval(hours => p_horas);
$$;
grant execute on function pg_temp.t(integer) to service_role;

-- Citas de origen del PERSONAL (con paciente), como postgres:
--   a01 cadena del tope · a03 ocupado/vencida · a04 sin responder · a05 confirmada · a07 clínica suspendida
insert into public.appointments (id, clinica_id, paciente_id, medico_id, title, start_time, end_time, status) values
  ('00000000-0000-4000-8000-000000e6d001', '00000000-0000-4000-8000-000000e6c001', '00000000-0000-4000-8000-000000e6f001', '00000000-0000-4000-8000-000000e6b001',
   'Origen 1', pg_temp.t(0), pg_temp.t(0) + interval '30 min', 'scheduled'),
  ('00000000-0000-4000-8000-000000e6d003', '00000000-0000-4000-8000-000000e6c001', '00000000-0000-4000-8000-000000e6f001', '00000000-0000-4000-8000-000000e6b001',
   'Origen 3', pg_temp.t(1), pg_temp.t(1) + interval '30 min', 'scheduled'),
  ('00000000-0000-4000-8000-000000e6d004', '00000000-0000-4000-8000-000000e6c001', '00000000-0000-4000-8000-000000e6f001', '00000000-0000-4000-8000-000000e6b001',
   'Origen 4', pg_temp.t(2), pg_temp.t(2) + interval '30 min', 'scheduled'),
  ('00000000-0000-4000-8000-000000e6d005', '00000000-0000-4000-8000-000000e6c001', '00000000-0000-4000-8000-000000e6f001', '00000000-0000-4000-8000-000000e6b001',
   'Origen 5', pg_temp.t(3), pg_temp.t(3) + interval '30 min', 'scheduled'),
  ('00000000-0000-4000-8000-000000e6d007', '00000000-0000-4000-8000-000000e6c002', '00000000-0000-4000-8000-000000e6f007', '00000000-0000-4000-8000-000000e6b007',
   'Origen 7', pg_temp.t(0), pg_temp.t(0) + interval '30 min', 'cancelled'),
  -- Ocupa el turno t(30) de b1 (para el «ocupado» de D3).
  ('00000000-0000-4000-8000-000000e6d009', '00000000-0000-4000-8000-000000e6c001', '00000000-0000-4000-8000-000000e6f001', '00000000-0000-4000-8000-000000e6b001',
   'Ocupa', pg_temp.t(30), pg_temp.t(30) + interval '30 min', 'scheduled');

-- Enlaces de confirmación sembrados (como postgres): código de prueba = 'codigo:'||id.
create function pg_temp.conf(p_id uuid, p_clinica uuid, p_cita uuid, p_paciente uuid) returns text language sql as $$
  insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id)
  values (p_id, p_clinica, p_cita, pg_temp.h('codigo:' || p_id), p_paciente)
  returning codigo_hash;
$$;
create function pg_temp.sr() returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
$$;
create function pg_temp.responder(p_clinica uuid, p_hash text, p_accion text) returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.sr(); set local role service_role;
  select r_resultado into v from public.cita_confirmacion_responder(p_clinica, p_hash, p_accion);
  reset role; perform set_config('spinus.via', '', true);
  return v;
end $$;
create function pg_temp.emitir(p_clinica uuid, p_cita uuid, p_id uuid) returns text language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.sr(); set local role service_role;
  select r_id into v from public.cita_confirmacion_emitir(p_clinica, p_cita, p_id, pg_temp.h('codigo:' || p_id), null);
  reset role;
  return (select codigo_hash from public.cita_confirmaciones where id = v);
end $$;
create function pg_temp.oferta(p_clinica uuid, p_hash text) returns text language plpgsql as $$
declare v record;
begin
  perform pg_temp.sr(); set local role service_role;
  select * into v from public.cita_reagendar_oferta(p_clinica, p_hash);
  reset role;
  return v.r_motivo || coalesce('/' || v.r_enlace_id, '');
end $$;
-- Una ficha de verificación ya verificada (lo que deja /verificar de D5), como postgres.
create function pg_temp.ficha(p_enlace uuid, p_correo text, p_ficha text) returns void language sql as $$
  insert into public.reserva_verificaciones (clinica_id, enlace_id, correo_hmac, codigo_hmac, caduca_en, verificado_en, ficha_hmac, ficha_caduca_en)
  select e.clinica_id, e.id, pg_temp.h('c:' || p_correo), pg_temp.h('cod'), now() + interval '10 min', now(),
         pg_temp.h('ficha:' || p_ficha), now() + interval '30 min'
    from public.reserva_enlaces e where e.id = p_enlace;
$$;
create function pg_temp.reag(p_conf text, p_enlace text, p_inicio timestamptz, p_tel text, p_correo text, p_ficha text,
                             p_client uuid, p_clinica uuid default '00000000-0000-4000-8000-000000e6c001',
                             p_cons uuid default '00000000-0000-4000-8000-00000e6cc001',
                             p_tipo uuid default '00000000-0000-4000-8000-000000e6a001')
returns table (r_resultado text, r_cita_id uuid, r_inicio timestamptz, r_fin timestamptz, r_historial integer) language plpgsql as $$
begin
  perform pg_temp.sr(); set local role service_role;
  return query select * from public.reagendar_por_enlace(p_conf, p_clinica, p_enlace, p_cons, p_tipo, p_inicio,
    'Persona Reagenda', p_tel, p_correo || '@prueba.local', pg_temp.h('t:' || p_tel), pg_temp.h('c:' || p_correo),
    case when p_ficha is null then null else pg_temp.h('ficha:' || p_ficha) end, 'v1-prueba-e6', pg_temp.h('aviso'), p_client);
  reset role;
end $$;
create function pg_temp.r(p_conf text, p_enlace text, p_inicio timestamptz, p_tel text, p_correo text, p_ficha text,
                          p_client uuid default gen_random_uuid()) returns text language sql as $$
  select r_resultado from pg_temp.reag(p_conf, p_enlace, p_inicio, p_tel, p_correo, p_ficha, p_client);
$$;
create function pg_temp.como(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.sr() to service_role;

-- ── Caso 1: la oferta, antes y después de cancelar por el enlace ──────
do $$
declare v_h text := pg_temp.conf('00000000-0000-4000-8000-0000000e6001', '00000000-0000-4000-8000-000000e6c001',
                                 '00000000-0000-4000-8000-000000e6d001', '00000000-0000-4000-8000-000000e6f001');
begin
  perform pg_temp.esperar('caso 1 sin responder', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h), 'no_aplica');
  perform pg_temp.esperar('caso 1 otra clínica', pg_temp.oferta('00000000-0000-4000-8000-000000e6c002', v_h), 'no_aplica');
  perform pg_temp.esperar('caso 1 hash con mala forma', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', 'xyz'), 'no_aplica');
  perform pg_temp.esperar('caso 1 cancelar', pg_temp.responder('00000000-0000-4000-8000-000000e6c001', v_h, 'cancelar'), 'cancelada');
  perform pg_temp.esperar('caso 1 oferta', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h), 'ok/00000000-0000-4000-8000-000000e6e001');
end $$;

-- ── Caso 2: reagendar (1): cita nueva por ligar, reagendados = 1, fila y auditoría ──
do $$
declare v_h text := pg_temp.h('codigo:00000000-0000-4000-8000-0000000e6001'); v record; v_d jsonb;
begin
  perform pg_temp.ficha('00000000-0000-4000-8000-000000e6e001', 'ana', 'fa1');
  -- Sin ficha, la verificación de D sigue mandando.
  perform pg_temp.esperar('caso 2 sin verificar', pg_temp.r(v_h, pg_temp.h('f1'), pg_temp.t(10), '5500000001', 'ana', null), 'correo_sin_verificar');
  select * into v from pg_temp.reag(v_h, pg_temp.h('f1'), pg_temp.t(10), '5500000001', 'ana', 'fa1', '00000000-0000-4000-8000-00000000c001');
  perform pg_temp.esperar('caso 2 ok', v.r_resultado, 'ok');
  perform pg_temp.esperar('caso 2 la nueva', (select reserva_reagendados || '/' || coalesce(paciente_id::text, 'NULL') || '/' || reserva_canal || '/' || status
                                              from public.appointments where id = v.r_cita_id), '1/NULL/fijo/scheduled');
  perform pg_temp.esperar('caso 2 cita_reagendos', (select cita_origen_id || '/' || numero || '/' || confirmacion_id from public.cita_reagendos where cita_nueva_id = v.r_cita_id),
                          '00000000-0000-4000-8000-000000e6d001/1/00000000-0000-4000-8000-0000000e6001');
  select descripcion::jsonb into v_d from public.audit_log
   where registro_id = v.r_cita_id and accion = 'cita_editada' order by created_at desc limit 1;
  perform pg_temp.esperar('caso 2 auditoría', (v_d ->> 'via') || '/' || (v_d -> 'campos')::text, 'enlace_paciente/["reserva_reagendados"]');
  perform pg_temp.esperar('caso 2 auditoría a nombre del sistema', (select string_agg(distinct user_id, ',') from public.audit_log where registro_id = v.r_cita_id), 'system');
  perform pg_temp.esperar('caso 2 la de origen sigue cancelada', (select status from public.appointments where id = '00000000-0000-4000-8000-000000e6d001'), 'cancelled');
  -- Idempotencia y una sola vez.
  perform pg_temp.esperar('caso 2 repetida', (select r_resultado || '/' || r_cita_id from pg_temp.reag(v_h, pg_temp.h('f1'), pg_temp.t(10), '5500000001', 'ana', 'fa1',
                          '00000000-0000-4000-8000-00000000c001')), 'repetida/' || v.r_cita_id);
  perform pg_temp.esperar('caso 2 otro envío', pg_temp.r(v_h, pg_temp.h('f1'), pg_temp.t(11), '5500000001', 'ana', 'fa1'), 'ya_reagendada');
  perform pg_temp.esperar('caso 2 oferta', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h), 'ya_reagendada');
end $$;

-- ── Caso 3: la cadena hasta el tope de 2 ──────────────────────────────
do $$
declare v_n1 uuid; v_n2 uuid; v_h1 text; v_h2 text; v record;
begin
  select cita_nueva_id into v_n1 from public.cita_reagendos where cita_origen_id = '00000000-0000-4000-8000-000000e6d001';
  -- La nueva (por ligar) recibe su propio enlace, atado al correo de la reserva.
  v_h1 := pg_temp.emitir('00000000-0000-4000-8000-000000e6c001', v_n1, '00000000-0000-4000-8000-0000000e6011');
  perform pg_temp.esperar('caso 3 enlace de la nueva', v_h1, pg_temp.h('codigo:00000000-0000-4000-8000-0000000e6011'));
  perform pg_temp.esperar('caso 3 cancelar n1', pg_temp.responder('00000000-0000-4000-8000-000000e6c001', v_h1, 'cancelar'), 'cancelada');
  perform pg_temp.esperar('caso 3 oferta n1', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h1), 'ok/00000000-0000-4000-8000-000000e6e001');
  perform pg_temp.ficha('00000000-0000-4000-8000-000000e6e001', 'ana', 'fa2');
  select * into v from pg_temp.reag(v_h1, pg_temp.h('f1'), pg_temp.t(12), '5500000001', 'ana', 'fa2', gen_random_uuid());
  perform pg_temp.esperar('caso 3 reagendar 2', v.r_resultado, 'ok');
  v_n2 := v.r_cita_id;
  perform pg_temp.esperar('caso 3 n2', (select reserva_reagendados::text from public.appointments where id = v_n2), '2');
  perform pg_temp.esperar('caso 3 n2 numero', (select numero::text from public.cita_reagendos where cita_nueva_id = v_n2), '2');
  v_h2 := pg_temp.emitir('00000000-0000-4000-8000-000000e6c001', v_n2, '00000000-0000-4000-8000-0000000e6012');
  perform pg_temp.esperar('caso 3 cancelar n2', pg_temp.responder('00000000-0000-4000-8000-000000e6c001', v_h2, 'cancelar'), 'cancelada');
  perform pg_temp.esperar('caso 3 oferta tope', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h2), 'tope');
  perform pg_temp.ficha('00000000-0000-4000-8000-000000e6e001', 'ana', 'fa3');
  perform pg_temp.esperar('caso 3 reagendar tope', pg_temp.r(v_h2, pg_temp.h('f1'), pg_temp.t(13), '5500000001', 'ana', 'fa3'), 'tope_reagendados');
  perform pg_temp.esperar('caso 3 sin fila', (select count(*)::text from public.cita_reagendos where cita_origen_id = v_n2), '0');
  -- Las dos cancelaciones de citas por enlace son incidencias del candado (D2).
  perform pg_temp.esperar('caso 3 incidencias', (select count(*)::text from public.reserva_incidencias
                                                 where appointment_id in (v_n1, v_n2) and anulada_en is null), '2');
  -- Con un tope mayor, la tercera incidencia (otra cita por enlace cancelada) cierra el autoservicio: «bloqueado» de D3.
  update public.agenda_ajustes set candado_reagendados = 5 where clinica_id = '00000000-0000-4000-8000-000000e6c001';
  insert into public.appointments (id, clinica_id, medico_id, title, start_time, end_time, status, reserva_enlace_id, reserva_canal,
                                   reserva_nombre, reserva_telefono, reserva_correo, reserva_tel_hmac, reserva_correo_hmac,
                                   reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
  values ('00000000-0000-4000-8000-000000e6d0ff', '00000000-0000-4000-8000-000000e6c001', '00000000-0000-4000-8000-000000e6b001', 'Otra',
          pg_temp.t(40), pg_temp.t(40) + interval '30 min', 'scheduled', '00000000-0000-4000-8000-000000e6e001', 'fijo', 'Ana', '5500000001',
          'ana@prueba.local', pg_temp.h('t:5500000001'), pg_temp.h('c:ana'), 'v1-prueba-e6', now(), 0);
  update public.appointments set status = 'cancelled' where id = '00000000-0000-4000-8000-000000e6d0ff';
  perform pg_temp.esperar('caso 3 oferta con tope 5', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h2), 'ok/00000000-0000-4000-8000-000000e6e001');
  perform pg_temp.esperar('caso 3 bloqueado', pg_temp.r(v_h2, pg_temp.h('f1'), pg_temp.t(13), '5500000001', 'ana', 'fa3'), 'bloqueado');
  perform pg_temp.esperar('caso 3 bloqueado sin fila', (select count(*)::text from public.cita_reagendos where cita_origen_id = v_n2), '0');
  update public.agenda_ajustes set candado_reagendados = 2 where clinica_id = '00000000-0000-4000-8000-000000e6c001';
end $$;

-- ── Caso 4: lo que D3 rechaza se propaga y no deja fila; los inválidos ──
do $$
declare v_h3 text; v_h4 text; v_h5 text;
begin
  v_h3 := pg_temp.conf('00000000-0000-4000-8000-0000000e6003', '00000000-0000-4000-8000-000000e6c001',
                       '00000000-0000-4000-8000-000000e6d003', '00000000-0000-4000-8000-000000e6f001');
  perform pg_temp.esperar('caso 4 cancelar a03', pg_temp.responder('00000000-0000-4000-8000-000000e6c001', v_h3, 'cancelar'), 'cancelada');
  perform pg_temp.ficha('00000000-0000-4000-8000-000000e6e001', 'bea', 'fb1');
  perform pg_temp.esperar('caso 4 ocupado', pg_temp.r(v_h3, pg_temp.h('f1'), pg_temp.t(30), '5500000002', 'bea', 'fb1'), 'ocupado');
  perform pg_temp.esperar('caso 4 ocupado sin fila', (select count(*)::text from public.cita_reagendos where cita_origen_id = '00000000-0000-4000-8000-000000e6d003'), '0');
  -- Otro médico, enlace único, un hash que no es de enlace: inválido.
  perform pg_temp.esperar('caso 4 fijo de otro médico', pg_temp.r(v_h3, pg_temp.h('f2'), pg_temp.t(14), '5500000002', 'bea', 'fb1'), 'reagendar_invalido');
  perform pg_temp.esperar('caso 4 enlace único', pg_temp.r(v_h3, pg_temp.h('u1'), pg_temp.t(14), '5500000002', 'bea', null), 'reagendar_invalido');
  perform pg_temp.esperar('caso 4 enlace inventado', pg_temp.r(v_h3, pg_temp.h('nada'), pg_temp.t(14), '5500000002', 'bea', 'fb1'), 'reagendar_invalido');
  perform pg_temp.esperar('caso 4 confirmación inventada', pg_temp.r(pg_temp.h('nada'), pg_temp.h('f1'), pg_temp.t(14), '5500000002', 'bea', 'fb1'), 'reagendar_invalido');
  -- Sin respuesta y con «confirmo»: inválido, y la oferta no aplica.
  v_h4 := pg_temp.conf('00000000-0000-4000-8000-0000000e6004', '00000000-0000-4000-8000-000000e6c001',
                       '00000000-0000-4000-8000-000000e6d004', '00000000-0000-4000-8000-000000e6f001');
  perform pg_temp.esperar('caso 4 sin respuesta', pg_temp.r(v_h4, pg_temp.h('f1'), pg_temp.t(14), '5500000002', 'bea', 'fb1'), 'reagendar_invalido');
  v_h5 := pg_temp.conf('00000000-0000-4000-8000-0000000e6005', '00000000-0000-4000-8000-000000e6c001',
                       '00000000-0000-4000-8000-000000e6d005', '00000000-0000-4000-8000-000000e6f001');
  perform pg_temp.esperar('caso 4 confirmar a05', pg_temp.responder('00000000-0000-4000-8000-000000e6c001', v_h5, 'confirmar'), 'confirmada');
  perform pg_temp.esperar('caso 4 confirmada', pg_temp.r(v_h5, pg_temp.h('f1'), pg_temp.t(14), '5500000002', 'bea', 'fb1'), 'reagendar_invalido');
  perform pg_temp.esperar('caso 4 oferta confirmada', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h5), 'no_aplica');
  -- El personal reactiva la de origen: ya no se ofrece ni se reagenda.
  update public.appointments set status = 'scheduled' where id = '00000000-0000-4000-8000-000000e6d003';
  perform pg_temp.esperar('caso 4 reactivada oferta', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h3), 'no_aplica');
  perform pg_temp.esperar('caso 4 reactivada', pg_temp.r(v_h3, pg_temp.h('f1'), pg_temp.t(14), '5500000002', 'bea', 'fb1'), 'reagendar_invalido');
  update public.appointments set status = 'cancelled' where id = '00000000-0000-4000-8000-000000e6d003';
  -- Pasados 7 días de la respuesta: vencida.
  update public.cita_confirmaciones set respondido_en = now() - interval '7 days 1 minute' where id = '00000000-0000-4000-8000-0000000e6003';
  perform pg_temp.esperar('caso 4 vencida oferta', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h3), 'vencida');
  perform pg_temp.esperar('caso 4 vencida', pg_temp.r(v_h3, pg_temp.h('f1'), pg_temp.t(14), '5500000002', 'bea', 'fb1'), 'reagendar_invalido');
  update public.cita_confirmaciones set respondido_en = now() where id = '00000000-0000-4000-8000-0000000e6003';
  -- Sin enlace fijo vigente del médico: sin_enlace.
  update public.reserva_enlaces set revocado_en = now() where id = '00000000-0000-4000-8000-000000e6e001';
  perform pg_temp.esperar('caso 4 sin enlace', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h3), 'sin_enlace');
  perform pg_temp.esperar('caso 4 fijo revocado', pg_temp.r(v_h3, pg_temp.h('f1'), pg_temp.t(14), '5500000002', 'bea', 'fb1'), 'reagendar_invalido');
  update public.reserva_enlaces set revocado_en = null where id = '00000000-0000-4000-8000-000000e6e001';
  -- Interruptor apagado: apagado, y la oferta no aplica.
  update public.agenda_ajustes set agenda_v2_encendida = false where clinica_id = '00000000-0000-4000-8000-000000e6c001';
  perform pg_temp.esperar('caso 4 apagado oferta', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h3), 'no_aplica');
  perform pg_temp.esperar('caso 4 apagado', pg_temp.r(v_h3, pg_temp.h('f1'), pg_temp.t(14), '5500000002', 'bea', 'fb1'), 'apagado');
  update public.agenda_ajustes set agenda_v2_encendida = true where clinica_id = '00000000-0000-4000-8000-000000e6c001';
  -- Y con todo de vuelta, sí reagenda.
  perform pg_temp.esperar('caso 4 de vuelta', pg_temp.r(v_h3, pg_temp.h('f1'), pg_temp.t(14), '5500000002', 'bea', 'fb1'), 'ok');
  perform pg_temp.esperar('caso 4 el de vuelta quedó', (select count(*)::text from public.cita_reagendos where cita_origen_id = '00000000-0000-4000-8000-000000e6d003'), '1');
  -- Argumentos en NULL lanzan 22023, como en D3.
  begin
    perform pg_temp.r(null, pg_temp.h('f1'), pg_temp.t(15), '5500000002', 'bea', 'fb1');
    raise exception 'E6 caso 4: una confirmación en NULL no falló';
  exception when sqlstate '22023' then
    reset role;
  end;
end $$;

-- ── Caso 4c: un «repetida» de D3 que no es de este origen no cuenta como reagendado ──
-- (hallazgo 1 de la auditoría): el client_id ya reservó por el fijo SIN origen.
do $$
declare v_h4 text := pg_temp.h('codigo:00000000-0000-4000-8000-0000000e6004'); v_otra uuid;
begin
  perform pg_temp.esperar('caso 4c cancelar a04', pg_temp.responder('00000000-0000-4000-8000-000000e6c001', v_h4, 'cancelar'), 'cancelada');
  perform pg_temp.ficha('00000000-0000-4000-8000-000000e6e001', 'dani', 'fd1');
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_cita_id into v_otra from public.reservar_por_enlace('00000000-0000-4000-8000-000000e6c001', pg_temp.h('f1'),
    '00000000-0000-4000-8000-00000e6cc001', '00000000-0000-4000-8000-000000e6a001', pg_temp.t(20), 'Dani', '5500000004',
    'dani@prueba.local', pg_temp.h('t:5500000004'), pg_temp.h('c:dani'), pg_temp.h('ficha:fd1'), 'v1-prueba-e6', pg_temp.h('aviso'),
    '00000000-0000-4000-8000-00000000c4c1');
  reset role;
  if v_otra is null then raise exception 'E6 caso 4c: la reserva sin origen no entró'; end if;
  perform pg_temp.esperar('caso 4c repetida de D3', pg_temp.r(v_h4, pg_temp.h('f1'), pg_temp.t(20), '5500000004', 'dani', 'fd1',
                          '00000000-0000-4000-8000-00000000c4c1'), 'reagendar_invalido');
  perform pg_temp.esperar('caso 4c sin anotar', (select count(*)::text from public.cita_reagendos where cita_origen_id = '00000000-0000-4000-8000-000000e6d004'), '0');
  perform pg_temp.esperar('caso 4c sigue ofreciéndose', pg_temp.oferta('00000000-0000-4000-8000-000000e6c001', v_h4), 'ok/00000000-0000-4000-8000-000000e6e001');
end $$;

-- ── Caso 4d: tras reagendar, spinus.via queda limpio en la transacción ──
do $$
begin
  perform pg_temp.esperar('caso 4d via', coalesce(nullif(current_setting('spinus.via', true), ''), 'vacío'), 'vacío');
end $$;

-- ── Caso 5: clínica suspendida = no disponible ────────────────────────
do $$
declare v_h text;
begin
  v_h := pg_temp.conf('00000000-0000-4000-8000-0000000e6007', '00000000-0000-4000-8000-000000e6c002',
                      '00000000-0000-4000-8000-000000e6d007', '00000000-0000-4000-8000-000000e6f007');
  update public.cita_confirmaciones set respuesta = 'cancelo', respondido_en = now() where id = '00000000-0000-4000-8000-0000000e6007';
  perform pg_temp.ficha('00000000-0000-4000-8000-000000e6e007', 'ceci', 'fc1');
  perform pg_temp.esperar('caso 5 oferta', pg_temp.oferta('00000000-0000-4000-8000-000000e6c002', v_h), 'no_aplica');
  perform pg_temp.esperar('caso 5 reagendar', (select r_resultado from pg_temp.reag(v_h, pg_temp.h('f7'), pg_temp.t(10), '5500000007', 'ceci', 'fc1',
    gen_random_uuid(), '00000000-0000-4000-8000-000000e6c002', '00000000-0000-4000-8000-00000e6cc007', '00000000-0000-4000-8000-000000e6a007')), 'reagendar_invalido');
  perform pg_temp.esperar('caso 5 nada escrito', (select count(*)::text from public.appointments where clinica_id = '00000000-0000-4000-8000-000000e6c002'), '1');
  update public.clinicas set suspendida = false where id = '00000000-0000-4000-8000-000000e6c002';
  perform pg_temp.esperar('caso 5 reabierta', pg_temp.oferta('00000000-0000-4000-8000-000000e6c002', v_h), 'ok/00000000-0000-4000-8000-000000e6e007');
end $$;

-- ── Caso 6: permisos y RLS ────────────────────────────────────────────
do $$
declare v_rol text; v_fn text; n integer;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    foreach v_fn in array array[
        'select public.cita_reagendar_oferta(gen_random_uuid(), ''' || repeat('a', 64) || ''')',
        'select public.reagendar_por_enlace(''' || repeat('a', 64) || ''', gen_random_uuid(), ''' || repeat('a', 64)
          || ''', gen_random_uuid(), gen_random_uuid(), now(), ''x'', ''5500000000'', ''x@x.x'', null, null, null, ''v'', ''s'', gen_random_uuid())'] loop
      begin
        perform pg_temp.como('00000000-0000-4000-8000-000000e6b001');
        execute format('set local role %I', v_rol);
        execute v_fn;
        raise exception 'E6 caso 6: % ejecutó %', v_rol, v_fn;
      exception when insufficient_privilege then null;
      end;
      reset role;
    end loop;
  end loop;
  perform pg_temp.como('00000000-0000-4000-8000-000000e6b001');
  foreach v_fn in array array['select confirmacion_id from public.cita_reagendos', 'select * from public.cita_reagendos',
                              'insert into public.cita_reagendos (clinica_id) values (gen_random_uuid())',
                              'delete from public.cita_reagendos'] loop
    begin
      set local role authenticated;
      execute v_fn;
      raise exception 'E6 caso 6: authenticated pudo %', v_fn;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
  set local role authenticated;
  select count(*) into n from public.cita_reagendos;
  reset role;
  perform pg_temp.esperar('caso 6 administrador ve los de su clínica', n::text,
    (select count(*)::text from public.cita_reagendos where clinica_id = '00000000-0000-4000-8000-000000e6c001'));
  if n = 0 then raise exception 'E6 caso 6: el administrador no ve ningún reagendado'; end if;
  perform pg_temp.como('00000000-0000-4000-8000-000000e6b007');
  set local role authenticated;
  select count(*) into n from public.cita_reagendos;
  reset role;
  perform pg_temp.esperar('caso 6 otra clínica', n::text, '0');
  perform pg_temp.esperar('caso 6 tabla auditada', (select count(*)::text from public.audit_log where tabla = 'cita_reagendos'
                                                    and registro_id in (select id from public.cita_reagendos)),
                          (select count(*)::text from public.cita_reagendos));
end $$;

rollback;
