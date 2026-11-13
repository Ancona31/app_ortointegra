-- Agenda seg1 — correcciones de seguridad del enlace de reserva
-- (20261117130000_agenda_seg1_candado_correo.sql), puntos 1, 2, 5 y 6 de
-- Angel (mejora_agendaV2.md §6-bis, «Correcciones de seguridad tras la
-- revisión independiente»):
--   1. sin el correo verificado, la respuesta Y EL TRABAJO de la base no
--      dependen del teléfono (contadores de pg_stat_xact_user_tables);
--   2. lo automático del candado (1 activa, cancelaciones, bloqueo) decide
--      por el correo: un teléfono ajeno ni bloquea ni deja «ya tiene cita»;
--   5. un evento de todo el día del médico ocupa esos días en el enlace;
--   6. el bloqueo manual (teléfono o correo) corta también el enlace único.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- Los contadores de trabajo comparan llamadas idénticas: sin cambio de plan
-- (genérico tras 5 ejecuciones) entre una y otra.
set local plan_cache_mode = force_custom_plan;

-- ── Datos: c1 VIP encendida, médico b1 con consultorio k1, tipo de 30 min ──
insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-0000005e1c01', 'seg1 prueba', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000005e1b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'seg1-b1@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000005e1c01', es_admin_de_clinica = true,
                           nombres = 'Médico', apellido_paterno = 'Seg', especialidad = 'Ortopedia'
 where id = '00000000-0000-4000-8000-0000005e1b01';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000005e1c01', true);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone) values
  ('00000000-0000-4000-8000-0000005e1d01', '00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01',
   'Consultorio seg1', 'Seg', 'Calle 1', true, 'America/Mexico_City');
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo) values
  ('00000000-0000-4000-8000-0000005e1a01', '00000000-0000-4000-8000-0000005e1c01', null, 'Primera vez', 30, true);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
grant execute on function pg_temp.h(text) to anon, authenticated, service_role;

insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values
  ('v1-prueba-seg1', pg_temp.h('aviso'), true, now());
insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash) values
  ('00000000-0000-4000-8000-0000005e1f01', '00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01', 'fijo', pg_temp.h('f1'));

-- Un turno alineado dentro de la ventana (2 h a 60 días): días 2 a 9 por horas.
create function pg_temp.t(p_horas integer) returns timestamptz language sql as $$
  select date_trunc('hour', now()) + interval '2 days' + make_interval(hours => p_horas);
$$;

-- Llamadas como el servidor (service_role). Seudónimos: sha256('t:'||tel), sha256('c:'||correo),
-- sha256('ficha:'||ficha), sha256('cod:'||código), como en d3_reservar_por_enlace.sql.
create function pg_temp.r(p_hash text, p_inicio timestamptz, p_tel text, p_correo text, p_ficha text)
returns table (r_resultado text, r_cita_id uuid, r_inicio timestamptz, r_fin timestamptz, r_historial integer)
language plpgsql as $$
declare
  v_fh text := case when p_ficha is null then null else pg_temp.h('ficha:' || p_ficha) end;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  return query select * from public.reservar_por_enlace('00000000-0000-4000-8000-0000005e1c01', p_hash,
    '00000000-0000-4000-8000-0000005e1d01', '00000000-0000-4000-8000-0000005e1a01', p_inicio, 'Persona Prueba',
    p_tel, p_correo || '@prueba.local', pg_temp.h('t:' || p_tel), pg_temp.h('c:' || p_correo), v_fh,
    'v1-prueba-seg1', pg_temp.h('aviso'), gen_random_uuid());
  reset role;
end $$;
create function pg_temp.res(p_hash text, p_inicio timestamptz, p_tel text, p_correo text, p_ficha text) returns text
language sql as $$ select r_resultado from pg_temp.r(p_hash, p_inicio, p_tel, p_correo, p_ficha) $$;
-- Pide y verifica el código de ese correo en el fijo: deja la ficha `ficha-<correo>`.
create function pg_temp.verificado(p_correo text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  perform public.reserva_codigo_emitir('00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1f01',
                                       pg_temp.h('c:' || p_correo), pg_temp.h('cod:123456'));
  v := public.reserva_codigo_verificar('00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1f01',
                                       pg_temp.h('c:' || p_correo), pg_temp.h('cod:123456'), pg_temp.h('ficha:ficha-' || p_correo));
  reset role;
  if v <> 'ok' then raise exception 'seg1: no se pudo verificar el correo % (%)', p_correo, v; end if;
  return 'ficha-' || p_correo;
end $$;
-- Un enlace único nuevo de b1 (como postgres, vigencia a mano). Devuelve su hash.
create function pg_temp.unico(p_nombre text) returns text language sql as $$
  insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en)
  values (gen_random_uuid(), '00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01', 'unico', pg_temp.h(p_nombre), 7, now() + interval '7 days')
  returning codigo_hash;
