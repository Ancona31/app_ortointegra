-- supabase/produccion/plan/catalogo-despues.sql
-- Comprobación posterior, §5 (COMPROBACION-POSTERIOR.md): lo que el catálogo de
-- producción tiene que enseñar tras aplicar las 9. SÓLO LECTURA (BEGIN READ ONLY
-- y ROLLBACK). Devuelve recuentos, booleanos y dos md5; ningún dato de personas.
-- Se corre como postgres por el pooler. Valores del ensayo sobre el clon de la
-- foto: COMPROBACION-POSTERIOR.md, §5.
BEGIN TRANSACTION READ ONLY;
SELECT 'versiones en el historial' AS que,
       (SELECT count(*) FROM supabase_migrations.schema_migrations)::text AS valor
UNION ALL SELECT 'las 9 registradas',
       (SELECT count(*) FROM supabase_migrations.schema_migrations
         WHERE version IN ('20261125170000','20261126120000','20261201120000','20261201130000','20261201140000',
                           '20261201150000','20261201160000','20261201170000','20261201180000'))::text
UNION ALL SELECT 'tablas nuevas de la agenda en public (de 15)',
       (SELECT count(*) FROM unnest(ARRAY['agenda_ajustes','tipos_cita','agenda_bloqueos','reserva_avisos','reserva_enlaces',
          'reserva_verificaciones','reserva_incidencias','reserva_contactos','gcal_sync_estado','reserva_empalmes_google',
          'gcal_movimientos_rechazados','cita_confirmaciones','cita_reagendos','cita_correos','avisos_clinica']) t
         WHERE to_regclass('public.' || t) IS NOT NULL)::text
UNION ALL SELECT 'respaldo de F1 existe', (to_regclass('respaldos.consultorios_horario_20261119') IS NOT NULL)::text
UNION ALL SELECT 'tablas de public sin RLS (de las 15 nuevas)',
       (SELECT count(*) FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND NOT c.relrowsecurity
          AND c.relname = ANY (ARRAY['agenda_ajustes','tipos_cita','agenda_bloqueos','reserva_avisos','reserva_enlaces',
          'reserva_verificaciones','reserva_incidencias','reserva_contactos','gcal_sync_estado','reserva_empalmes_google',
          'gcal_movimientos_rechazados','cita_confirmaciones','cita_reagendos','cita_correos','avisos_clinica']))::text
UNION ALL SELECT 'tablas de public y respaldos con TRUNCATE para anon/authenticated/service_role',
       (SELECT count(DISTINCT c.oid) FROM pg_class c CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(rol)
         WHERE c.relnamespace IN ('public'::regnamespace, 'respaldos'::regnamespace) AND c.relkind IN ('r','p','f')
           AND has_table_privilege(r.rol, c.oid, 'TRUNCATE'))::text
UNION ALL SELECT 'disparadores BEFORE TRUNCATE con prohibir_truncate() (11 + 11)',
       (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgfoid = 'public.prohibir_truncate()'::regprocedure AND tgenabled = 'O')::text
UNION ALL SELECT 'prevent_audit_truncate en audit_log', (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.audit_log'::regclass AND tgname = 'prevent_audit_truncate')::text
UNION ALL SELECT 'disparadores de appointments (no internos), habilitados / total',
       (SELECT count(*) FILTER (WHERE tgenabled = 'O') || ' / ' || count(*) FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass AND NOT tgisinternal)
UNION ALL SELECT 'columnas de appointments', (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND attnum > 0 AND NOT attisdropped)::text
UNION ALL SELECT 'índices de appointments inválidos', (SELECT count(*) FROM pg_index WHERE indrelid = 'public.appointments'::regclass AND NOT (indisvalid AND indisready))::text
UNION ALL SELECT 'funciones de public (sin las de extensiones)',
       (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'))::text
UNION ALL SELECT 'funciones de public ejecutables por PUBLIC creadas por el conjunto (debe ser 0)',
       (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
          AND (p.proname LIKE 'agenda\_%' OR p.proname LIKE 'reserva%' OR p.proname LIKE 'gcal\_%' OR p.proname LIKE 'cita\_%'
               OR p.proname LIKE 'aviso\_clinica%' OR p.proname IN ('prohibir_truncate','log_cita_change','rate_limit_espera','reagendar_por_enlace'))
          AND has_function_privilege('public', p.oid, 'EXECUTE'))::text
UNION ALL SELECT 'funciones de public (sin las de extensiones) con dueño distinto de postgres',
       (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proowner <> 'postgres'::regrole
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'))::text
UNION ALL SELECT 'relaciones de public con dueño distinto de postgres', (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relowner <> 'postgres'::regrole)::text
UNION ALL SELECT 'agenda_ajustes: filas / con la v2 encendida', (SELECT count(*) || ' / ' || count(*) FILTER (WHERE agenda_v2_encendida) FROM public.agenda_ajustes)
UNION ALL SELECT 'consultorios con horario_propio = false (debe ser 0)', (SELECT count(*) FROM public.consultorios WHERE NOT horario_propio)::text
UNION ALL SELECT 'consultorios / filas del respaldo', (SELECT count(*) FROM public.consultorios) || ' / ' || (SELECT count(*) FROM respaldos.consultorios_horario_20261119)
UNION ALL SELECT 'privilegios por omisión de postgres en public con TRUNCATE para los tres roles',
       (SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
         WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace AND d.defaclobjtype = 'r'
           AND a.privilege_type = 'TRUNCATE' AND a.grantee IN ('anon'::regrole,'authenticated'::regrole,'service_role'::regrole))::text
UNION ALL SELECT 'md5 normalizado de clinica_no_suspendida / clinica_tiene_acceso (no cambian)',
       (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = 'public.clinica_no_suspendida()'::regprocedure) || ' / ' ||
       (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = 'public.clinica_tiene_acceso()'::regprocedure);
ROLLBACK;
