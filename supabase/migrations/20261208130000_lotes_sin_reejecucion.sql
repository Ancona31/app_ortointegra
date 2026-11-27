-- ════════════════════════════════════════════════════════════════════════
-- Agenda · BASE-2 · B2 — los lotes de la purga (M4) y de la cola de empalmes
-- (M5) vuelven a ser un tope: el lote se elige en una sentencia y se escribe en
-- otra
-- Rama: feature/agenda-para-todos · Escrita: 2026-11-27
-- Guion e informe de la reproducción: docs/spec/base-2/ENSAYO.md y
--   docs/spec/base-2/INFORME-LOTES.md
-- ────────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-27, stack local de Supabase (CLI 2.117.0): aplicada,
--   deshecha con su reversa y vuelta a aplicar; pruebas
--   b2_lotes_sin_reejecucion.sql, ap2_… y ap3_… en verde.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DE ENSAYO SOBRE EL CLON
--   DE ESTRUCTURA Y DE AUDITORÍA INDEPENDIENTE (supabase/AUDITORIA-MIGRACIONES.md).
--
-- EL DEFECTO (reproducido el 2026-11-27, con el plan capturado): las dos
--   funciones elegían y escribían el lote en UNA sentencia,
--     DELETE/UPDATE … WHERE id IN (SELECT … ORDER BY … LIMIT n FOR UPDATE SKIP LOCKED)
--   Cuando el planificador resuelve ese IN con «Nested Loop Semi Join» y deja la
--   subconsulta en el lado interior, la subconsulta se VUELVE A EJECUTAR por cada
--   fila de la tabla. Su LockRows no devuelve las filas que la propia sentencia
--   ya modificó, así que una nueva ejecución devuelve OTRAS n filas: el LIMIT
--   deja de ser un tope y la pasada puede llevarse más filas que el lote (hasta
--   todas las candidatas). El plan depende de las estadísticas (sale cuando la
--   tabla se estima diminuta), por eso las pruebas ap2 y ap3 fallaban sólo a
--   veces.
--   ALCANCE: sólo se procesan MÁS filas de las del lote en una pasada. Nunca
--   filas que no tocaban: el plazo de 30 días, la clínica y las demás
--   condiciones van dentro de la subconsulta y se cumplen en cada ejecución.
--   En M5, reserva_empalmes_registrar podía recibir más de 500 citas de una vez.
--
-- QUÉ HACE: reescribe public.reserva_purgar(integer) y
--   public.reserva_empalmes_pendientes_procesar(uuid, integer) con el MISMO
--   cuerpo salvo eso: el lote se elige (y se bloquea, con el mismo ORDER BY,
--   LIMIT y SKIP LOCKED) en un SELECT … INTO v_ids que no modifica nada, y la
--   escritura va en otra sentencia, WHERE id = ANY (v_ids). Así no depende del
--   plan: la sentencia que lleva el LIMIT no escribe (aunque se re-ejecutara
--   devolvería las mismas filas) y la que escribe no lleva LIMIT.
--   Nada más cambia: firmas, DEFINER/INVOKER, search_path, lock_timeout, dueño,
--   permisos (sólo service_role), el plazo, la auditoría y lo que devuelven.
--
-- Depende de: M4 (20261204120000) y M5 (20261205120000). Exige el cuerpo de M4 y
--   de M5 de las dos funciones (huella md5 de prosrc); si alguien las cambió,
--   aborta sin tocar nada.
-- Bloqueos: sólo catálogo (CREATE OR REPLACE de dos funciones). No toca filas.
-- Ventana de despliegue: no depende del código; puede ir antes o después.
-- Riesgo: BAJO. Mismas filas, mismo orden; lo único que cambia es que el tope se
--   cumple siempre.
-- No re-ejecutable: una segunda pasada ABORTA en el pre-vuelo sin cambiar nada.
-- Vuelta atrás: supabase/reversas/20261208130000_lotes_sin_reejecucion_reversa.sql
-- Prueba: supabase/pruebas-sql/b2_lotes_sin_reejecucion.sql
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_f regprocedure;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay que aplicarla como postgres (current_user es %).', current_user;
  END IF;
  IF to_regprocedure('public.reserva_purgar(integer)') IS NULL OR to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)') IS NULL
     OR to_regprocedure('public.reserva_empalmes_registrar(uuid, uuid[])') IS NULL
     OR to_regclass('public.gcal_empalmes_pendientes') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan los objetos de M4 (20261204120000) o de M5 (20261205120000).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.reserva_purgar(integer)'), to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)'))
                AND position('BASE-2 (B2)' IN p.prosrc) > 0) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: esta migración ya está aplicada. No se repite.';
  END IF;
  -- Las dos funciones, con el cuerpo de M4 y de M5 (fines de línea normalizados) y sus atributos.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_purgar(integer)')
                    AND p.prosecdef AND p.proconfig = ARRAY['search_path=""', 'lock_timeout=2s']
                    AND md5(replace(p.prosrc, E'\r\n', E'\n')) = '7952fee050cef1d7ed739a03a5793a2f') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.reserva_purgar no es la de M4 (DEFINER, search_path vacío, lock_timeout 2s y su cuerpo): alguien la cambió. No se reescribe a ciegas.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)')
                    AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                    AND md5(replace(p.prosrc, E'\r\n', E'\n')) = '5a5a1cb08484653cca01e178e1affa76') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.reserva_empalmes_pendientes_procesar no es la de M5 (INVOKER, search_path vacío y su cuerpo): alguien la cambió. No se reescribe a ciegas.';
  END IF;
  FOREACH v_f IN ARRAY ARRAY[to_regprocedure('public.reserva_purgar(integer)'), to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)')] LOOP
    IF NOT pg_has_role(current_user, (SELECT proowner FROM pg_proc WHERE oid = v_f), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de %.', current_user, v_f;
    END IF;
    IF has_function_privilege('anon', v_f, 'EXECUTE') OR has_function_privilege('authenticated', v_f, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_f, 'EXECUTE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es sólo de service_role.', v_f;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 1 · La purga de la reserva (M4): el cuerpo de M4 con el lote aparte.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserva_purgar(p_lote integer DEFAULT 5000)
 RETURNS TABLE (r_verificaciones integer, r_limites integer, r_correos integer, r_quedan boolean)
 LANGUAGE plpgsql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '2s'
AS $function$
DECLARE
  c_plazo CONSTANT interval := interval '30 days';
  v_lote  integer := least(greatest(coalesce(p_lote, 5000), 1), 5000);
  v_corte timestamptz := now() - c_plazo;
  v_ids   uuid[];
BEGIN
  -- a) Códigos de verificación de la reserva.
  -- BASE-2 (B2) · El lote se ELIGE (y se bloquea) en una sentencia que no modifica nada y se guarda en
  -- v_ids; la escritura va aparte, por esos ids. Antes iban juntas («WHERE id IN (subconsulta con LIMIT n y FOR
  -- UPDATE SKIP LOCKED)») y, con el plan «Nested Loop Semi Join», la subconsulta se volvía a ejecutar por
  -- cada fila: el LIMIT dejaba de ser un tope. NO las vuelvas a juntar, ni en una CTE sin MATERIALIZED.
  SELECT array_agg(s.id) INTO v_ids
    FROM (SELECT x.id FROM public.reserva_verificaciones x
           WHERE x.created_at < v_corte AND x.caduca_en < now()
             AND (x.ficha_caduca_en IS NULL OR x.ficha_caduca_en < now())
           ORDER BY x.created_at LIMIT v_lote FOR UPDATE SKIP LOCKED) s;
  DELETE FROM public.reserva_verificaciones v WHERE v.id = ANY (v_ids);
  GET DIAGNOSTICS r_verificaciones = ROW_COUNT;
  -- b) Intentos contados para los límites.
  SELECT array_agg(s.id) INTO v_ids
    FROM (SELECT x.id FROM public.ip_rate_limits x
           WHERE x.created_at < v_corte
           ORDER BY x.created_at LIMIT v_lote FOR UPDATE SKIP LOCKED) s;
  DELETE FROM public.ip_rate_limits l WHERE l.id = ANY (v_ids);
  GET DIAGNOSTICS r_limites = ROW_COUNT;
  -- c) El correo de los enlaces de un solo uso que dejaron de servir hace más de 30 días. SÓLO a NULL,
  --    SÓLO estas dos columnas, SÓLO únicos. (least() ignora los NULL: el primero de los cuatro instantes.)
  SELECT array_agg(s.id) INTO v_ids
    FROM (SELECT x.id FROM public.reserva_enlaces x
           WHERE x.clase = 'unico' AND x.correo IS NOT NULL
             AND least(x.usado_en, x.revocado_en, x.agotado_en, x.caduca_en) < v_corte
           ORDER BY x.created_at LIMIT v_lote FOR UPDATE SKIP LOCKED) s;
  UPDATE public.reserva_enlaces e SET correo = NULL, correo_hmac = NULL
   WHERE e.id = ANY (v_ids) AND e.clase = 'unico';
  GET DIAGNOSTICS r_correos = ROW_COUNT;
  r_quedan := greatest(r_verificaciones, r_limites, r_correos) >= v_lote;
  -- d) El registro de la pasada: sólo números.
  INSERT INTO public.audit_log (user_id, accion, tabla, descripcion)
  VALUES ('system', 'reserva_purga', 'reserva_verificaciones',
          jsonb_build_object('dias', 30, 'reserva_verificaciones', r_verificaciones, 'ip_rate_limits', r_limites,
                             'correos_de_enlaces_unicos', r_correos, 'quedan', r_quedan)::text);
  RETURN NEXT;