$$;
-- Una cita por enlace a mano (como postgres), activa y futura.
create function pg_temp.cita(p_inicio timestamptz, p_tel text, p_correo text) returns uuid language sql as $$
  insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, reserva_enlace_id, reserva_canal,
    reserva_nombre, reserva_telefono, reserva_correo, reserva_tel_hmac, reserva_correo_hmac, reserva_aviso_version,
    reserva_aceptado_en, reserva_historial_previo)
  values ('00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01', 'Persona', p_inicio, p_inicio + interval '30 min',
          '00000000-0000-4000-8000-0000005e1f01', 'fijo', 'Persona', p_tel, p_correo || '@prueba.local',
          pg_temp.h('t:' || p_tel), pg_temp.h('c:' || p_correo), 'v1-prueba-seg1', now(), 0)
  returning id;
$$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'seg1 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
-- El trabajo de la base en ESTA transacción, por tabla de public (contadores de pg_stat_xact_user_tables).
create function pg_temp.foto() returns jsonb language sql as $$
  select coalesce(jsonb_object_agg(s.relname, jsonb_build_array(s.seq_scan, s.seq_tup_read, coalesce(s.idx_scan, 0),
                                   coalesce(s.idx_tup_fetch, 0), s.n_tup_ins, s.n_tup_upd, s.n_tup_del)), '{}'::jsonb)
    from pg_stat_xact_user_tables s where s.schemaname = 'public';
$$;
-- Lo que cambió entre dos fotos (sólo las tablas que se movieron).
create function pg_temp.resta(p_antes jsonb, p_despues jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_object_agg(d.key, d.value), '{}'::jsonb)
    from (select k.key, (select jsonb_agg((p_despues -> k.key ->> n)::bigint - coalesce((p_antes -> k.key ->> n)::bigint, 0) order by n)
                           from generate_series(0, 6) n) as value
            from jsonb_object_keys(p_despues) k(key)) d
   where d.value <> '[0,0,0,0,0,0,0]'::jsonb;
$$;
grant execute on function pg_temp.t(integer), pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

-- ── Historial de los teléfonos «sucios» (los deja un tercero con SU correo) ──
--   A 5511110001: una cita activa y tres canceladas, cada una con otro correo.
--   C 5511110003: sólo una cita activa (del correo «atac3»).
--   E 5511110005: bloqueado A MANO por la clínica (por el teléfono).
--   B 5511110002: limpio.
do $$
declare v uuid;
begin
  perform pg_temp.cita(pg_temp.t(150), '5511110001', 'victima');
  for i in 1..3 loop
    v := pg_temp.cita(pg_temp.t(150 + i), '5511110001', 'tercero' || i);
    update public.appointments set status = 'cancelled' where id = v;
  end loop;
  perform pg_temp.cita(pg_temp.t(160), '5511110003', 'atac3');
end $$;
insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en) values
  ('00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01', pg_temp.h('t:5511110005'), 'telefono', now());

-- ── Caso 1 (punto 1): sin correo verificado, tres teléfonos (con historial, bloqueado a mano y
--    limpio) dan la MISMA respuesta y la base hace EXACTAMENTE el mismo trabajo ──
do $$
declare
  f0 jsonb; f1 jsonb; f2 jsonb; f3 jsonb;
  ra text; re text; rb text;
begin
  f0 := pg_temp.foto();
  ra := pg_temp.res(pg_temp.h('f1'), pg_temp.t(10), '5511110001', 'atacante', null);
  f1 := pg_temp.foto();
  re := pg_temp.res(pg_temp.h('f1'), pg_temp.t(10), '5511110005', 'atacante', null);
  f2 := pg_temp.foto();
  rb := pg_temp.res(pg_temp.h('f1'), pg_temp.t(10), '5511110002', 'atacante', null);
  f3 := pg_temp.foto();
  perform pg_temp.esperar('caso 1 respuesta A', ra, 'correo_sin_verificar');
  perform pg_temp.esperar('caso 1 respuesta E', re, 'correo_sin_verificar');
  perform pg_temp.esperar('caso 1 respuesta B', rb, 'correo_sin_verificar');
  if pg_temp.resta(f0, f1) <> pg_temp.resta(f2, f3) or pg_temp.resta(f1, f2) <> pg_temp.resta(f2, f3) then
    raise exception 'seg1 caso 1: el trabajo depende del teléfono. A=% E=% B=%',
      pg_temp.resta(f0, f1), pg_temp.resta(f1, f2), pg_temp.resta(f2, f3);
  end if;
  -- Y no leyó nada del candado: ni incidencias ni contactos.
  if pg_temp.resta(f2, f3) ? 'reserva_incidencias' or pg_temp.resta(f2, f3) ? 'reserva_contactos' then
    raise exception 'seg1 caso 1: sin correo verificado se leyó el candado (%)', pg_temp.resta(f2, f3);
  end if;
