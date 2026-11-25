-- ═══════════════════════════════════════════════════════════════════════
-- Reserva por enlace · M4 — purga a los 30 días y tope de emisión en la base
-- (AG-DT-274)
-- Rama: feature/agenda-para-todos · Escrita: 2026-11-25
-- Guion y repaso del autor: docs/spec/agenda-para-todos/
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-25, stack local de Supabase (CLI 2.117.0) con las 18
--   migraciones anteriores: aplicada, deshecha con su reversa y vuelta a
--   aplicar; prueba ap2_reserva_purga_y_tope.sql en verde.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DE ENSAYO SOBRE EL CLON
--   DE ESTRUCTURA Y DE AUDITORÍA INDEPENDIENTE (supabase/AUDITORIA-MIGRACIONES.md).
--
-- DECISIONES DE ANGEL: plazo de 30 DÍAS, aplicado por una TAREA AUTOMÁTICA
--   (2026-11-22); purgar también ip_rate_limits y VACIAR el correo en claro de
--   los enlaces de un solo uso que ya no están vigentes (2026-11-25).
--
-- QUÉ HACE:
--   1 · public.reserva_purgar(p_lote): UNA pasada de la purga, en una
--       transacción. La llama la tarea diaria GET /api/cron/purga-reserva
--       (service_role) hasta que no queda nada. El plazo (30 días) NO es un
--       argumento: quien la llame no puede purgar nada reciente. Por pasada,
--       como mucho p_lote filas (1 a 5 000) de cada cosa, con SKIP LOCKED:
--       a) BORRA de reserva_verificaciones los códigos de la reserva con más
--          de 30 días (su código vale 10 min y su ficha 30: están caducados
--          siempre; la condición va escrita igual). Guardan el HMAC del correo
--          de quien pidió un código, reservara o no. Ninguna tabla los apunta.
--       b) BORRA de ip_rate_limits los intentos con más de 30 días. La ventana
--          más larga que alguien cuenta sobre esa tabla es de 24 h (reservar por
--          enlace) y todas cuentan «desde hace N minutos»: ninguna cuenta
--          depende de filas viejas (leído en src/lib/rateLimit.ts,
--          src/lib/reserva/limitesReserva.ts, las rutas de auth,
--          rate_limit_intento y rate_limit_espera). La tabla guarda IP, y
--          correos en claro en los límites del inicio de sesión.
--       c) VACÍA (pone a NULL, nada más) reserva_enlaces.correo y correo_hmac
--          de los enlaces de UN SOLO USO que dejaron de servir hace más de 30
--          días (usados, revocados, agotados o caducados: el primero de esos
--          instantes). El enlace NO se borra (lo apuntan citas con RESTRICT).
--       d) Deja UNA fila en audit_log por pasada, también si no borró nada:
--          accion 'reserva_purga', user_id 'system', y en la descripción sólo
--          números (plazo y filas por tabla). Ningún HMAC, correo ni id.
--   2 · reserva_codigo_emitir(…): el cuerpo de F3 más un TOPE propio: como
--       mucho 3 códigos por correo (su HMAC) en 60 minutos, contados en toda
--       la tabla; al cuarto devuelve 'limite' sin escribir nada. Es el mismo
--       número y la misma ventana que LIMITES.codigo.correo de
--       src/lib/reserva/limitesReserva.ts, que NO se toca: esto es un segundo
--       cinturón para quien llame a la función por otro camino.
--   3 · Tres índices: reserva_verificaciones (created_at) y (correo_hmac,
--       created_at); ip_rate_limits (created_at).
--
-- ⚠️ reserva_purgar() ES SECURITY DEFINER, Y DE ESO DEPENDE EL PUNTO (c).
--   proteger_reserva_enlace_unico() (F3) prohíbe cambiar el correo de un enlace
--   emitido a todo rol salvo postgres y supabase_admin. Esta función corre como
--   su dueño (postgres) y por eso pasa, SIN TOCAR ese disparador: cualquier otro
--   cambio del correo, desde la sesión o con service_role, sigue fallando como
--   hoy (lo prueba ap2, en los dos sentidos). Lo estrecho de la excepción está
--   AQUÍ: sólo NULL, sólo esas dos columnas, sólo únicos, sólo los que dejaron
--   de servir hace más de 30 días. Quien edite esta función conserva las cuatro.
--   El pre-vuelo exige el cuerpo vigente del disparador (su huella).
-- QUÉ LEE ESE CORREO, Y QUÉ VE DESPUÉS DEL VACIADO:
--   · reservar_por_enlace lo lee al RESERVAR con un único vigente: un enlace
--     vaciado ya no era reservable (usado, revocado, agotado o caducado).
--   · La cita reservada guarda SU copia (appointments.reserva_correo y
--     reserva_correo_hmac): comprobante, recordatorio, candado e historial leen
--     de la cita y de reserva_incidencias, no del enlace. No cambian.
--   · La pantalla de enlaces de la clínica enseña el correo del único: en uno de
--     hace más de 30 días ya no lo enseña.
-- EL CANDADO CONSULTIVO DEL TOPE (1793, por correo): se toma dentro de la
--   función y se suelta al terminar su transacción (una llamada: milisegundos).
--   Quien pida códigos en bucle para el correo de otro no puede retenerlo: cada
--   llamada lo suelta al volver. Lo que sí puede es gastar los 3 por hora de ese
--   correo, igual que hoy con el tope de la app.
--
-- Depende de: F3 (20261201140000) y F1. No depende de M3 ni de MA.
-- Bloqueos: SHARE sobre reserva_verificaciones e ip_rate_limits mientras se
--   crean los índices (bloquea escrituras, no lecturas; las tablas son
--   pequeñas), en el ÚLTIMO bloque DO. Lo demás, catálogo.
-- Ventana de despliegue: cualquiera de los dos órdenes es seguro. Sin el
--   código, nadie llama a reserva_purgar y 'limite' no llega a salir (la app ya
--   corta en 3). El código sin la migración: la tarea recibe PGRST202, lo
--   registra y contesta 500; la ruta del código no ve nunca 'limite'.
-- Riesgo: MEDIO-ALTO. Borra filas (que nada apunta y que ya no sirven) y
--   reescribe una función del camino público de la reserva.
-- No re-ejecutable: una segunda pasada ABORTA en el pre-vuelo sin cambiar nada.
-- Vuelta atrás: supabase/reversas/20261204120000_reserva_purga_y_tope_reversa.sql
--   (lo purgado no vuelve).
-- Prueba: supabase/pruebas-sql/ap2_reserva_purga_y_tope.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP TABLE IF EXISTS pg_temp._m4_antes;
CREATE TEMP TABLE _m4_antes (verificaciones bigint NOT NULL, verificaciones_viejas bigint NOT NULL,
                             limites bigint NOT NULL, limites_viejos bigint NOT NULL, correos_vaciables bigint NOT NULL);

