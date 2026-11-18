-- Agenda tanda K, punto 14 — el enlace FIJO pausado
-- (20261123140000_agenda_k3_huso_clinica_pausa_enlace.sql).
-- Mutaciones comprobadas en rojo (notas_k3.md):
--   · reservar_por_enlace sin «OR v_enl.pausado_en IS NOT NULL» → «caso 3»;
--   · reserva_contexto sin su guarda → «caso 2»;
--   · sin reserva_enlaces_pausado_check → «caso 1»;
--   · reserva_ocupacion sin su guarda → «caso 4» y «caso 6».
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- ── Datos: c1 VIP encendida, médico b1 (admin) con consultorio k1, b2 invitado; tipo de 30 min ──
insert into public.clinicas (id, nombre, es_vip_grant) values
  ('00000000-0000-4000-8000-00000b03c001', 'k3 prueba', true);
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-00000b03b001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'k3-b1@prueba.local', now(), now()),
  ('00000000-0000-4000-8000-00000b03b002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'k3-b2@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-00000b03c001', es_admin_de_clinica = true,
                           nombres = 'Médico', apellido_paterno = 'Ktres', especialidad = 'Ortopedia'
 where id = '00000000-0000-4000-8000-00000b03b001';
update public.profiles set clinica_id = '00000000-0000-4000-8000-00000b03c001', es_admin_de_clinica = false,
                           nombres = 'Invitada', apellido_paterno = 'Ktres', especialidad = 'Ortopedia'
 where id = '00000000-0000-4000-8000-00000b03b002';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-00000b03c001', true);
insert into public.consultorios (id, clinica_id, medico_id, nombre, nombre_corto, direccion, activo, timezone) values
  ('00000000-0000-4000-8000-00000b03d001', '00000000-0000-4000-8000-00000b03c001', '00000000-0000-4000-8000-00000b03b001',
   'Consultorio k3', 'Ktres', 'Calle 3', true, 'America/Mexico_City');
insert into public.tipos_cita (id, clinica_id, medico_id, nombre, duracion_min, activo) values
  ('00000000-0000-4000-8000-00000b03a001', '00000000-0000-4000-8000-00000b03c001', null, 'Primera vez', 30, true);

create function pg_temp.h(p text) returns text language sql as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;
insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en) values
  ('v1-prueba-k3', pg_temp.h('aviso'), true, now());

-- Como el servidor: emite por la RPC de la clínica (service_role).
create function pg_temp.emitir(p_nombre text, p_clase text) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  perform public.reserva_enlace_emitir('00000000-0000-4000-8000-00000b03c001', '00000000-0000-4000-8000-00000b03b001',
    v, '00000000-0000-4000-8000-00000b03b001', p_clase, pg_temp.h(p_nombre), null);
  reset role;
  return v;
end $$;
-- Como la sesión de un médico (la ruta PATCH usa el cliente de sesión): pausa o reanuda; devuelve cuántas filas cambió.
create function pg_temp.pausar(p_quien uuid, p_id uuid, p_pausar boolean) returns integer language plpgsql as $$
declare n integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_quien, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.reserva_enlaces set pausado_en = case when p_pausar then now() end
   where id = p_id and revocado_en is null;
  get diagnostics n = row_count;
  reset role;
  return n;
end $$;
create function pg_temp.ctx(p_nombre text) returns text language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  r := public.reserva_contexto(pg_temp.h(p_nombre), 'v1-prueba-k3', pg_temp.h('aviso'));
  reset role;
  return coalesce(r ->> 'estado', '<null>');
