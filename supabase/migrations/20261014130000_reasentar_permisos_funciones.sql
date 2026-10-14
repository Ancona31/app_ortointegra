-- ═══════════════════════════════════════════════════════════════════════
-- Fase 3 · P1b — permisos de funciones iguales a producción y candado de sa_*
-- Rama: feature/limites-ajustables · Escrita: 2026-10-14
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: PENDIENTE DE APLICAR.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR.
--
-- 1 · Siete funciones que producción tiene cerradas y la base reconstruida
--     abre. El volcado 20260912190416_remote_schema.sql:3371-3475 hace
--     REVOKE ALL FROM PUBLIC + GRANT a postgres/service_role, pero al
--     replayarlo los privilegios por omisión de public (postgres, public, f)
--     ya concedieron EXECUTE a anon y authenticated, y revocar de PUBLIC no
--     quita un grant directo. Mismo defecto que cerró
--     20260919230000_auth_02_reasentar_grants_rate_limit.sql. Aquí se
--     reasienta cada una a lo que dice el volcado; ninguna migración
--     posterior les cambia permisos. En producción es un no-op.
--     Las siete son SECURITY DEFINER. Todo llamador de src/ usa
--     createAdminClient() (service_role); dentro de la base, generar_folio y
--     sync_antropometria_paciente se llaman desde SECURITY DEFINER de
--     postgres, y las dos de disparador no necesitan EXECUTE para dispararse.
--
-- 2 · Las cuatro sa_* comprueban `auth.role() <> 'service_role' AND …`.
--     Con auth.role() NULL (sin claims) la condición da NULL y el IF no
--     lanza: el candado se abre. Se cambia SOLO esa comparación por
--     `is distinct from`. create or replace conserva dueño, permisos y
--     comentario; sus permisos no cambian aquí.
-- ═══════════════════════════════════════════════════════════════════════

-- [1/18] Antes de tocar nada: las 11 funciones existen, son de postgres, y cada sa_* tiene
--        exactamente el cuerpo del volcado (o ya el de esta migración); si no, abortar
do $$
declare
  v_faltan text;
  v_cuerpos text;
begin
  select string_agg(s.firma, ', ') into v_faltan
  from unnest(array[
    'public.alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint)',
    'public.enforce_limite_documentos_paciente()',
    'public.generar_folio(text)',
    'public.guardar_secretos_conexion(uuid,uuid,text,text,bigint)',
    'public.leer_conexion_google_con_secretos(uuid,uuid)',
    'public.sync_antropometria_paciente(uuid)',
    'public.trg_mediciones_antropometria()',
    'public.sa_heatmap_horarios(integer)',
    'public.sa_ranking_funciones(integer)',
    'public.sa_top_medicos(integer,integer)',
    'public.sa_uso_ia(integer)'
  ]) as s(firma)
  left join pg_proc p on p.oid = to_regprocedure(s.firma)
  where p.oid is null or p.proowner <> 'postgres'::regrole;
  if v_faltan is not null then
    raise exception 'P1b: no existen o no son de postgres: %', v_faltan;
  end if;

  select string_agg(e.funcion, ', ') into v_cuerpos
  from (values
    ('public.sa_heatmap_horarios(integer)',    '2c80c0512cdfa6225f3acac09b065920', 'fae569adb02e718ea57cf81023f931e6'),
    ('public.sa_ranking_funciones(integer)',   '650ac29c6c0ace03c517fcf3d114f242', '935c8af8b3ee00a403616562146114f9'),
    ('public.sa_top_medicos(integer,integer)', '820a1fd7de068d51f047b3d36e2d27ce', '1009a426f921454107fb4896adfcfc87'),
    ('public.sa_uso_ia(integer)',              '7e67b0754d2482e96ea83022d560bb3d', '4207889b2673b56c2ee98473d694a9c3')
  ) as e(funcion, md5_volcado, md5_p1b)
  join pg_proc p on p.oid = to_regprocedure(e.funcion)
  where md5(p.prosrc) not in (e.md5_volcado, e.md5_p1b);
  if v_cuerpos is not null then
    raise exception 'P1b: el cuerpo de estas funciones no es el del volcado (¿se cambiaron a mano?): %', v_cuerpos;
  end if;
end
$$;

-- [2/18] alta_conexion_google: en producción solo postgres y service_role (remote_schema.sql:3371-3373)
revoke execute on function public.alta_conexion_google(uuid, uuid, text, text, text, text, text, bigint) from public, anon, authenticated;

-- [3/18]
grant execute on function public.alta_conexion_google(uuid, uuid, text, text, text, text, text, bigint) to service_role;

-- [4/18] enforce_limite_documentos_paciente: solo postgres y service_role (remote_schema.sql:3401-3403)
revoke execute on function public.enforce_limite_documentos_paciente() from public, anon, authenticated;

-- [5/18]
grant execute on function public.enforce_limite_documentos_paciente() to service_role;

-- [6/18] generar_folio: solo postgres, su dueño (remote_schema.sql:3409-3411); tampoco service_role
revoke execute on function public.generar_folio(text) from public, anon, authenticated, service_role;