end $$;

-- ── Caso 2 (puntos 1 y 2): con SU correo verificado, el teléfono con historial y el limpio
--    reservan igual; el historial que queda en la cita es el del correo (0) ──
do $$
declare va record; vb record;
begin
  select * into va from pg_temp.r(pg_temp.h('f1'), pg_temp.t(10), '5511110001', 'atac1', pg_temp.verificado('atac1'));
  select * into vb from pg_temp.r(pg_temp.h('f1'), pg_temp.t(12), '5511110002', 'atac2', pg_temp.verificado('atac2'));
  perform pg_temp.esperar('caso 2 teléfono con historial', va.r_resultado, 'ok');
  perform pg_temp.esperar('caso 2 teléfono limpio', vb.r_resultado, 'ok');
  perform pg_temp.esperar('caso 2 historial devuelto', va.r_historial::text || '/' || vb.r_historial::text, '0/0');
  if (select reserva_historial_previo from public.appointments where id = va.r_cita_id) <> 0 then
    raise exception 'seg1 caso 2: la cita guardó el historial del teléfono ajeno';
  end if;
end $$;

-- ── Caso 3 (punto 2): un tercero no deja a nadie con «ya tiene cita» con su teléfono; el
--    correo sí sigue contando ──
do $$
begin
  perform pg_temp.esperar('caso 3 dueño del teléfono C', pg_temp.res(pg_temp.h('f1'), pg_temp.t(14), '5511110003', 'vic3',
          pg_temp.verificado('vic3')), 'ok');
  perform pg_temp.esperar('caso 3 el correo con cita activa', pg_temp.res(pg_temp.h('f1'), pg_temp.t(16), '5511110009', 'atac3',
          pg_temp.verificado('atac3')), 'ya_tiene_cita');
end $$;

-- ── Caso 4 (punto 2): las cancelaciones bloquean por el CORREO; las del teléfono, no.
--    Estado, lista de la clínica e historial cuentan por correo ──
do $$
declare
  v uuid;
  e record;
  v_lista integer;
  v_lista_a integer;
begin
  for i in 1..3 loop
    v := pg_temp.cita(pg_temp.t(170 + i), '55222200' || lpad(i::text, 2, '0'), 'reinc');
    update public.appointments set status = 'cancelled' where id = v;
  end loop;
  perform pg_temp.esperar('caso 4 correo con 3 cancelaciones', pg_temp.res(pg_temp.h('f1'), pg_temp.t(18), '5511110008', 'reinc',
          pg_temp.verificado('reinc')), 'bloqueado');
  select * into e from public.reserva_contacto_estado('00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01',
                                                      pg_temp.h('t:5511110001'), pg_temp.h('c:nadie'));
  if e.bloqueado or e.cancelaciones <> 0 then
    raise exception 'seg1 caso 4: el teléfono con 3 cancelaciones ajenas cuenta (%)', row_to_json(e);
  end if;
  select * into e from public.reserva_contacto_estado('00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01',
                                                      pg_temp.h('t:5511119999'), pg_temp.h('c:reinc'));
  if not e.bloqueado or e.manual or e.cancelaciones <> 3 then
    raise exception 'seg1 caso 4: el correo con 3 cancelaciones no bloquea (%)', row_to_json(e);
  end if;
  -- La lista de la clínica: las citas de «reinc» sí; las del teléfono A con otros correos, no.
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000005e1b01', 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_lista from public.reserva_contactos_bloqueados() where correo = 'reinc@prueba.local';
  select count(*) into v_lista_a from public.reserva_contactos_bloqueados() where telefono = '5511110001' and not manual;
  reset role;
  perform pg_temp.esperar('caso 4 lista: correo bloqueado', (v_lista > 0)::text, 'true');
  perform pg_temp.esperar('caso 4 lista: teléfono ajeno', v_lista_a::text, '0');
end $$;

