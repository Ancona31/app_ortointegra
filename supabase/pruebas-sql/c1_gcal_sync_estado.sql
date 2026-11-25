-- Agenda C1 — estado de la sincronización con Google, candado y la puerta S3
-- (20261113120000_agenda_c1_gcal_sync_estado.sql).
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en
-- rollback: no deja nada en la base ni depende de la semilla.
begin;

-- ── Datos ─────────────────────────────────────────────────────────────
-- Clínicas de la puerta S3 (los cuatro casos de CLAUDE.md + suspendida):
--   c1 VIP · c2 suscripción activa · c3 free virgen · c4 free degradada · c5 VIP suspendida
-- c1 y c6 tienen además conexión de Google; c6 queda con el interruptor apagado.
insert into public.clinicas (id, nombre, es_vip_grant, stripe_subscription_id, suscripcion_estado, suspendida) values
  ('00000000-0000-4000-8000-00000000c1c1', 'C1 VIP',              true,  null,       'free',      false),
  ('00000000-0000-4000-8000-00000000c1c2', 'C1 activa',           false, 'sub_c1_2', 'activo',    false),
  ('00000000-0000-4000-8000-00000000c1c3', 'C1 free virgen',      false, null,       'free',      false),
  ('00000000-0000-4000-8000-00000000c1c4', 'C1 free degradada',   false, 'sub_c1_4', 'cancelado', false),
  ('00000000-0000-4000-8000-00000000c1c5', 'C1 VIP suspendida',   true,  null,       'free',      true),
  ('00000000-0000-4000-8000-00000000c1c6', 'C1 apagada',          false, null,       'free',      false);