DO $$
DECLARE
  v_t text;
BEGIN
  IF to_regprocedure('public.reserva_purgar(integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.reserva_purgar(integer) ya existe: esta migración ya está aplicada. No se repite.';
  END IF;
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay que aplicarla como postgres (current_user es %): reserva_purgar() tiene que ser de un rol al que proteger_reserva_enlace_unico() deje vaciar el correo.', current_user;
  END IF;
  FOREACH v_t IN ARRAY ARRAY['reserva_verificaciones', 'reserva_enlaces', 'ip_rate_limits', 'audit_log'] LOOP
    IF to_regclass('public.' || v_t) IS NULL THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.% (F3, 20261201140000, o las de main).', v_t;
    END IF;
  END LOOP;
  FOREACH v_t IN ARRAY ARRAY['reserva_verificaciones', 'ip_rate_limits'] LOOP
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = to_regclass('public.' || v_t)), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de public.% (no podría crear su índice).', current_user, v_t;
    END IF;
  END LOOP;
  -- Las dos funciones de F3 de las que depende esto, con SU cuerpo (fines de línea normalizados).
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_codigo_emitir(uuid, uuid, text, text)')
                    AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                    AND md5(replace(p.prosrc, E'\r\n', E'\n')) = '3885430cced1c390068f8c6a168d0ddb') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.reserva_codigo_emitir no es la de F3 (INVOKER, search_path vacío y su cuerpo): alguien la cambió. No se reescribe a ciegas.';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT proowner FROM pg_proc WHERE oid = to_regprocedure('public.reserva_codigo_emitir(uuid, uuid, text, text)')), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de reserva_codigo_emitir.', current_user;
  END IF;
  -- El disparador que guarda el correo del único: tiene que dejar pasar a postgres y a nadie más de la app.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.proteger_reserva_enlace_unico()')
                    AND NOT p.prosecdef
                    AND position('current_user IN (''postgres'', ''supabase_admin'')' IN p.prosrc) > 0
                    AND position('(NEW.correo, NEW.correo_hmac) IS DISTINCT FROM (OLD.correo, OLD.correo_hmac)' IN p.prosrc) > 0)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = 'public.reserva_enlaces'::regclass AND NOT g.tgisinternal
                       AND g.tgenabled = 'O' AND g.tgfoid = to_regprocedure('public.proteger_reserva_enlace_unico()')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: proteger_reserva_enlace_unico() no es la de F3 o su disparador no está habilitado: no se sabe quién podría cambiar el correo de un enlace.';
  END IF;
  -- Las columnas que nombra la purga.
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.reserva_enlaces'::regclass AND NOT attisdropped
         AND attname IN ('clase', 'correo', 'correo_hmac', 'usado_en', 'revocado_en', 'agotado_en', 'caduca_en')) <> 7
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.reserva_verificaciones'::regclass AND NOT attisdropped
           AND attname IN ('id', 'created_at', 'caduca_en', 'ficha_caduca_en', 'correo_hmac')) <> 5
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.ip_rate_limits'::regclass AND NOT attisdropped
           AND attname IN ('id', 'created_at')) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_enlaces, reserva_verificaciones o ip_rate_limits no tienen las columnas que la purga nombra.';
  END IF;
  -- Nada apunta a lo que se borra (una FK nueva haría fallar la purga, o peor, borrar en cascada).
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE contype = 'f'
                AND confrelid IN ('public.reserva_verificaciones'::regclass, 'public.ip_rate_limits'::regclass)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: alguna tabla apunta con una FK a reserva_verificaciones o a ip_rate_limits: revisar antes de purgar.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace
                AND relname IN ('reserva_verificaciones_created_at_idx', 'reserva_verificaciones_correo_idx', 'ip_rate_limits_created_at_idx')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: ya existe alguno de los tres índices de esta migración (¿un resto?). DROP INDEX y volver a correr.';
  END IF;
  INSERT INTO pg_temp._m4_antes
  SELECT (SELECT count(*) FROM public.reserva_verificaciones),
         (SELECT count(*) FROM public.reserva_verificaciones WHERE created_at < now() - interval '30 days'),
         (SELECT count(*) FROM public.ip_rate_limits),
         (SELECT count(*) FROM public.ip_rate_limits WHERE created_at < now() - interval '30 days'),
         (SELECT count(*) FROM public.reserva_enlaces e WHERE e.clase = 'unico' AND e.correo IS NOT NULL
             AND least(e.usado_en, e.revocado_en, e.agotado_en, e.caduca_en) < now() - interval '30 days');
