-- ═══════════════════════════════════════════════════════════════════════
-- Agenda v2 sin TRUNCATE en las tablas con datos de personas
-- Añadido APARTE del conjunto fundido (decisión de Angel, 2026-11-22): va
-- después de las seis (F1 … F5b) para no tocar su equivalencia con las 44.
-- Rama: feature/agenda-v2-produccion-t · Escrita: 2026-11-22
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-22, clon de la foto de producción
--   (clonar-desde-foto.sh, contenedor propio), como postgres: las 8 nuevas en
--   orden (20261125170000 y F5a con su huella md5 normalizada a \n, en copias
--   fuera del repo), luego ésta (rejilla 4/4 OK); segunda pasada sin cambios;
--   prueba t_agenda_sin_truncate.sql en verde; reversa; otra vez la ida.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. AUDITADA (auditor independiente,
--   dentro del conjunto de las 9; el SQL de este archivo no cambió desde
--   entonces):
--   · ronda 1, 2026-11-22 (supabase/produccion/auditoria/RONDA-1.md): aplicada
--     en orden sobre un clon de la foto con rc=0 y 0 filas REVISAR, segunda
--     pasada en verde y reversa en verde; ningún hallazgo es de este archivo
--     (A6 era de las rejillas de 20261126120000 y F5a, que ésta hacía saltar;
--     corregido). Veredicto del conjunto: «ninguno es BLOQUEANTE».
--   · ronda 2, pasada 2, 2026-11-22/23 (RONDA-2.md, P2-1, fila T): pre-vuelo y
--     post-vuelo leídos enteros; defectos: «ninguno». Veredicto: «no hay
--     hallazgos que impidan aplicar las 9 migraciones a producción».
--
-- Qué hace:
--   1. Disparador de sentencia trg_<tabla>_sin_truncate (BEFORE TRUNCATE FOR
--      EACH STATEMENT, public.prohibir_truncate(), la de 20261126120000; no se
--      crea otra) en las 11 tablas de la agenda que guardan datos de personas:
--      agenda_bloqueos, avisos_clinica, cita_confirmaciones, cita_correos,
--      cita_reagendos, gcal_movimientos_rechazados, reserva_contactos,
--      reserva_empalmes_google, reserva_enlaces, reserva_incidencias y
--      reserva_verificaciones. Para el dueño (postgres) y supabase_admin, que
--      conservan el privilegio; los tres roles de la API ya no lo tienen.
--   2. Quita TRUNCATE a anon, authenticated y service_role en las 16 tablas que
--      crea la agenda (las 15 de public y respaldos.consultorios_horario_20261119)
--      si alguna lo conservara. Hoy ninguna lo tiene (comprobado en el clon):
--      cada migración de la agenda lo revoca y los privilegios por omisión de
--      20261126120000 lo quitan al nacer. Es un cinturón: el post-vuelo exige
--      cero.
--   Las otras 5 tablas de la agenda NO llevan disparador porque no guardan
--   datos de personas: agenda_ajustes y tipos_cita (configuración),
--   reserva_avisos (versiones del aviso de privacidad), gcal_sync_estado
--   (tokens y estado de la sincronización por clínica) y
--   respaldos.consultorios_horario_20261119 (horarios de consultorio).
--   appointments (con sus columnas reserva_*) ya lo lleva desde 20261126120000.
-- Depende de: 20261126120000_public_sin_truncate (prohibir_truncate(), md5
--   e1b07ec4… normalizado a \n) y de las seis fundidas (las tablas). Ningún
--   código ni prueba hace TRUNCATE de estas tablas (grep del 2026-11-22 en
--   src, scripts, e2e y supabase; la semilla limpia con DELETE).
-- Bloqueos (lock_timeout 5 s): cada CREATE TRIGGER toma SHARE ROW EXCLUSIVE
--   sobre su tabla hasta el COMMIT (frena escrituras, no lecturas). Son tablas
--   nuevas y pequeñas; si alguna está ocupada más de 5 s, aborta entero sin
--   cambiar nada: reintentar. El REVOKE sólo escribe catálogo.
-- Riesgo: BAJO. No toca filas, columnas, policies ni disparadores existentes;
--   nada se concede. Con session_replication_role = replica los disparadores
--   no se disparan (como los de 20261126120000; AG-DT-252).
-- Re-ejecutable: una segunda pasada no cambia nada (CREATE OR REPLACE TRIGGER;
--   el pre-vuelo aborta si un disparador con ese nombre tiene otra forma).
-- Efecto lateral conocido: la rejilla final de F5a (fila 6, disparadores de
--   agenda_bloqueos) diría REVISAR si F5a se repitiera después de ésta; su
--   post-vuelo mira sólo sus dos disparadores por nombre y no aborta.
-- Vuelta atrás: supabase/reversas/20261201180000_agenda_sin_truncate_reversa.sql
-- Prueba: supabase/pruebas-sql/t_agenda_sin_truncate.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- tabla:migración que la crea, para el mensaje.
  v_con constant text[] := ARRAY['agenda_bloqueos:20261201130000', 'avisos_clinica:20261201160000',
    'cita_confirmaciones:20261201160000', 'cita_correos:20261201160000', 'cita_reagendos:20261201160000',
    'gcal_movimientos_rechazados:20261201150000', 'reserva_contactos:20261201140000',
    'reserva_empalmes_google:20261201150000', 'reserva_enlaces:20261201140000',
    'reserva_incidencias:20261201140000', 'reserva_verificaciones:20261201140000'];
  v_sin constant text[] := ARRAY['public.agenda_ajustes', 'public.tipos_cita', 'public.reserva_avisos',
    'public.gcal_sync_estado', 'respaldos.consultorios_horario_20261119'];
  v_e text;
  v_t text;
  v_rel regclass;
  v_def text;
  v_mal text;
