-- ═══════════════════════════════════════════════════════════════════════
-- public sin TRUNCATE para anon, authenticated y service_role
-- NO es de la agenda v2: va sola, antes o después de cualquier otra.
-- Rama: feature/agenda-v2-produccion-p (bloque 3) · Escrita: 2026-11-22
-- Riesgo estimado: BAJO (sólo quita un privilegio que ningún código usa, deja
-- a las tablas futuras de postgres nacer sin él y añade disparadores de
-- sentencia que sólo lanzan una excepción. Ninguna fila, columna, policy ni
-- disparador existente cambia; nada se concede salvo el EXECUTE de la función
-- de disparador nueva, como pide la regla del proyecto).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de esta cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DE AUDITORÍA
--   INDEPENDIENTE (supabase/AUDITORIA-MIGRACIONES.md): no se ha auditado.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- 20261125170000_audit_log_sin_truncate cerró el TRUNCATE de audit_log y dejó
-- anotado (DEUDA_TECNICA.md, AG-DT-253) que otras 30 tablas de public siguen
-- concediendo TRUNCATE a anon, authenticated o service_role, 12 de ellas con
-- datos de pacientes. TRUNCATE no pasa por la RLS ni dispara los disparadores
-- de fila (ni la auditoría de log_tabla_change / log_cita_change): con ese
-- privilegio, service_role —o cualquier SQL con esos roles— vacía un
-- expediente entero sin dejar rastro. PostgREST no expone TRUNCATE; el
-- privilegio no lo usa nadie (ver «ANTES DE APLICAR»).
--
-- ═══ INVENTARIO (base local, 2026-11-22, aclexplode(relacl)) ═══════════
-- 30 tablas de public conceden TRUNCATE a alguno de los tres roles; TODAS con
-- otorgante postgres, que es también su dueño. Coincide exactamente con la
-- lista de AUDITORIA-CONJUNTO-AGENDA-V2.md §15.6 (AG-DT-253): sin diferencias.
-- Con datos de pacientes (*): addendums*, appointments*,
-- calculadora_resultados*, casos_clinicos*, casos_clinicos_recursos*,
-- consultas*, documentos*, firmas_documento*, mediciones_analitos*,
-- paciente_medico*, pacientes*, solicitudes_arco*. Las demás:
-- agenda_ajustes (sólo service_role), analitos_catalogo, cat_cie10,
-- clinica_conexiones_google (anon, service_role), clinicas, consultorios,
-- folios_contador, google_tokens, invitaciones, ip_rate_limits, medicamentos,
-- pdf_jobs, plantillas_documento, plantillas_honorarios, profiles,
-- rate_limits, stripe_webhook_events, tipos_cita (sólo service_role).
-- Las 14 restantes de public (audit_log y las de la agenda: avisos_clinica,
-- agenda_bloqueos, cita_*, gcal_*, reserva_*) ya no lo conceden.
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- 1. REVOKE TRUNCATE ... FROM anon, authenticated, service_role en TODA tabla
--    de public (relkind r, p, f) en la que alguno de los tres lo tenga
--    concedido, recorrida sobre el catálogo en el momento de aplicar.
--    DINÁMICA, NO LISTA FIJA, a propósito: en producción el conjunto difiere
--    del local (allí aún no existen las tablas de la agenda v2, y puede haber
--    otras). Una lista fija dejaría fuera lo que no previó; la dinámica, con
--    el post-vuelo que exige CERO en todo public, garantiza el invariante sea
--    cual sea la base. Las tablas que falten no importan; las que sobren
--    entran. El resto de privilegios (SELECT, INSERT, UPDATE, DELETE,
--    REFERENCES, TRIGGER, MAINTAIN) NO se toca.
-- 2. ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE
--    TRUNCATE ON TABLES FROM anon, authenticated, service_role: las tablas
--    que postgres cree DESPUÉS (todas las migraciones del proyecto, y las de la
--    agenda si van después de ésta) nacen sin TRUNCATE para esos roles. Sin
--    esto el invariante se rompería con la primera tabla nueva: los privilegios
--    por omisión de Supabase son arwdDxtm (todo, TRUNCATE incluido) para los
--    tres. Las migraciones de la agenda revocan TRUNCATE una a una; con esto
--    ese REVOKE pasa a ser un no-op, y sus rejillas no miran TRUNCATE (se
--    comprobó: ninguna pre/post-vuelo de la agenda lo exige).
--    LÍMITE: los privilegios por omisión de supabase_admin en public (también
--    arwdDxtm) NO se pueden cambiar desde postgres (ALTER DEFAULT PRIVILEGES
--    FOR ROLE exige ser miembro de ese rol, y en Supabase postgres no lo es).
--    Una tabla de public creada por supabase_admin (la plataforma, una
--    extensión) nacería con TRUNCATE; su dueño sería supabase_admin y esta
--    migración, al replay, abortaría en el pre-vuelo con su nombre en vez de
--    dejarla pasar. La rejilla lo muestra como INFO.
-- 3. Función nueva public.prohibir_truncate() (plpgsql, SECURITY INVOKER,
--    search_path = '', RETURNS trigger): sólo RAISE EXCEPTION con el nombre de
--    la tabla. INVOKER porque no lee nada: no necesita privilegios. EXECUTE:
--    REVOKE de PUBLIC y GRANT a anon, authenticated, service_role (la regla de
--    las funciones de disparador del proyecto, como cita_proteger_bloqueo();
--    no entra en la lista del caso 3 de p1). No se reutiliza
--    prevent_audit_modification() ni firmas_documento_inmutable(): sus
--    mensajes nombran el audit_log y las firmas, y aquí mentirían.
-- 4. Disparadores trg_<tabla>_sin_truncate, BEFORE TRUNCATE FOR EACH
--    STATEMENT, en las 11 tablas de datos clínicos que trae el baseline:
--    pacientes, consultas, documentos, addendums, mediciones_analitos,
--    appointments, calculadora_resultados, casos_clinicos,
--    casos_clinicos_recursos, paciente_medico y solicitudes_arco (ésta es el
--    registro legal de las solicitudes ARCO). firmas_documento NO lo lleva:
--    ya tiene trg_firmas_documento_no_truncate (baseline), y audit_log tiene
--    prevent_audit_truncate (20261125170000). Son para el dueño (postgres) y
--    supabase_admin, que conservan TRUNCATE, y para cualquier GRANT futuro.
--    Un TRUNCATE ... CASCADE de una tabla sin disparador (clinicas, profiles)
--    arrastra a estas, y sus disparadores BEFORE se disparan antes de vaciar
--    nada: también lo paran. Las tablas de la agenda con datos de pacientes
--    (cita_confirmaciones, cita_correos, cita_reagendos, reserva_*,
--    avisos_clinica, agenda_bloqueos) NO lo llevan aquí: en producción no
--    existen todavía, y ponerlo «si existen» haría que el resultado dependiera
--    del orden de aplicación. Queda propuesto (ver el reporte).
--    Como los de audit_log, son disparadores normales (tgenabled 'O'): con
--    session_replication_role = replica NO se disparan (AG-DT-252). No se
--    pasan a ENABLE ALWAYS: aplicar un TRUNCATE replicado (suscripción
--    lógica) o una restauración que corra en replica fallarían; queda para
--    Angel junto con AG-DT-252.
--
-- Lo que NO hace: no concede nada a ninguna tabla; no toca policies, RLS,
-- disparadores existentes, prevent_audit_modification(), firmas_documento_
-- inmutable(), los privilegios por omisión de funciones ni de secuencias, ni
-- nada fuera de public.
--
-- ═══ DEPENDENCIAS ══════════════════════════════════════════════════════
-- Sólo el baseline de producción (20260912190416_remote_schema): las 11
-- tablas del punto 4 (el pre-vuelo exige que existan y que quien aplica
-- actúe como su dueño). Ninguna migración de la agenda la necesita ni la
-- toca; tampoco 20261125170000 (audit_log ya no concede TRUNCATE y queda
-- fuera del bucle por sí sola). Compatible con feature/limites-ajustables
-- (20261014120000 revoca EXECUTE de PUBLIC en las funciones de public; ésta
-- nace ya sin él).
--
-- ═══ ANTES DE APLICAR: nada vacía estas tablas ═════════════════════════
-- 2026-11-22, grep de «truncate» (sin distinguir mayúsculas) en src, scripts,
-- e2e y supabase (migraciones, pruebas SQL, baseline, config; no hay
-- seed.sql ni snippets en el repo): ningún TRUNCATE ni .truncate( de
-- supabase-js. En src sólo la clase CSS «truncate» de Tailwind,
-- NOTAS_TRUNCATE y la guarda pruebasSinBorrarAuditoria.test.ts; en supabase,
-- REVOKE de TRUNCATE de la agenda, el disparador de firmas_documento, la
-- prueba de audit_log (que lo intenta para ver que falla) y comentarios. En la
-- base local, ninguna función de ningún esquema de usuario contiene TRUNCATE,
-- y no hay pg_cron. La semilla (scripts/agenda-semilla.ts) y las e2e limpian
-- con DELETE, nunca con TRUNCATE. supabase db reset recrea la base: no vacía
-- tablas.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO, como
-- postgres. PG ≥ 14 (CREATE OR REPLACE TRIGGER).
-- Bloqueos (lock_timeout 5 s): REVOKE y ALTER DEFAULT PRIVILEGES sólo
--   escriben catálogo; cada CREATE TRIGGER toma SHARE ROW EXCLUSIVE sobre su
--   tabla y lo retiene hasta el COMMIT: durante ese instante se frenan las
--   escrituras de las 11 tablas (no las lecturas). Si alguna está ocupada
--   más de 5 s, aborta entero sin cambiar nada; reintentar.
-- Orden respecto al código: cualquiera es seguro. Ningún código hace TRUNCATE.
-- Alcance de los roles:
--   gana — nadie gana nada (el EXECUTE de una función de disparador no sirve
--          para llamarla fuera de un disparador).
--   pierde — anon, authenticated y service_role pierden TRUNCATE en todo
--            public (nadie lo usaba). postgres y supabase_admin lo conservan;
--            en las 11 tablas clínicas el disparador se lo impide salvo en
--            replica.
-- Contrato con spinus-consola: no cambia ninguna columna, vista ni función
--   existente. Si la consola hiciera TRUNCATE con service_role (no debe),
--   ahora fallaría.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
-- supabase/reversas/20261126120000_public_sin_truncate_reversa.sql: devuelve
-- el TRUNCATE en las 28 tablas de SU inventario, el de la foto de producción
-- (a los roles que lo tenían allí; las que no existan se saltan), los
-- privilegios por omisión y quita los 11 disparadores y la
-- función. Reabre el hueco: sólo si Angel lo pide.
--
-- ═══ APLICACIÓN LOCAL ══════════════════════════════════════════════════
-- 2026-11-22, base local (supabase_db_app_ortointegra), sin db reset y sin
-- borrar nada: ensayo con ROLLBACK, aplicada con ON_ERROR_STOP y una segunda
-- pasada (idempotente). Prueba: supabase/pruebas-sql/p_public_sin_truncate.sql,
-- en rojo antes y con tres mutaciones, en verde después; scripts/pruebas-sql.sh,
-- 46/46. Registrada a mano en supabase_migrations.schema_migrations (version
-- 20261126120000, sin statements). Rejilla: filas 1, 3 y 4 OK; la 2 dio 30
-- tablas la primera pasada y 0 la segunda.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_tablas constant text[] := ARRAY['addendums', 'appointments', 'calculadora_resultados', 'casos_clinicos',
    'casos_clinicos_recursos', 'consultas', 'documentos', 'mediciones_analitos', 'paciente_medico',
    'pacientes', 'solicitudes_arco'];
  v_t text;
  v_rel regclass;
  v_def text;
  v_mal text;
BEGIN
  IF NOT pg_has_role(current_user, 'postgres', 'MEMBER') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es postgres (lo exige ALTER DEFAULT PRIVILEGES FOR ROLE postgres).', current_user;
  END IF;

  -- Las 11 tablas clínicas existen y quien aplica actúa como su dueño.
  FOREACH v_t IN ARRAY v_tablas LOOP
    v_rel := to_regclass('public.' || v_t);
    IF v_rel IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe public.%.', v_t;
    END IF;
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = v_rel), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de public.%.', current_user, v_t;
    END IF;
  END LOOP;

  -- Cada TRUNCATE concedido a los tres roles (o a PUBLIC) en public tiene que poder quitarlo quien aplica:
  -- tabla de un dueño del que es miembro y concedido por ese dueño. Un REVOKE no quita lo que concedió
  -- otro otorgante (pasaría sin efecto); PUBLIC no es del encargo. En esos casos se aborta con el nombre.
  SELECT string_agg(format('%s (a %s, por %s, dueño %s)', c.oid::regclass,
                           CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,
                           a.grantor::regrole, c.relowner::regrole), '; ' ORDER BY c.relname)
    INTO v_mal
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f')
     AND a.privilege_type = 'TRUNCATE'
     AND (a.grantee = 0 OR a.grantee IN ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole))
     AND (a.grantee = 0 OR a.grantor <> c.relowner OR NOT pg_has_role(current_user, c.relowner, 'USAGE'));
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: TRUNCATE que esta migración no puede quitar: %', v_mal;
  END IF;

  -- Replay: si la función ya existe, es exactamente la de esta migración (md5 de prosrc, INVOKER,
  -- search_path vacío, RETURNS trigger). Otra con el mismo nombre no se pisa.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'prohibir_truncate')
     AND NOT EXISTS (SELECT 1 FROM pg_proc p
                      WHERE p.oid = to_regprocedure('public.prohibir_truncate()')
                        AND md5(p.prosrc) = 'e1b07ec42accc1b181ac24b3a3d63400'
                        AND NOT p.prosecdef AND p.prorettype = 'pg_catalog.trigger'::regtype
                        AND p.proconfig = ARRAY['search_path=""']
                        AND (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'prohibir_truncate') = 1) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: ya existe public.prohibir_truncate con otra definición o con sobrecargas.';
  END IF;

  -- Replay: un disparador con el nombre de esta migración tiene que ser exactamente el suyo
  -- (tgtype 34 = BEFORE + TRUNCATE, de sentencia; la función nueva; sin argumentos, WHEN ni columnas).
  FOREACH v_t IN ARRAY v_tablas LOOP
    SELECT pg_get_triggerdef(t.oid) INTO v_def FROM pg_trigger t
     WHERE t.tgrelid = to_regclass('public.' || v_t) AND t.tgname = 'trg_' || v_t || '_sin_truncate' AND NOT t.tgisinternal
       AND NOT (t.tgtype = 34 AND t.tgfoid = coalesce(to_regprocedure('public.prohibir_truncate()'), 0)
                AND t.tgnargs = 0 AND t.tgqual IS NULL AND t.tgattr = ''::int2vector);
    IF FOUND THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: ya existe trg_%_sin_truncate con otra definición: %', v_t, v_def;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Quitar TRUNCATE a los tres roles en toda tabla de public que lo