-- Un usuario por clínica (handle_new_user crea el perfil; se le asigna la clínica como postgres).
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select ('00000000-0000-4000-8000-00000000c1a' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'c1-admin-' || n || '@prueba.local', now(), now()
  from generate_series(1, 6) n;
update public.profiles p set clinica_id = ('00000000-0000-4000-8000-00000000c1c' || right(p.id::text, 1))::uuid,
                             es_admin_de_clinica = true
 where p.id::text like '00000000-0000-4000-8000-00000000c1a_';

insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values
  ('00000000-0000-4000-8000-00000000c1c1', true),
  ('00000000-0000-4000-8000-00000000c1c6', false);
insert into public.clinica_conexiones_google (id, clinica_id, user_id, rol, calendar_id, estado) values
  ('00000000-0000-4000-8000-00000000c1e1', '00000000-0000-4000-8000-00000000c1c1',
   '00000000-0000-4000-8000-00000000c1a1', 'clinica', 'cal-c1@group.calendar.google.com', 'activa'),
  ('00000000-0000-4000-8000-00000000c1e6', '00000000-0000-4000-8000-00000000c1c6',
   '00000000-0000-4000-8000-00000000c1a6', 'clinica', 'cal-c6@group.calendar.google.com', 'activa');

-- La puerta ORIGINAL vista por el usuario de la clínica: rol authenticated y su
-- JWT, sólo dentro de esta prueba (rollback al final). Se crea antes de
-- cambiar de rol: postgres le quita EXECUTE a PUBLIC también en pg_temp.
create function pg_temp.original(p_usuario uuid) returns boolean language plpgsql as $$
declare v_ok boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := public.clinica_no_suspendida() and public.clinica_tiene_acceso();
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v_ok;
end $$;
create function pg_temp.solo_acceso(p_usuario uuid) returns boolean language plpgsql as $$
declare v_ok boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := public.clinica_tiene_acceso();
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v_ok;
end $$;
-- La nueva, como la llama el servidor: service_role, SIN claims.
create function pg_temp.nueva(p_clinica uuid) returns boolean language plpgsql as $$
declare v_ok boolean;
begin
  set local role service_role;
  v_ok := public.gcal_sync_clinica_habilitada(p_clinica);
  reset role;
  return v_ok;
end $$;

-- ── Caso 1 (S3): mismo veredicto que la original en VIP, activa, free virgen y free degradada ──
do $$
declare
  r record;
begin
  for r in select * from (values
      (1, true,  'VIP'), (2, true, 'suscripción activa'), (3, true, 'free virgen'), (4, false, 'free degradada'))
      v(n, esperado, caso)
  loop
    if pg_temp.solo_acceso(('00000000-0000-4000-8000-00000000c1a' || r.n)::uuid) is distinct from r.esperado then
      raise exception 'C1 caso 1 (%): la ORIGINAL no da % — los datos de prueba no son el caso que dicen', r.caso, r.esperado;
    end if;
    if pg_temp.nueva(('00000000-0000-4000-8000-00000000c1c' || r.n)::uuid)
       is distinct from pg_temp.solo_acceso(('00000000-0000-4000-8000-00000000c1a' || r.n)::uuid) then
      raise exception 'C1 caso 1 (%): gcal_sync_clinica_habilitada difiere de clinica_tiene_acceso()', r.caso;
    end if;
    if pg_temp.nueva(('00000000-0000-4000-8000-00000000c1c' || r.n)::uuid)
       is distinct from pg_temp.original(('00000000-0000-4000-8000-00000000c1a' || r.n)::uuid) then
      raise exception 'C1 caso 1 (%): difiere de las dos puertas del INSERT', r.caso;
    end if;
  end loop;
end $$;

-- Caso 2 (S3): suspendida — la original de acceso dice true (VIP), las dos puertas false, la nueva false
do $$
begin
  if pg_temp.solo_acceso('00000000-0000-4000-8000-00000000c1a5') is not true
     or pg_temp.original('00000000-0000-4000-8000-00000000c1a5') is not false
     or pg_temp.nueva('00000000-0000-4000-8000-00000000c1c5') is not false then
    raise exception 'C1 caso 2: una clínica suspendida no da el veredicto de las dos puertas';
  end if;
  -- Clínica inexistente: false, sin error.
  if pg_temp.nueva('00000000-0000-4000-8000-00000000dead') is not false then
    raise exception 'C1 caso 2: una clínica inexistente no da false';
  end if;
end $$;

-- Caso 3 (S3): la nueva no lee ni toca la sesión; no lleva el predicado copiado
do $$
declare v_src text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-00000000c1a4')::text, true);
  -- Con el JWT del usuario de la clínica DEGRADADA puesto, la nueva sigue diciendo true para la VIP:
  -- no decide por la sesión.
  set local role service_role;
  if public.gcal_sync_clinica_habilitada('00000000-0000-4000-8000-00000000c1c1') is not true then
    raise exception 'C1 caso 3: la nueva se dejó llevar por request.jwt.claims';
  end if;
  reset role;
  if current_setting('request.jwt.claims', true)::jsonb ->> 'sub' <> '00000000-0000-4000-8000-00000000c1a4' then
    raise exception 'C1 caso 3: la nueva cambió request.jwt.claims';
  end if;
  perform set_config('request.jwt.claims', '', true);
  select prosrc into v_src from pg_proc where oid = 'public.gcal_sync_clinica_habilitada(uuid)'::regprocedure;
  -- Ni las columnas de RN-1 ni de suspensión, ni una llamada a set_config( ni SET ROLE.
  -- (Los nombres request.jwt y set_config SÍ aparecen, dentro de su lista de prohibidos.)
  if v_src ~* '(\m(es_vip_grant|ha_tenido_acceso_premium|suscripcion_estado|stripe_subscription_id|suspendida)\M|set_config\s*\(|set\s+(local\s+)?role)' then
    raise exception 'C1 caso 3: la nueva copia el predicado o toca la sesión';
  end if;
end $$;

-- Caso 4: anon y authenticated no ejecutan ninguna de las seis (42501)
do $$
declare
  v_rol text;
  v_llamada text;
  v_ok boolean;
begin
  foreach v_rol in array array['anon', 'authenticated'] loop
    foreach v_llamada in array array[
        $q$select public.gcal_sync_clinica_habilitada('00000000-0000-4000-8000-00000000c1c1')$q$,
        $q$select * from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c1c1', '00000000-0000-4000-8000-00000000c1e1', 'x', 60, 0)$q$,
        $q$select public.gcal_sync_avanzar('00000000-0000-4000-8000-00000000c1c1', gen_random_uuid(), null, 't', null, 60)$q$,
        $q$select public.gcal_sync_reiniciar('00000000-0000-4000-8000-00000000c1c1', gen_random_uuid())$q$,
        $q$select public.gcal_sync_soltar('00000000-0000-4000-8000-00000000c1c1', gen_random_uuid(), null)$q$,
        $q$select * from public.gcal_sync_clinicas_pendientes(10)$q$] loop
      v_ok := false;
      begin
        execute format('set local role %I', v_rol);
        execute v_llamada;
      exception when insufficient_privilege then
        v_ok := true;
      end;
      reset role;
      if not v_ok then
        raise exception 'C1 caso 4: % ejecutó %', v_rol, v_llamada;
      end if;
    end loop;
  end loop;
  -- Ni la tabla.
  v_ok := false;
  begin
    set local role authenticated;
    perform 1 from public.gcal_sync_estado;
  exception when insufficient_privilege then
    v_ok := true;
  end;
  reset role;
  if not v_ok then raise exception 'C1 caso 4: authenticated lee gcal_sync_estado'; end if;
end $$;

-- A partir de aquí, como el servidor.
set local role service_role;

-- Caso 5: tomar dos veces seguidas — el segundo no toca (0 filas)
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c1c1',
    '00000000-0000-4000-8000-00000000c1e1', 'cal-c1@group.calendar.google.com', 60, 0);
  if v_n <> 1 then raise exception 'C1 caso 5: el primer tomar no tomó (% filas)', v_n; end if;
  select count(*) into v_n from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c1c1',
    '00000000-0000-4000-8000-00000000c1e1', 'cal-c1@group.calendar.google.com', 60, 0);
  if v_n <> 0 then raise exception 'C1 caso 5: el segundo tomar también tomó'; end if;
  if (select fase from public.gcal_sync_estado where clinica_id = '00000000-0000-4000-8000-00000000c1c1') <> 'completa' then
    raise exception 'C1 caso 5: una clínica nueva no empieza en completa';
  end if;