end $$;
create function pg_temp.reservar(p_nombre text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  select r_resultado into v from public.reservar_por_enlace('00000000-0000-4000-8000-00000b03c001', pg_temp.h(p_nombre),
    '00000000-0000-4000-8000-00000b03d001', '00000000-0000-4000-8000-00000b03a001',
    date_trunc('hour', now()) + interval '2 days 10 hours', 'Persona Prueba', '5544440301', 'k3@prueba.local',
    pg_temp.h('t:5544440301'), pg_temp.h('c:k3'), null, 'v1-prueba-k3', pg_temp.h('aviso'), gen_random_uuid());
  reset role;
  return v;
end $$;
create function pg_temp.codigo(p_id uuid) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  set local role service_role;
  v := public.reserva_codigo_emitir('00000000-0000-4000-8000-00000b03c001', p_id, pg_temp.h('c:k3'), pg_temp.h(gen_random_uuid()::text));
  reset role;
  return v;
end $$;
create function pg_temp.esperar(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'k3 %: dio %, esperaba %', p_caso, p_obtenido, p_esperado;
  end if;
end $$;
grant execute on function pg_temp.h(text), pg_temp.esperar(text, text, text) to anon, authenticated, service_role;

-- ── Caso 1: sólo el FIJO se pausa; el único, no (CHECK) ──
do $$
declare v_u uuid := pg_temp.emitir('k3-u1', 'unico');
begin
  begin
    update public.reserva_enlaces set pausado_en = now() where id = v_u;
    raise exception 'k3 caso 1: un único se dejó pausar';
  exception when check_violation then null;
  end;
end $$;

-- ── Caso 2: la página (reserva_contexto) no abre un fijo pausado, igual que uno que no existe; al reanudar, el MISMO código abre ──
do $$
declare v_f uuid := pg_temp.emitir('k3-f1', 'fijo');
begin
  perform pg_temp.esperar('caso 2 prendido', pg_temp.ctx('k3-f1'), 'vigente');
  perform pg_temp.esperar('caso 2 pausa la sesión del dueño', pg_temp.pausar('00000000-0000-4000-8000-00000b03b001', v_f, true)::text, '1');
  perform pg_temp.esperar('caso 2 pausado = no existe', pg_temp.ctx('k3-f1'), pg_temp.ctx('k3-no-existe'));
  perform pg_temp.esperar('caso 2 pausado', pg_temp.ctx('k3-f1'), '<null>');
  perform pg_temp.esperar('caso 2 reanuda', pg_temp.pausar('00000000-0000-4000-8000-00000b03b001', v_f, false)::text, '1');
  perform pg_temp.esperar('caso 2 mismo código', pg_temp.ctx('k3-f1'), 'vigente');
end $$;

-- ── Caso 3: la RPC de reserva rechaza un fijo pausado con lo MISMO que uno revocado; prendido pasa de ahí ──
do $$
declare v_f uuid := (select id from public.reserva_enlaces where codigo_hash = pg_temp.h('k3-f1'));
begin
  perform pg_temp.pausar('00000000-0000-4000-8000-00000b03b001', v_f, true);
  perform pg_temp.esperar('caso 3 pausado', pg_temp.reservar('k3-f1'), 'enlace_invalido');
  perform pg_temp.esperar('caso 3 pausado = no existe', pg_temp.reservar('k3-f1'), pg_temp.reservar('k3-no-existe'));
  perform pg_temp.esperar('caso 3 código de correo pausado', pg_temp.codigo(v_f), 'enlace_invalido');
  perform pg_temp.pausar('00000000-0000-4000-8000-00000b03b001', v_f, false);
  -- Prendido, la reserva ya no se para en el enlace (se para en el correo sin verificar, que es lo siguiente).
  perform pg_temp.esperar('caso 3 prendido', pg_temp.reservar('k3-f1'), 'correo_sin_verificar');
  perform pg_temp.esperar('caso 3 código de correo prendido', pg_temp.codigo(v_f), 'ok');
end $$;

-- ── Caso 4: las otras cuatro funciones públicas llevan la guarda (forma) ──
do $$
declare n integer;
begin
  select count(*) into n from pg_proc p
   where p.oid in (to_regprocedure('public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)'),
                   to_regprocedure('public.cita_reagendar_oferta(uuid, text)'),
                   to_regprocedure('public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)'),
                   to_regprocedure('public.reserva_codigo_emitir(uuid, uuid, text, text)'))
     and p.prosrc like '%e.revocado_en IS NULL AND e.pausado_en IS NULL%';
  perform pg_temp.esperar('caso 4 guardas', n::text, '4');
end $$;

-- ── Caso 5: la invitada no pausa el enlace de otro médico (RLS); «Cambiar por uno nuevo» revoca el pausado y el nuevo nace prendido ──
do $$
declare v_f uuid := (select id from public.reserva_enlaces where codigo_hash = pg_temp.h('k3-f1')); v_n uuid;
begin
  perform pg_temp.esperar('caso 5 invitada', pg_temp.pausar('00000000-0000-4000-8000-00000b03b002', v_f, true)::text, '0');
  perform pg_temp.pausar('00000000-0000-4000-8000-00000b03b001', v_f, true);
  v_n := pg_temp.emitir('k3-f2', 'fijo');
  perform pg_temp.esperar('caso 5 el viejo, revocado', (select (revocado_en is not null)::text from public.reserva_enlaces where id = v_f), 'true');
  perform pg_temp.esperar('caso 5 el nuevo, prendido', (select (pausado_en is null)::text from public.reserva_enlaces where id = v_n), 'true');
  perform pg_temp.esperar('caso 5 el nuevo abre', pg_temp.ctx('k3-f2'), 'vigente');
end $$;

-- ── Caso 6 (catálogo): TODA función de public que mire «revocado» de reserva_enlaces mira también «pausado»,
--    salvo las que sólo escriben (emitir, regenerar, restablecer: revocan el pausado también, caso 5) ──
do $$
declare v text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosrc ilike '%reserva_enlaces%'
     and p.prosrc ~ '(\me|v_e|v_enl)\.revocado_en IS (NOT )?NULL'
     and p.prosrc not like '%pausado_en%'
     and p.proname not in ('reserva_enlace_emitir', 'reserva_enlace_regenerar_fijo', 'agenda_restablecer_configuracion', 'proteger_reserva_enlaces');
  perform pg_temp.esperar('caso 6 funciones sin la guarda', coalesce(v, '<ninguna>'), '<ninguna>');
end $$;

rollback;