--     conceda (sobre el catálogo de esta base). Se apuntan en una tabla
--     temporal sólo para la rejilla.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS pg_temp._public_sin_truncate;
CREATE TEMP TABLE _public_sin_truncate (tabla text PRIMARY KEY);

DO $$
DECLARE
  v_rel regclass;
BEGIN
  FOR v_rel IN
    SELECT DISTINCT c.oid::regclass FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
     WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f')
       AND a.privilege_type = 'TRUNCATE'
       AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
  LOOP
    EXECUTE format('REVOKE TRUNCATE ON TABLE %s FROM anon, authenticated, service_role', v_rel);
    INSERT INTO pg_temp._public_sin_truncate VALUES (v_rel::text);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3 · Las tablas futuras de postgres en public nacen sin TRUNCATE.
-- ---------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4 · La función común de los disparadores. Sólo lanza la excepción.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prohibir_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $f$
BEGIN
  RAISE EXCEPTION 'No se permite TRUNCATE sobre %.%: guarda datos clínicos o de auditoría.', TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING HINT = 'Un expediente no se vacía: se conserva (NOM-004) y se corrige con borrado lógico o addendum.';
  RETURN NULL;
END
$f$;

COMMENT ON FUNCTION public.prohibir_truncate() IS
  'Disparador BEFORE TRUNCATE FOR EACH STATEMENT de las tablas clínicas (20261126120000_public_sin_truncate): impide vaciarlas, también al dueño. Con session_replication_role = replica no se dispara.';