-- ── Caso 5 (punto 6): el bloqueo MANUAL corta también el enlace único, por teléfono o por
--    correo; el único se sigue saltando lo automático ──
do $$
begin
  perform pg_temp.esperar('caso 5 fijo, teléfono bloqueado a mano', pg_temp.res(pg_temp.h('f1'), pg_temp.t(20), '5511110005', 'nuevo5',
          pg_temp.verificado('nuevo5')), 'bloqueado');
  perform pg_temp.esperar('caso 5 único, teléfono bloqueado a mano', pg_temp.res(pg_temp.unico('u-e'), pg_temp.t(20), '5511110005',
          'otro5', null), 'bloqueado');
  insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, bloqueado_en) values
    ('00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01', pg_temp.h('c:manualc'), 'correo', now());
  perform pg_temp.esperar('caso 5 único, correo bloqueado a mano', pg_temp.res(pg_temp.unico('u-c'), pg_temp.t(20), '5511110006',
          'manualc', null), 'bloqueado');
  -- Lo automático no corta el único: 3 cancelaciones del correo y una cita activa del correo.
  perform pg_temp.esperar('caso 5 único con bloqueo automático', pg_temp.res(pg_temp.unico('u-r'), pg_temp.t(22), '5511110007',
          'reinc', null), 'ok');
  perform pg_temp.esperar('caso 5 único con cita activa', pg_temp.res(pg_temp.unico('u-a'), pg_temp.t(24), '5511110007',
          'atac3', null), 'ok');
  -- Desbloqueado (después del bloqueo), el teléfono vuelve a servir en el único.
  update public.reserva_contactos set perdonado_en = now(), bloqueado_en = now() - interval '1 hour'
   where clave_hmac = pg_temp.h('t:5511110005');
  perform pg_temp.esperar('caso 5 único tras desbloquear', pg_temp.res(pg_temp.unico('u-e2'), pg_temp.t(26), '5511110005',
          'otro5', null), 'ok');
end $$;

-- ── Caso 6 (punto 5): un evento de todo el día del médico ocupa esos días en el enlace (de
--    Spinus o de Google); cancelado o no_show, no (P3); el día siguiente, libre ──
create function pg_temp.dia(p_horas integer) returns timestamptz language sql as $$
  select (date_trunc('day', pg_temp.t(p_horas) at time zone 'America/Mexico_City') at time zone 'America/Mexico_City');
$$;
insert into public.appointments (clinica_id, medico_id, title, start_time, end_time, status, origen, all_day, consultorio_timezone) values
  ('00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01', 'Vacaciones',
   pg_temp.dia(200), pg_temp.dia(200) + interval '1 day', 'scheduled', 'spinus', true, 'America/Mexico_City'),
  ('00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01', 'Congreso (Google)',
   pg_temp.dia(272), pg_temp.dia(272) + interval '1 day', 'scheduled', 'google', true, 'America/Mexico_City'),
  ('00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01', 'Cancelado',
   pg_temp.dia(320), pg_temp.dia(320) + interval '1 day', 'cancelled', 'spinus', true, 'America/Mexico_City'),
  ('00000000-0000-4000-8000-0000005e1c01', '00000000-0000-4000-8000-0000005e1b01', 'Faltó',
   pg_temp.dia(368), pg_temp.dia(368) + interval '1 day', 'no_show', 'spinus', true, 'America/Mexico_City');
do $$
declare v_n integer;
begin
  perform pg_temp.esperar('caso 6 todo el día (Spinus), por la mañana', pg_temp.res(pg_temp.unico('d1'),
          pg_temp.dia(200) + interval '9 hours', '5511110101', 'dia1', null), 'ocupado');
  perform pg_temp.esperar('caso 6 todo el día (Spinus), por la noche', pg_temp.res(pg_temp.unico('d2'),
          pg_temp.dia(200) + interval '23 hours', '5511110102', 'dia2', null), 'ocupado');
  perform pg_temp.esperar('caso 6 todo el día (Google)', pg_temp.res(pg_temp.unico('d3'),
          pg_temp.dia(272) + interval '12 hours', '5511110103', 'dia3', null), 'ocupado');
  perform pg_temp.esperar('caso 6 el día siguiente, libre', pg_temp.res(pg_temp.unico('d4'),
          pg_temp.dia(200) + interval '1 day 9 hours', '5511110104', 'dia4', null), 'ok');
  perform pg_temp.esperar('caso 6 todo el día cancelado no ocupa', pg_temp.res(pg_temp.unico('d5'),
          pg_temp.dia(320) + interval '10 hours', '5511110105', 'dia5', null), 'ok');
  perform pg_temp.esperar('caso 6 todo el día no_show no ocupa', pg_temp.res(pg_temp.unico('d6'),
          pg_temp.dia(368) + interval '10 hours', '5511110106', 'dia6', null), 'ok');
  -- reserva_ocupacion lo devuelve (es lo que la página usa para no ofrecer turnos ese día).
  set local role service_role;
  select count(*) into v_n from public.reserva_ocupacion('00000000-0000-4000-8000-0000005e1c01',
         '00000000-0000-4000-8000-0000005e1f01', pg_temp.dia(200), pg_temp.dia(200) + interval '1 day')
   where start_time = pg_temp.dia(200) and end_time = pg_temp.dia(200) + interval '1 day';
  reset role;
  perform pg_temp.esperar('caso 6 ocupación del día de vacaciones', v_n::text, '1');
end $$;

rollback;