end $$;

-- Caso 6: avanzar con testigo viejo → false; con el bueno, página y luego token final
do $$
declare
  v_candado uuid;
  v_ventana timestamptz := now() - interval '30 days';
begin
  select candado into v_candado from public.gcal_sync_estado where clinica_id = '00000000-0000-4000-8000-00000000c1c1';
  if public.gcal_sync_avanzar('00000000-0000-4000-8000-00000000c1c1', gen_random_uuid(), 'p2', null, v_ventana, 60) then
    raise exception 'C1 caso 6: avanzar prendió con un testigo ajeno';
  end if;
  -- Exactamente uno de los dos.
  begin
    perform public.gcal_sync_avanzar('00000000-0000-4000-8000-00000000c1c1', v_candado, 'p2', 'tok', v_ventana, 60);
    raise exception 'C1 caso 6: avanzar aceptó página y token a la vez';
  exception when invalid_parameter_value then null;
  end;
  if not public.gcal_sync_avanzar('00000000-0000-4000-8000-00000000c1c1', v_candado, 'p2', null, v_ventana, 60) then
    raise exception 'C1 caso 6: avanzar con el testigo bueno no prendió';
  end if;
  -- La ventana se conserva aunque la segunda página mande otra.
  if not public.gcal_sync_avanzar('00000000-0000-4000-8000-00000000c1c1', v_candado, null, 'tok-1', now(), 60) then
    raise exception 'C1 caso 6: avanzar al token final no prendió';
  end if;
  if (select (fase, sync_token, page_token, candado, ventana_desde, errores_seguidos)
            is distinct from ('incremental'::text, 'tok-1'::text, null::text, null::uuid, v_ventana, 0)
        from public.gcal_sync_estado where clinica_id = '00000000-0000-4000-8000-00000000c1c1') then
    raise exception 'C1 caso 6: el estado final no es incremental con tok-1, sin página ni candado y con la ventana primera';
  end if;
  -- Tras soltar, avanzar con el testigo viejo ya no prende.
  if public.gcal_sync_avanzar('00000000-0000-4000-8000-00000000c1c1', v_candado, 'p9', null, null, 60) then
    raise exception 'C1 caso 6: un testigo ya soltado sigue valiendo';
  end if;
end $$;

-- Caso 7: el intervalo mínimo se respeta; con 0 se vuelve a tomar
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c1c1',
    '00000000-0000-4000-8000-00000000c1e1', 'cal-c1@group.calendar.google.com', 60, 60);
  if v_n <> 0 then raise exception 'C1 caso 7: tomó dentro del intervalo mínimo'; end if;
  select count(*) into v_n from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c1c1',
    '00000000-0000-4000-8000-00000000c1e1', 'cal-c1@group.calendar.google.com', 60, 0);
  if v_n <> 1 then raise exception 'C1 caso 7: con intervalo 0 no tomó'; end if;
end $$;

-- Caso 8: reiniciar (410) vuelve a completa sin soltar; soltar con error cuenta y espera
do $$
declare
  v_candado uuid;
  v_n integer;