-- [7/18] guardar_secretos_conexion: solo postgres y service_role (remote_schema.sql:3419-3421)
revoke execute on function public.guardar_secretos_conexion(uuid, uuid, text, text, bigint) from public, anon, authenticated;

-- [8/18]
grant execute on function public.guardar_secretos_conexion(uuid, uuid, text, text, bigint) to service_role;

-- [9/18] leer_conexion_google_con_secretos: solo postgres y service_role (remote_schema.sql:3423-3425)
revoke execute on function public.leer_conexion_google_con_secretos(uuid, uuid) from public, anon, authenticated;

-- [10/18]
grant execute on function public.leer_conexion_google_con_secretos(uuid, uuid) to service_role;

-- [11/18] sync_antropometria_paciente: solo postgres y service_role (remote_schema.sql:3469-3471)
revoke execute on function public.sync_antropometria_paciente(uuid) from public, anon, authenticated;

-- [12/18]
grant execute on function public.sync_antropometria_paciente(uuid) to service_role;

-- [13/18] trg_mediciones_antropometria: solo postgres y service_role (remote_schema.sql:3473-3475)
revoke execute on function public.trg_mediciones_antropometria() from public, anon, authenticated;

-- [14/18]
grant execute on function public.trg_mediciones_antropometria() to service_role;

-- [15/18] sa_heatmap_horarios: candado con is distinct from (definición de pg_get_functiondef; solo cambia la condición)
CREATE OR REPLACE FUNCTION public.sa_heatmap_horarios(dias_atras integer DEFAULT 90)
 RETURNS TABLE(hora integer, dia_semana integer, total bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() is distinct from 'service_role'
     AND coalesce(public.get_my_role(), '') <> 'super_admin' THEN
    RAISE EXCEPTION 'unauthorized: super_admin required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    EXTRACT(hour FROM al.created_at AT TIME ZONE 'America/Mexico_City')::int,
    EXTRACT(dow  FROM al.created_at AT TIME ZONE 'America/Mexico_City')::int,
    count(*)::bigint
  FROM public.audit_log al
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
  GROUP BY 1, 2
  ORDER BY 1, 2;
END;
$function$;

-- [16/18] sa_ranking_funciones: candado con is distinct from (definición de pg_get_functiondef; solo cambia la condición)
CREATE OR REPLACE FUNCTION public.sa_ranking_funciones(limite integer DEFAULT 20)
 RETURNS TABLE(accion text, total bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() is distinct from 'service_role'
     AND coalesce(public.get_my_role(), '') <> 'super_admin' THEN
    RAISE EXCEPTION 'unauthorized: super_admin required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    al.accion::text,
    count(*)::bigint
  FROM public.audit_log al
  GROUP BY al.accion
  ORDER BY 2 DESC
  LIMIT limite;
END;
$function$;

-- [17/18] sa_top_medicos: candado con is distinct from (definición de pg_get_functiondef; solo cambia la condición)
CREATE OR REPLACE FUNCTION public.sa_top_medicos(dias_atras integer DEFAULT 30, limite integer DEFAULT 10)
 RETURNS TABLE(user_id text, nombre text, clinica_nombre text, total bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() is distinct from 'service_role'
     AND coalesce(public.get_my_role(), '') <> 'super_admin' THEN
    RAISE EXCEPTION 'unauthorized: super_admin required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    al.user_id::text,
    COALESCE(
      NULLIF(TRIM(CONCAT_WS(' ',
        NULLIF(p.titulo, ''),
        NULLIF(p.nombres, ''),
        NULLIF(p.apellido_paterno, ''),
        NULLIF(p.apellido_materno, '')
      )), ''),
      '(sin perfil)'
    )::text,
    c.nombre::text,
    count(*)::bigint
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON p.id::text = al.user_id
  LEFT JOIN public.clinicas c ON c.id = p.clinica_id
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
    AND al.user_id IS NOT NULL
    AND al.user_id <> 'anonymous'
  GROUP BY al.user_id, p.titulo, p.nombres, p.apellido_paterno, p.apellido_materno, c.nombre
  ORDER BY 4 DESC
  LIMIT limite;
END;
$function$;

-- [18/18] sa_uso_ia: candado con is distinct from (definición de pg_get_functiondef; solo cambia la condición)
CREATE OR REPLACE FUNCTION public.sa_uso_ia(dias_atras integer DEFAULT 30)
 RETURNS TABLE(accion text, total bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() is distinct from 'service_role'
     AND coalesce(public.get_my_role(), '') <> 'super_admin' THEN
    RAISE EXCEPTION 'unauthorized: super_admin required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    al.accion::text,
    count(*)::bigint
  FROM public.audit_log al
  WHERE al.created_at >= now() - make_interval(days => dias_atras)
    AND (al.accion LIKE 'ia_%'
         OR al.accion IN ('generar_pdf', 'nota_generada', 'receta_generada', 'enviar_documento'))
  GROUP BY al.accion
  ORDER BY 2 DESC;
END;
$function$;