BEGIN
  -- La función de 20261126120000, exactamente (md5 con los saltos de línea normalizados).
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
                  WHERE p.oid = to_regprocedure('public.prohibir_truncate()')
                    AND md5(replace(p.prosrc, E'\r\n', E'\n')) = 'e1b07ec42accc1b181ac24b3a3d63400'
                    AND NOT p.prosecdef AND p.prorettype = 'pg_catalog.trigger'::regtype
                    AND p.proconfig = ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.prohibir_truncate() o no es la de 20261126120000: aplica antes 20261126120000_public_sin_truncate.';
  END IF;

  -- Las 11 tablas existen y quien aplica actúa como su dueño.
  FOREACH v_e IN ARRAY v_con LOOP
    v_t := split_part(v_e, ':', 1);
    v_rel := to_regclass('public.' || v_t);
    IF v_rel IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe public.%: aplica antes %.', v_t, split_part(v_e, ':', 2);
    END IF;
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = v_rel), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de public.%.', current_user, v_t;
    END IF;
  END LOOP;
  FOREACH v_t IN ARRAY v_sin LOOP
    IF to_regclass(v_t) IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe %: aplica antes las seis fundidas (20261201120000 … 20261201170000).', v_t;
    END IF;
  END LOOP;

  -- Un TRUNCATE de los tres roles (o de PUBLIC) en estas 16 tablas tiene que poder quitarlo quien aplica:
  -- concedido por el dueño, del que es miembro. Si no, el REVOKE pasaría sin efecto: se aborta con el nombre.
  SELECT string_agg(format('%s (a %s, por %s, dueño %s)', c.oid::regclass,
                           CASE a.grantee WHEN 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,
                           a.grantor::regrole, c.relowner::regrole), '; ' ORDER BY c.oid::regclass::text)
    INTO v_mal
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
   WHERE c.oid IN (SELECT to_regclass('public.' || split_part(x, ':', 1)) FROM unnest(v_con) x
                   UNION SELECT to_regclass(x) FROM unnest(v_sin) x)
     AND a.privilege_type = 'TRUNCATE'
     AND (a.grantee = 0 OR a.grantee IN ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole))
     AND (a.grantee = 0 OR a.grantor <> c.relowner OR NOT pg_has_role(current_user, c.relowner, 'USAGE'));
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: TRUNCATE que esta migración no puede quitar: %', v_mal;
  END IF;

  -- Replay: un disparador con el nombre de esta migración tiene que ser exactamente el suyo
  -- (tgtype 34 = BEFORE + TRUNCATE, de sentencia; prohibir_truncate(); sin argumentos, WHEN ni columnas).
  FOREACH v_e IN ARRAY v_con LOOP
    v_t := split_part(v_e, ':', 1);
    SELECT pg_get_triggerdef(t.oid) INTO v_def FROM pg_trigger t
     WHERE t.tgrelid = to_regclass('public.' || v_t) AND t.tgname = 'trg_' || v_t || '_sin_truncate' AND NOT t.tgisinternal
       AND NOT (t.tgtype = 34 AND t.tgfoid = 'public.prohibir_truncate()'::regprocedure
                AND t.tgnargs = 0 AND t.tgqual IS NULL AND t.tgattr = ''::int2vector);
    IF FOUND THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: ya existe trg_%_sin_truncate con otra definición: %', v_t, v_def;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Cinturón: TRUNCATE fuera para los tres roles en las 16 tablas de la