begin
  select candado into v_candado from public.gcal_sync_estado where clinica_id = '00000000-0000-4000-8000-00000000c1c1';
  if not public.gcal_sync_reiniciar('00000000-0000-4000-8000-00000000c1c1', v_candado) then
    raise exception 'C1 caso 8: reiniciar no prendió';
  end if;
  if (select (fase, sync_token, ventana_desde, completas, candado)
            is distinct from ('completa'::text, null::text, null::timestamptz, 1, v_candado)
        from public.gcal_sync_estado where clinica_id = '00000000-0000-4000-8000-00000000c1c1') then
    raise exception 'C1 caso 8: reiniciar no dejó completa, sin token, con el candado';
  end if;
  if not public.gcal_sync_soltar('00000000-0000-4000-8000-00000000c1c1', v_candado, 'google_5xx') then
    raise exception 'C1 caso 8: soltar no prendió';
  end if;
  -- En espera por error (30 s): no se toma aunque el intervalo sea 0.
  select count(*) into v_n from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c1c1',
    '00000000-0000-4000-8000-00000000c1e1', 'cal-c1@group.calendar.google.com', 60, 0);
  if v_n <> 0 then raise exception 'C1 caso 8: se tomó durante la espera por errores'; end if;
  if (select (errores_seguidos, ultimo_error) is distinct from (1, 'google_5xx'::text)
        from public.gcal_sync_estado where clinica_id = '00000000-0000-4000-8000-00000000c1c1') then
    raise exception 'C1 caso 8: soltar con error no contó';
  end if;
end $$;

-- Caso 9: un candado caducado se vuelve a tomar; cambiar de calendario reinicia el token
reset role;
update public.gcal_sync_estado
   set errores_seguidos = 0, ultimo_error = null, ultima_ok = null, fase = 'incremental', sync_token = 'tok-viejo',
       candado = gen_random_uuid(), candado_hasta = now() - interval '1 second'
 where clinica_id = '00000000-0000-4000-8000-00000000c1c1';
update public.clinica_conexiones_google set calendar_id = 'cal-c1-nuevo@group.calendar.google.com'
 where id = '00000000-0000-4000-8000-00000000c1e1';
set local role service_role;
do $$
declare v_n integer;
begin
  -- Con el calendario viejo ya no: no es el de la conexión activa.
  select count(*) into v_n from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c1c1',
    '00000000-0000-4000-8000-00000000c1e1', 'cal-c1@group.calendar.google.com', 60, 0);
  if v_n <> 0 then raise exception 'C1 caso 9: tomó con un calendario que ya no es el de la conexión'; end if;
  select count(*) into v_n from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c1c1',
    '00000000-0000-4000-8000-00000000c1e1', 'cal-c1-nuevo@group.calendar.google.com', 60, 0);
  if v_n <> 1 then raise exception 'C1 caso 9: no retomó un candado caducado'; end if;
  if (select (fase, sync_token, calendar_id) is distinct from ('completa'::text, null::text, 'cal-c1-nuevo@group.calendar.google.com'::text)
        from public.gcal_sync_estado where clinica_id = '00000000-0000-4000-8000-00000000c1c1') then
    raise exception 'C1 caso 9: cambiar de calendario no reinició el token';
  end if;
end $$;

-- Caso 10: interruptor apagado o conexión de otra clínica → 0 filas; el listado sólo trae las encendidas
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c1c6',
    '00000000-0000-4000-8000-00000000c1e6', 'cal-c6@group.calendar.google.com', 60, 0);
  if v_n <> 0 then raise exception 'C1 caso 10: tomó con el interruptor apagado'; end if;
  -- La conexión de c6 con el id de clínica de c1 (encendida): no es de c1.
  select count(*) into v_n from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c1c1',
    '00000000-0000-4000-8000-00000000c1e6', 'cal-c6@group.calendar.google.com', 60, 0);
  if v_n <> 0 then raise exception 'C1 caso 10: tomó con la conexión de otra clínica'; end if;
  if exists (select 1 from public.gcal_sync_estado where clinica_id = '00000000-0000-4000-8000-00000000c1c6') then
    raise exception 'C1 caso 10: se creó estado para una clínica apagada';
  end if;
  if exists (select 1 from public.gcal_sync_clinicas_pendientes(100) where r_clinica_id = '00000000-0000-4000-8000-00000000c1c6') then
    raise exception 'C1 caso 10: el listado trae una clínica apagada';
  end if;
  -- c1 tiene el candado vivo (caso 9): no se lista.
  if exists (select 1 from public.gcal_sync_clinicas_pendientes(100) where r_clinica_id = '00000000-0000-4000-8000-00000000c1c1') then
    raise exception 'C1 caso 10: el listado trae una clínica con candado vivo';
  end if;