END
$function$;

-- ---------------------------------------------------------------------
-- 2 · La cola de empalmes de Google (M5): el cuerpo de M5 con el lote aparte.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserva_empalmes_pendientes_procesar(p_clinica_id uuid, p_limite integer DEFAULT 500)
 RETURNS TABLE (r_procesados integer, r_pares integer, r_quedan boolean)
 LANGUAGE plpgsql
 VOLATILE
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  v_lim integer := least(greatest(coalesce(p_limite, 500), 1), 500);
  v_tomar uuid[];
  v_ids uuid[];
BEGIN
  IF p_clinica_id IS NULL THEN
    RAISE EXCEPTION 'reserva_empalmes_pendientes_procesar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- BASE-2 (B2) · El lote se ELIGE (y se bloquea) aparte, en una sentencia que no modifica nada; el DELETE
  -- va por esos ids. Juntas («WHERE cita_id IN (subconsulta con LIMIT n y FOR UPDATE SKIP LOCKED)»), con el plan
  -- «Nested Loop Semi Join» la subconsulta se volvía a ejecutar por cada fila y el LIMIT dejaba de ser un
  -- tope. NO las vuelvas a juntar.
  SELECT array_agg(s.cita_id) INTO v_tomar
    FROM (SELECT x.cita_id FROM public.gcal_empalmes_pendientes x
           WHERE x.clinica_id = p_clinica_id
           ORDER BY x.creado_en LIMIT v_lim FOR UPDATE SKIP LOCKED) s;
  WITH tomados AS (
    DELETE FROM public.gcal_empalmes_pendientes p
     WHERE p.clinica_id = p_clinica_id AND p.cita_id = ANY (v_tomar)
    RETURNING p.cita_id)
  SELECT coalesce(array_agg(t.cita_id), ARRAY[]::uuid[]) INTO v_ids FROM tomados t;
  r_procesados := cardinality(v_ids);
  r_pares := 0;
  IF r_procesados > 0 THEN
    r_pares := public.reserva_empalmes_registrar(p_clinica_id, v_ids);
  END IF;
  r_quedan := r_procesados >= v_lim;
  RETURN NEXT;