--     agenda (hoy no lo tiene ninguna). Se apuntan sólo para la rejilla.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS pg_temp._agenda_sin_truncate;
CREATE TEMP TABLE _agenda_sin_truncate (tabla text PRIMARY KEY);

DO $$
DECLARE
  v_rel regclass;
BEGIN
  FOR v_rel IN
    SELECT DISTINCT c.oid::regclass FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
     WHERE c.oid IN (SELECT to_regclass(x) FROM unnest(ARRAY['public.agenda_ajustes', 'public.agenda_bloqueos',
             'public.avisos_clinica', 'public.cita_confirmaciones', 'public.cita_correos', 'public.cita_reagendos',
             'public.gcal_movimientos_rechazados', 'public.gcal_sync_estado', 'public.reserva_avisos',
             'public.reserva_contactos', 'public.reserva_empalmes_google', 'public.reserva_enlaces',
             'public.reserva_incidencias', 'public.reserva_verificaciones', 'public.tipos_cita',
             'respaldos.consultorios_horario_20261119']) x)
       AND a.privilege_type = 'TRUNCATE'
       AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
  LOOP
    EXECUTE format('REVOKE TRUNCATE ON TABLE %s FROM anon, authenticated, service_role', v_rel);
    INSERT INTO pg_temp._agenda_sin_truncate VALUES (v_rel::text);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3 · Los 11 disparadores de sentencia.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_agenda_bloqueos_sin_truncate BEFORE TRUNCATE ON public.agenda_bloqueos
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_avisos_clinica_sin_truncate BEFORE TRUNCATE ON public.avisos_clinica
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_cita_confirmaciones_sin_truncate BEFORE TRUNCATE ON public.cita_confirmaciones
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_cita_correos_sin_truncate BEFORE TRUNCATE ON public.cita_correos
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_cita_reagendos_sin_truncate BEFORE TRUNCATE ON public.cita_reagendos
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_gcal_movimientos_rechazados_sin_truncate BEFORE TRUNCATE ON public.gcal_movimientos_rechazados
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_reserva_contactos_sin_truncate BEFORE TRUNCATE ON public.reserva_contactos
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_reserva_empalmes_google_sin_truncate BEFORE TRUNCATE ON public.reserva_empalmes_google
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_reserva_enlaces_sin_truncate BEFORE TRUNCATE ON public.reserva_enlaces
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_reserva_incidencias_sin_truncate BEFORE TRUNCATE ON public.reserva_incidencias
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();
CREATE OR REPLACE TRIGGER trg_reserva_verificaciones_sin_truncate BEFORE TRUNCATE ON public.reserva_verificaciones
  FOR EACH STATEMENT EXECUTE FUNCTION public.prohibir_truncate();