end $$;

-- Caso 11: argumentos inválidos → 22023
do $$
begin
  begin
    perform public.gcal_sync_tomar(null, gen_random_uuid(), 'x', 60, 0);
    raise exception 'C1 caso 11: tomar aceptó clínica NULL';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gcal_sync_tomar(gen_random_uuid(), gen_random_uuid(), 'x', 5, 0);
    raise exception 'C1 caso 11: tomar aceptó un lease de 5 s';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gcal_sync_clinica_habilitada(null);
    raise exception 'C1 caso 11: la puerta aceptó NULL';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gcal_sync_avanzar(gen_random_uuid(), null, 'p', null, null, 60);
    raise exception 'C1 caso 11: avanzar aceptó candado NULL';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gcal_sync_reiniciar(null, gen_random_uuid());
    raise exception 'C1 caso 11: reiniciar aceptó clínica NULL';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gcal_sync_soltar(gen_random_uuid(), null, 'x');
    raise exception 'C1 caso 11: soltar aceptó candado NULL';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- Caso 11-bis: la espera por errores tiene tope de 1 h (con 8 errores seguidos, 30·2^7 = 3840 s → 3600 s)
reset role;
update public.gcal_sync_estado
   set candado = null, candado_hasta = null, errores_seguidos = 8, ultima_ok = null, page_token = null,
       ultimo_intento = now() - interval '3601 seconds'
 where clinica_id = '00000000-0000-4000-8000-00000000c1c1';
set local role service_role;
do $$
declare v_n integer;
begin
  select count(*) into v_n from public.gcal_sync_tomar('00000000-0000-4000-8000-00000000c1c1',
    '00000000-0000-4000-8000-00000000c1e1', 'cal-c1-nuevo@group.calendar.google.com', 60, 0);
  if v_n <> 1 then raise exception 'C1 caso 11-bis: la espera pasó de 1 h'; end if;
end $$;

-- Caso 12 (S3): la regla vive en un solo sitio. Se muta la ORIGINAL dentro de
-- un savepoint (se deshace aquí mismo y, además, todo el archivo termina en
-- rollback): (a) con otra lógica y la misma forma, la nueva SIGUE la lógica
-- nueva — no hay copia de RN-1 —; (b) con una forma que no sabe sustituir,
-- lanza P0001 en vez de adivinar.
reset role;
savepoint antes_de_mutar;
create or replace function public.clinica_tiene_acceso() returns boolean
  language sql stable security definer set search_path to 'public', 'pg_temp' as $q$
    SELECT EXISTS (SELECT 1 FROM public.clinicas c WHERE c.id = public.get_clinica_id() AND c.nombre = 'C1 free degradada');
  $q$;
do $$
begin
  if pg_temp.nueva('00000000-0000-4000-8000-00000000c1c4') is not true
     or pg_temp.nueva('00000000-0000-4000-8000-00000000c1c1') is not false then
    raise exception 'C1 caso 12a: la nueva no siguió la lógica nueva de la original';
  end if;
  if pg_temp.nueva('00000000-0000-4000-8000-00000000c1c4')
     is distinct from pg_temp.solo_acceso('00000000-0000-4000-8000-00000000c1a4') then
    raise exception 'C1 caso 12a: con la lógica nueva, la nueva difiere de la original';
  end if;
end $$;
create or replace function public.clinica_tiene_acceso() returns boolean
  language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $q$
  begin
    return true;
  end $q$;
do $$
declare v_ok boolean := false;
begin
  begin
    perform pg_temp.nueva('00000000-0000-4000-8000-00000000c1c1');
  exception when sqlstate 'P0001' then
    v_ok := true;
  end;
  reset role;
  if not v_ok then raise exception 'C1 caso 12b: una forma desconocida no lanzó P0001'; end if;
end $$;
rollback to savepoint antes_de_mutar;
do $$
begin
  if (select prolang from pg_proc where oid = 'public.clinica_tiene_acceso()'::regprocedure)
     <> (select oid from pg_language where lanname = 'sql') then
    raise exception 'C1 caso 12: la original no volvió a su forma tras el savepoint';
  end if;
end $$;

reset role;
rollback;