END
$function$;

DO $$
DECLARE
  v_f regprocedure;
BEGIN
  FOREACH v_f IN ARRAY ARRAY[to_regprocedure('public.reserva_purgar(integer)'), to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)')] LOOP
    IF (SELECT position('BASE-2 (B2)' IN p.prosrc) = 0 OR p.prosrc ~* 'IN\s*\(\s*SELECT' FROM pg_proc p WHERE p.oid = v_f) THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % no quedó con el lote aparte (o conserva un «IN (SELECT»).', v_f;
    END IF;
    IF has_function_privilege('anon', v_f, 'EXECUTE') OR has_function_privilege('authenticated', v_f, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_f, 'EXECUTE')
       OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                   WHERE p.oid = v_f AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % dejó de ser sólo de service_role.', v_f;
    END IF;
  END LOOP;
  IF NOT (SELECT p.prosecdef AND p.proconfig = ARRAY['search_path=""', 'lock_timeout=2s'] FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_purgar(integer)')) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: reserva_purgar dejó de ser DEFINER con search_path vacío y lock_timeout de 2s.';
  END IF;
  IF NOT (SELECT NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'] FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)')) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: reserva_empalmes_pendientes_procesar dejó de ser INVOKER con search_path vacío.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS resultado
FROM (
  SELECT 1 AS n, 'reserva_purgar: DEFINER, search_path vacío + lock_timeout 2s, con el lote aparte; anon/authenticated/service_role' AS comprobacion,
         (SELECT (p.prosecdef AND p.proconfig = ARRAY['search_path=""', 'lock_timeout=2s'] AND position('BASE-2 (B2)' IN p.prosrc) > 0)::text || ' ; '
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_purgar(integer)')) AS valor,
         'true ; false/false/true' AS esperado
  UNION ALL
  SELECT 2, 'reserva_empalmes_pendientes_procesar: INVOKER, search_path vacío, con el lote aparte; anon/authenticated/service_role',
         (SELECT (NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'] AND position('BASE-2 (B2)' IN p.prosrc) > 0)::text || ' ; '
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)')),
         'true ; false/false/true'
  UNION ALL
  SELECT 3, 'ninguna de las dos conserva el cuerpo de M4 / M5 ni un «IN (SELECT»',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.reserva_purgar(integer)'), to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)'))
             AND (md5(replace(p.prosrc, E'\r\n', E'\n')) IN ('7952fee050cef1d7ed739a03a5793a2f', '5a5a1cb08484653cca01e178e1affa76') OR p.prosrc ~* 'IN\s*\(\s*SELECT')),
         '0'
  UNION ALL
  SELECT 4, 'dueño de las dos (el de antes: postgres)',
         (SELECT string_agg(DISTINCT pg_get_userbyid(p.proowner), ',') FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.reserva_purgar(integer)'), to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)'))),
         'postgres'
  UNION ALL
  SELECT 5, 'apuntes en la cola de empalmes ahora mismo', (SELECT count(*)::text FROM public.gcal_empalmes_pendientes), NULL
  UNION ALL
  SELECT 6, 'pasadas de la purga registradas en audit_log (reserva_purga)',
         (SELECT count(*)::text FROM public.audit_log WHERE accion = 'reserva_purga'), NULL
) t
ORDER BY t.n;