-- ---------------------------------------------------------------------
-- 4 · Post-vuelo, ANTES del COMMIT. Si algo no quedó, aborta y no queda nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_mal text;
BEGIN
  -- Los 11 disparadores existen, con su forma y habilitados.
  SELECT string_agg(t, ', ') INTO v_mal
    FROM unnest(ARRAY['agenda_bloqueos', 'avisos_clinica', 'cita_confirmaciones', 'cita_correos', 'cita_reagendos',
      'gcal_movimientos_rechazados', 'reserva_contactos', 'reserva_empalmes_google', 'reserva_enlaces',
      'reserva_incidencias', 'reserva_verificaciones']) t
   WHERE NOT EXISTS (SELECT 1 FROM pg_trigger g
                      WHERE g.tgrelid = ('public.' || t)::regclass AND g.tgname = 'trg_' || t || '_sin_truncate'
                        AND g.tgtype = 34 AND g.tgfoid = 'public.prohibir_truncate()'::regprocedure
                        AND g.tgnargs = 0 AND g.tgqual IS NULL AND g.tgenabled = 'O' AND NOT g.tgisinternal);
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: faltan, difieren o están deshabilitados los disparadores de: %', v_mal;
  END IF;

  -- Cero TRUNCATE efectivo (directo, por PUBLIC o por pertenencia) para los tres roles en las 16 tablas.
  SELECT string_agg(x || ':' || r, ', ' ORDER BY x, r) INTO v_mal
    FROM unnest(ARRAY['public.agenda_ajustes', 'public.agenda_bloqueos', 'public.avisos_clinica',
      'public.cita_confirmaciones', 'public.cita_correos', 'public.cita_reagendos', 'public.gcal_movimientos_rechazados',
      'public.gcal_sync_estado', 'public.reserva_avisos', 'public.reserva_contactos', 'public.reserva_empalmes_google',
      'public.reserva_enlaces', 'public.reserva_incidencias', 'public.reserva_verificaciones', 'public.tipos_cita',
      'respaldos.consultorios_horario_20261119']) x
    CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) r
   WHERE has_table_privilege(r, x, 'TRUNCATE');
  IF v_mal IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: conservan TRUNCATE: %', v_mal;
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- 5 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'disparadores sin_truncate de la agenda (tgtype 34, prohibir_truncate, habilitados)' AS comprobacion,
         (SELECT count(*)::text FROM pg_trigger g
           WHERE g.tgname LIKE 'trg\_%\_sin\_truncate' AND g.tgtype = 34 AND NOT g.tgisinternal AND g.tgenabled = 'O'
             AND g.tgfoid = to_regprocedure('public.prohibir_truncate()')
             AND g.tgrelid IN (SELECT to_regclass('public.' || x) FROM unnest(ARRAY['agenda_bloqueos', 'avisos_clinica',
               'cita_confirmaciones', 'cita_correos', 'cita_reagendos', 'gcal_movimientos_rechazados', 'reserva_contactos',
               'reserva_empalmes_google', 'reserva_enlaces', 'reserva_incidencias', 'reserva_verificaciones']) x)) AS valor,
         '11' AS esperado
  UNION ALL
  SELECT 2, 'disparadores sin_truncate en todo public (11 de 20261126120000 + 11 de ésta)',
         (SELECT count(*)::text FROM pg_trigger g
           WHERE g.tgname LIKE 'trg\_%\_sin\_truncate' AND g.tgtype = 34 AND NOT g.tgisinternal AND g.tgenabled = 'O'
             AND g.tgfoid = to_regprocedure('public.prohibir_truncate()')),
         '22'
  UNION ALL
  SELECT 3, 'tablas de public y respaldos con TRUNCATE para anon / authenticated / service_role',
         (SELECT count(*)::text FROM pg_class c CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) r
           WHERE c.relnamespace IN ('public'::regnamespace, 'respaldos'::regnamespace) AND c.relkind IN ('r', 'p', 'f')
             AND has_table_privilege(r, c.oid, 'TRUNCATE')),
         '0'
  UNION ALL
  SELECT 4, 'tablas de la agenda a las que esta pasada quitó TRUNCATE (0 esperado: ya nacen sin él)',
         (SELECT count(*)::text || coalesce(': ' || string_agg(tabla, ', ' ORDER BY tabla), '') FROM pg_temp._agenda_sin_truncate),
         '0'
) t
ORDER BY t.n;

