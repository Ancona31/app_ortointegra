-- Agenda · BASE-2 · B3 (20261208140000) — hallazgos bajos de MA y de R1.
--   1 · avisos_transaccion_mas_antigua(): DEFINER, search_path vacío, tira la foto de estadísticas antes
--       de leer; NINGÚN rol de la app la ejecuta.
--   2 · aviso_visto_hasta_sellar(): DEFINER, search_path vacío, con el MISMO cuerpo de MA; sigue siendo
--       el disparador de avisos_vistos_hasta.
--   3 · «Marcar todos» sigue funcionando con la sesión (que ya no puede llamar a la función): pone la
--       marca, nunca en el futuro. Lo demás de la marca lo prueba av5_avisos_cierre_auditoria.sql.
--   4 · con una foto de estadísticas ya tomada, sigue contestando. Que la segunda lectura de una
--       transacción vea lo que se abrió después exige DOS sesiones: scripts/avisos-carrera.sh, paso 4.
--   5 · los comentarios de cita_correo_tomar y cita_recordatorios_pendientes llevan el convenio.
-- Se corre con scripts/pruebas-sql.sh. Crea sus propios datos y termina en rollback.
begin;

do $$
declare v_f regprocedure := to_regprocedure('public.avisos_transaccion_mas_antigua()'); v_rol text;
begin
  if v_f is null or not (select p.prosecdef and p.proconfig = array['search_path=""'] and position('pg_stat_clear_snapshot' in p.prosrc) > 0
                           from pg_proc p where p.oid = v_f) then
    raise exception 'B3 caso 1: avisos_transaccion_mas_antigua() no es la de B3 (falta 20261208140000 o se deshizo)';
  end if;
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if has_function_privilege(v_rol, v_f, 'EXECUTE') then raise exception 'B3 caso 1: % puede ejecutar la función', v_rol; end if;
  end loop;
  if exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = v_f and a.grantee = 0) then
    raise exception 'B3 caso 1: PUBLIC puede ejecutar la función';
  end if;
  if not (select p.prosecdef and p.proconfig = array['search_path=""'] and md5(replace(p.prosrc, E'\r\n', E'\n')) = '36e828415cdf9e7e5a7f93da8b014712'
            from pg_proc p where p.oid = 'public.aviso_visto_hasta_sellar()'::regprocedure) then
    raise exception 'B3 caso 2: aviso_visto_hasta_sellar() no es DEFINER con search_path vacío y el cuerpo de MA';
  end if;
  if not exists (select 1 from pg_trigger t where t.tgrelid = 'public.avisos_vistos_hasta'::regclass and t.tgenabled = 'O'
                    and t.tgfoid = 'public.aviso_visto_hasta_sellar()'::regprocedure) then
    raise exception 'B3 caso 2: el disparador de la marca no está o está apagado';
  end if;
  if (select count(*) from pg_proc p
       where p.oid in ('public.cita_correo_tomar(uuid, uuid, text, uuid)'::regprocedure, 'public.cita_recordatorios_pendientes(integer)'::regprocedure)
         and position('VAN JUNTAS' in obj_description(p.oid, 'pg_proc')) > 0
         and position('coalesce(enviado_en, tomado_en) >= inicio' in obj_description(p.oid, 'pg_proc')) > 0) <> 2 then
    raise exception 'B3 caso 5: algún comentario de correos no lleva el convenio «van juntas» con la condición de R1';
  end if;
end $$;

-- ── Caso 3: «Marcar todos» con la sesión ──
insert into public.clinicas (id, nombre, es_vip_grant, suscripcion_estado) values ('00000000-0000-4000-8000-0000000b30c1', 'B3 uno', true, 'free');
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000b30b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b3-b1@prueba.local', now(), now());
update public.profiles set clinica_id = '00000000-0000-4000-8000-0000000b30c1', role = 'secretaria', es_admin_de_clinica = false
 where id = '00000000-0000-4000-8000-0000000b30b1';
insert into public.agenda_ajustes (clinica_id, agenda_v2_encendida) values ('00000000-0000-4000-8000-0000000b30c1', true)
  on conflict (clinica_id) do update set agenda_v2_encendida = true;

do $$
declare v_hasta timestamptz; v_ok boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000b30b1', 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.avisos_transaccion_mas_antigua();
    raise exception 'B3 caso 3: la sesión llamó a la función a mano';
  exception when insufficient_privilege then null;
  end;
  v_ok := public.avisos_revisar_todos(clock_timestamp() + interval '1 hour');
  reset role;
  select hasta into v_hasta from public.avisos_vistos_hasta where usuario_id = '00000000-0000-4000-8000-0000000b30b1';
  if v_ok is not true or v_hasta is null or v_hasta > clock_timestamp() then
    raise exception 'B3 caso 3: «Marcar todos» con la sesión no dejó la marca como debe (%, %)', v_ok, v_hasta;
  end if;
end $$;

-- ── Caso 4: con una foto de estadísticas ya tomada en la transacción, la función sigue contestando ──
-- (que la SEGUNDA lectura vea una transacción abierta DESPUÉS sólo se puede probar con dos sesiones:
--  scripts/avisos-carrera.sh, paso 4.)
do $$
begin
  perform 1 from pg_catalog.pg_stat_activity limit 1;
  if public.avisos_transaccion_mas_antigua() > clock_timestamp() or public.avisos_transaccion_mas_antigua() > clock_timestamp() then
    raise exception 'B3 caso 4: devolvió un instante futuro';
  end if;
end $$;

rollback;