END $$;

-- ---------------------------------------------------------------------
-- 1 · La purga. Una pasada = una transacción. Ver la cabecera (⚠️).
-- ---------------------------------------------------------------------
CREATE FUNCTION public.reserva_purgar(p_lote integer DEFAULT 5000)
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
BEGIN
  -- a) Códigos de verificación de la reserva.
  DELETE FROM public.reserva_verificaciones v
   WHERE v.id IN (SELECT x.id FROM public.reserva_verificaciones x
                   WHERE x.created_at < v_corte AND x.caduca_en < now()
                     AND (x.ficha_caduca_en IS NULL OR x.ficha_caduca_en < now())
                   ORDER BY x.created_at LIMIT v_lote FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS r_verificaciones = ROW_COUNT;
  -- b) Intentos contados para los límites.
  DELETE FROM public.ip_rate_limits l
   WHERE l.id IN (SELECT x.id FROM public.ip_rate_limits x
                   WHERE x.created_at < v_corte
                   ORDER BY x.created_at LIMIT v_lote FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS r_limites = ROW_COUNT;
  -- c) El correo de los enlaces de un solo uso que dejaron de servir hace más de 30 días. SÓLO a NULL,
  --    SÓLO estas dos columnas, SÓLO únicos. (least() ignora los NULL: el primero de los cuatro instantes.)
  UPDATE public.reserva_enlaces e SET correo = NULL, correo_hmac = NULL
   WHERE e.id IN (SELECT x.id FROM public.reserva_enlaces x
                   WHERE x.clase = 'unico' AND x.correo IS NOT NULL
                     AND least(x.usado_en, x.revocado_en, x.agotado_en, x.caduca_en) < v_corte
                   ORDER BY x.created_at LIMIT v_lote FOR UPDATE SKIP LOCKED);
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
REVOKE EXECUTE ON FUNCTION public.reserva_purgar(integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_purgar(integer) TO service_role;
COMMENT ON FUNCTION public.reserva_purgar(integer) IS
  'AG-DT-274 (M4): una pasada de la purga de la reserva por enlace, plazo FIJO de 30 días: borra códigos de reserva_verificaciones e intentos de ip_rate_limits con más de 30 días, y pone a NULL el correo (y su HMAC) de los enlaces de un solo uso que dejaron de servir hace más de 30 días. Por lotes (p_lote, 1 a 5000, SKIP LOCKED); r_quedan = repetir. Deja una fila en audit_log (reserva_purga) con sólo números. SECURITY DEFINER a propósito: es lo que la deja pasar proteger_reserva_enlace_unico(); no le añadas ningún otro cambio de reserva_enlaces. Sólo service_role (la tarea /api/cron/purga-reserva).';

-- ---------------------------------------------------------------------
-- 2 · reserva_codigo_emitir: el cuerpo de F3 y, nuevo, el tope por correo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserva_codigo_emitir(p_clinica_id uuid, p_enlace_id uuid, p_correo_hmac text, p_codigo_hmac text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_enlace_id IS NULL OR p_correo_hmac IS NULL OR p_codigo_hmac IS NULL
     OR p_correo_hmac !~ '^[0-9a-f]{64}$' OR p_codigo_hmac !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'reserva_codigo_emitir: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_enlaces e
                  WHERE e.id = p_enlace_id AND e.clinica_id = p_clinica_id AND e.clase = 'fijo' AND e.revocado_en IS NULL AND e.pausado_en IS NULL
                    AND public.agenda_v2_encendida(e.clinica_id))
     OR NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN 'enlace_invalido';
  END IF;
  -- M4 · Tope propio: 3 códigos por correo en 60 minutos, en TODA la tabla (los mismos números que
  -- LIMITES.codigo.correo de la app). El candado consultivo serializa las peticiones del MISMO correo:
  -- dos a la vez no pasan las dos. Dura lo que esta llamada.
  PERFORM pg_advisory_xact_lock(1793, hashtext(p_correo_hmac));
  IF (SELECT count(*) FROM public.reserva_verificaciones r
       WHERE r.correo_hmac = p_correo_hmac AND r.created_at > clock_timestamp() - interval '60 minutes') >= 3 THEN
    RETURN 'limite';
  END IF;
  UPDATE public.reserva_verificaciones SET intentos = 5
   WHERE clinica_id = p_clinica_id AND enlace_id = p_enlace_id AND correo_hmac = p_correo_hmac
     AND verificado_en IS NULL AND intentos < 5;
  -- clock_timestamp(): dos códigos pedidos en la misma transacción no empatan
  -- en created_at, que es por donde verificar elige el último.
  INSERT INTO public.reserva_verificaciones (clinica_id, enlace_id, correo_hmac, codigo_hmac, caduca_en, created_at)
  VALUES (p_clinica_id, p_enlace_id, p_correo_hmac, p_codigo_hmac, now() + interval '10 minutes', clock_timestamp());
  RETURN 'ok';
END
$fn$;

-- ---------------------------------------------------------------------
-- 3 · Los índices (lo único que toma candado de tabla), al final.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  CREATE INDEX reserva_verificaciones_created_at_idx ON public.reserva_verificaciones (created_at);
  CREATE INDEX reserva_verificaciones_correo_idx ON public.reserva_verificaciones (correo_hmac, created_at);
  CREATE INDEX ip_rate_limits_created_at_idx ON public.ip_rate_limits (created_at);
END $$;

-- ---------------------------------------------------------------------
-- 4 · Post-vuelo.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = 'public.reserva_purgar(integer)'::regprocedure
                    AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""']
                    AND pg_get_userbyid(p.proowner) IN ('postgres', 'supabase_admin')
                    AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0))
     OR has_function_privilege('anon', 'public.reserva_purgar(integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.reserva_purgar(integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.reserva_purgar(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: reserva_purgar no quedó DEFINER de postgres, con search_path vacío y sólo para service_role.';
  END IF;
  IF (SELECT prosecdef OR proconfig IS DISTINCT FROM ARRAY['search_path=""'] FROM pg_proc
       WHERE oid = 'public.reserva_codigo_emitir(uuid, uuid, text, text)'::regprocedure)
     OR has_function_privilege('anon', 'public.reserva_codigo_emitir(uuid, uuid, text, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.reserva_codigo_emitir(uuid, uuid, text, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.reserva_codigo_emitir(uuid, uuid, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: reserva_codigo_emitir cambió de SECURITY, de search_path o de privilegios.';
  END IF;
  -- Nadie de la app ganó DELETE sobre reserva_verificaciones (la purga borra como su dueño).
  IF has_table_privilege('anon', 'public.reserva_verificaciones', 'DELETE')
     OR has_table_privilege('authenticated', 'public.reserva_verificaciones', 'DELETE')
     OR has_table_privilege('service_role', 'public.reserva_verificaciones', 'DELETE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: algún rol de la app tiene DELETE sobre reserva_verificaciones.';
  END IF;
  IF (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
       WHERE c.relname IN ('reserva_verificaciones_created_at_idx', 'reserva_verificaciones_correo_idx', 'ip_rate_limits_created_at_idx')
         AND i.indisvalid) <> 3 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: no quedaron los tres índices, válidos.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'reserva_purgar: DEFINER, search_path vacío; quién la ejecuta (anon/authenticated/service_role)' AS comprobacion,
         (SELECT (p.prosecdef AND p.proconfig @> ARRAY['search_path=""'])::text || ' ; '
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_purgar(integer)')) AS valor,
         'true ; false/false/true' AS esperado
  UNION ALL
  SELECT 2, 'reserva_codigo_emitir: INVOKER, con el tope (ya no es el cuerpo de F3); quién la ejecuta',
         (SELECT (NOT p.prosecdef AND position('RETURN ''limite''' IN p.prosrc) > 0
                  AND md5(replace(p.prosrc, E'\r\n', E'\n')) <> '3885430cced1c390068f8c6a168d0ddb')::text || ' ; '
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_codigo_emitir(uuid, uuid, text, text)')),
         'true ; false/false/true'
  UNION ALL
  SELECT 3, 'índices nuevos, válidos',
         (SELECT count(*)::text FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
           WHERE c.relname IN ('reserva_verificaciones_created_at_idx', 'reserva_verificaciones_correo_idx', 'ip_rate_limits_created_at_idx')
             AND i.indisvalid),
         '3'
  UNION ALL
  SELECT 4, 'DELETE sobre reserva_verificaciones para anon/authenticated/service_role (la purga borra como su dueño)',
         (SELECT string_agg(has_table_privilege(r, 'public.reserva_verificaciones', 'DELETE')::text, '/')
            FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) WITH ORDINALITY AS x(r, o)),
         'false/false/false'
  UNION ALL
  SELECT 5, 'proteger_reserva_enlace_unico y su disparador, sin tocar (habilitado)',
         (SELECT count(*)::text FROM pg_trigger g WHERE g.tgrelid = to_regclass('public.reserva_enlaces') AND NOT g.tgisinternal
             AND g.tgenabled = 'O' AND g.tgfoid = to_regprocedure('public.proteger_reserva_enlace_unico()')),
         '1'
  UNION ALL
  SELECT 6, 'disparador contra TRUNCATE de reserva_verificaciones (no se toca)',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = to_regclass('public.reserva_verificaciones')
             AND tgname = 'trg_reserva_verificaciones_sin_truncate' AND tgenabled = 'O'),
         '1'
  UNION ALL
  SELECT 7, 'ANTES: códigos (total / de más de 30 días) · intentos de límites (total / de más de 30 días) · correos de únicos vaciables',
         (SELECT verificaciones || ' / ' || verificaciones_viejas || ' · ' || limites || ' / ' || limites_viejos || ' · ' || correos_vaciables
            FROM pg_temp._m4_antes LIMIT 1), NULL
  UNION ALL
  SELECT 8, 'la migración NO purga nada: lo hace la primera pasada de la tarea (filas ahora: códigos / intentos)',
         (SELECT count(*)::text FROM public.reserva_verificaciones) || ' / ' || (SELECT count(*)::text FROM public.ip_rate_limits), NULL
) t
ORDER BY t.n;