REVOKE EXECUTE ON FUNCTION public.prohibir_truncate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prohibir_truncate() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5 · Los 11 disparadores de sentencia.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_addendums_sin_truncate BEFORE TRUNCATE ON public.addendums
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_appointments_sin_truncate BEFORE TRUNCATE ON public.appointments
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_calculadora_resultados_sin_truncate BEFORE TRUNCATE ON public.calculadora_resultados
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_casos_clinicos_sin_truncate BEFORE TRUNCATE ON public.casos_clinicos
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_casos_clinicos_recursos_sin_truncate BEFORE TRUNCATE ON public.casos_clinicos_recursos
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_consultas_sin_truncate BEFORE TRUNCATE ON public.consultas
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_documentos_sin_truncate BEFORE TRUNCATE ON public.documentos
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_mediciones_analitos_sin_truncate BEFORE TRUNCATE ON public.mediciones_analitos
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_paciente_medico_sin_truncate BEFORE TRUNCATE ON public.paciente_medico
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_pacientes_sin_truncate BEFORE TRUNCATE ON public.pacientes
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_solicitudes_arco_sin_truncate BEFORE TRUNCATE ON public.solicitudes_arco
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();

-- ---------------------------------------------------------------------
-- 6 · Post-vuelo, ANTES del COMMIT. Si algo no quedó, aborta y no queda nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_mal text;
BEGIN
  -- Cero TRUNCATE efectivo (directo, por PUBLIC o por pertenencia) para los tres roles en todo public.
  SELECT string_agg(c.oid::regclass::text || ':' || r, ', ' ORDER BY c.relname, r) INTO v_mal
    FROM pg_class c CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) r
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f')
     AND has_table_privilege(r, c.oid, 'TRUNCATE');
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: conservan TRUNCATE: %', v_mal;
  END IF;

  -- Los privilegios por omisión de postgres en public ya no dan TRUNCATE a los tres roles.
  IF EXISTS (SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
              WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace
                AND d.defaclobjtype = 'r' AND a.privilege_type = 'TRUNCATE'
                AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: los privilegios por omisión de postgres en public siguen dando TRUNCATE.';
  END IF;

  -- Los 11 disparadores, exactamente como se crearon.
  SELECT string_agg(t, ', ') INTO v_mal
    FROM unnest(ARRAY['addendums', 'appointments', 'calculadora_resultados', 'casos_clinicos',
      'casos_clinicos_recursos', 'consultas', 'documentos', 'mediciones_analitos', 'paciente_medico',
      'pacientes', 'solicitudes_arco']) t
   WHERE NOT EXISTS (SELECT 1 FROM pg_trigger g
                      WHERE g.tgrelid = ('public.' || t)::regclass AND g.tgname = 'trg_' || t || '_sin_truncate'
                        AND g.tgtype = 34 AND g.tgfoid = 'public.prohibir_truncate()'::regprocedure
                        AND g.tgenabled = 'O' AND NOT g.tgisinternal);
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: faltan o difieren los disparadores de: %', v_mal;
  END IF;

  -- La función: sin EXECUTE a PUBLIC.
  IF has_function_privilege('public', 'public.prohibir_truncate()', 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
                 WHERE p.oid = 'public.prohibir_truncate()'::regprocedure AND a.grantee = 0) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: public.prohibir_truncate() conserva EXECUTE a PUBLIC.';
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- 7 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'tablas de public con TRUNCATE para anon / authenticated / service_role' AS comprobacion,
         (SELECT count(*)::text FROM pg_class c CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) r
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f')
             AND has_table_privilege(r, c.oid, 'TRUNCATE')) AS valor,
         '0' AS esperado
  UNION ALL
  SELECT 2, 'tablas a las que esta pasada quitó TRUNCATE (30 la primera vez en local; 0 al repetir)',
         (SELECT count(*)::text || coalesce(': ' || string_agg(tabla, ', ' ORDER BY tabla), '') FROM pg_temp._public_sin_truncate),
         NULL
  UNION ALL
  SELECT 3, 'disparadores sin_truncate (tgtype 34, prohibir_truncate, habilitados)',
         (SELECT count(*)::text FROM pg_trigger g
           WHERE g.tgname LIKE 'trg\_%\_sin\_truncate' AND g.tgtype = 34 AND NOT g.tgisinternal
             AND g.tgfoid = to_regprocedure('public.prohibir_truncate()') AND g.tgenabled = 'O'),
         '11'
  UNION ALL
  SELECT 4, 'prohibir_truncate: INVOKER / search_path vacío / md5 / EXECUTE a PUBLIC',
         coalesce((SELECT (NOT p.prosecdef)::text || ' / ' || (p.proconfig = ARRAY['search_path=""'])::text || ' / ' || md5(p.prosrc)
                          || ' / ' || EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.prohibir_truncate()')), 'AUSENTE'),
         'true / true / e1b07ec42accc1b181ac24b3a3d63400 / false'
  UNION ALL
  SELECT 5, 'disparadores contra TRUNCATE de antes (audit_log, firmas_documento), intactos',
         (SELECT string_agg(g.tgrelid::regclass::text || ':' || g.tgname || ':' || g.tgtype || ':' || g.tgenabled::text, ', '
                            ORDER BY g.tgrelid::regclass::text)
            FROM pg_trigger g WHERE g.tgname IN ('prevent_audit_truncate', 'trg_firmas_documento_no_truncate') AND NOT g.tgisinternal),
         NULL
  UNION ALL
  SELECT 6, 'privilegios por omisión de postgres en public (tablas)',
         coalesce((SELECT d.defaclacl::text FROM pg_default_acl d
                    WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace AND d.defaclobjtype = 'r'), 'NINGUNO'),
         NULL
  UNION ALL
  SELECT 7, 'privilegios por omisión de supabase_admin en public (tablas; postgres no puede cambiarlos)',
         coalesce((SELECT d.defaclacl::text FROM pg_default_acl d
                    WHERE d.defaclrole = to_regrole('supabase_admin') AND d.defaclnamespace = 'public'::regnamespace AND d.defaclobjtype = 'r'), 'NINGUNO'),
         NULL
  UNION ALL
  SELECT 8, 'tablas de public cuyo dueño no es postgres',
         coalesce((SELECT string_agg(c.relname || ':' || c.relowner::regrole::text, ', ' ORDER BY c.relname) FROM pg_class c
                    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f') AND c.relowner <> 'postgres'::regrole), 'ninguna'),
         NULL
) t
ORDER BY t.n;
