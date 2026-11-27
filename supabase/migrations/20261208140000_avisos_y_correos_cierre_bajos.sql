-- ════════════════════════════════════════════════════════════════════════
-- Agenda · BASE-2 · B3 — hallazgos BAJOS pendientes de las auditorías de MA
-- (avisos: «Marcar todos») y de R1 (el convenio «van juntas» en los comentarios)
-- Rama: feature/agenda-para-todos · Escrita: 2026-11-27
-- Guion: docs/spec/base-2/ENSAYO.md
-- ────────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-27, stack local de Supabase (CLI 2.117.0): aplicada,
--   deshecha con su reversa y vuelta a aplicar; pruebas b3_avisos_bajos.sql y
--   av5_avisos_cierre_auditoria.sql en verde; scripts/avisos-carrera.sh (dos
--   sesiones) en verde, con el paso 4 nuevo.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DE ENSAYO SOBRE EL CLON
--   DE ESTRUCTURA Y DE AUDITORÍA INDEPENDIENTE (supabase/AUDITORIA-MIGRACIONES.md).
--
-- QUÉ HACE (cuatro cosas pequeñas, ninguna toca filas):
--   MA 1 · public.avisos_transaccion_mas_antigua() leía pg_stat_activity, que
--     Postgres CONGELA en la primera lectura de cada transacción. Una segunda
--     lectura en la MISMA transacción (dos «Marcar todos», o cualquier lectura
--     previa de pg_stat_*) veía la foto vieja y no la transacción que se abrió
--     después: la marca de agua podía adelantarla. COMPROBADO con dos sesiones
--     (2026-11-27): segunda lectura NULL con otra transacción abierta; tras
--     pg_stat_clear_snapshot(), la ve. Ahora la función tira la foto antes de
--     leer. (Por PostgREST cada llamada es su propia transacción, así que en la
--     app la primera lectura ya era fresca: el alcance real era pequeño.)
--   MA 2 · cualquier sesión (authenticated) podía llamarla y saber cuándo empezó
--     la transacción abierta más antigua de TODA la base. Sólo la necesita el
--     disparador de la marca. Ahora NADIE la ejecuta salvo su dueño: se le quita
--     el EXECUTE a authenticated y el disparador aviso_visto_hasta_sellar() pasa
--     a SECURITY DEFINER (con ALTER FUNCTION: su cuerpo NO cambia, ni su huella).
--     Ese disparador sólo lee NEW/OLD y el reloj, ya tenía search_path vacío y,
--     como función de disparador, no se puede llamar a mano.
--   MA 3 · SE DOCUMENTA, NO SE ARREGLA: una transacción abierta mucho rato en la
--     base (un volcado, una sesión olvidada «idle in transaction») retiene la
--     marca de agua de «Marcar todos» antes de su inicio mientras dure. No hay
--     arreglo razonable: no se puede saber qué transacción escribirá un aviso, y
--     acotarlo (por edad, por tener xid) reabre el defecto que MA cerró. El
--     efecto está acotado: avisos_revisar_todos marca UNO A UNO lo que quien
--     pulsa veía (hasta 1 000 avisos por pulsación), así que su lista se vacía
--     igual; sólo deja de avanzar la marca. Queda escrito en el comentario.
--   R1 · COMMENT ON FUNCTION de cita_correo_tomar y cita_recordatorios_pendientes
--     con el convenio «van juntas»: el destinatario Y la condición de R1 (el
--     comprobante sólo quita el recordatorio si salió ya dentro de la ventana)
--     están en las dos. Sólo comentarios: los cuerpos no cambian.
--
-- Depende de: MA (20261203130000) y R1 (20261207120000). Exige el cuerpo de MA
--   de las dos funciones de avisos (huella md5 de prosrc) y que las dos de
--   correos sean las de R1; si alguien las cambió, aborta sin tocar nada.
-- Bloqueos: sólo catálogo.
-- Ventana de despliegue: no depende del código; puede ir antes o después.
-- Riesgo: BAJO. «Marcar todos» sigue haciendo lo mismo.
-- ⚠️ Deshacer MA (su reversa) deshace también MA 1 y MA 2: su CREATE OR REPLACE
--   devuelve el disparador a INVOKER y borra la función. No hace falta correr
--   antes la reversa de B3.
-- No re-ejecutable: una segunda pasada ABORTA en el pre-vuelo sin cambiar nada.
-- Vuelta atrás: supabase/reversas/20261208140000_avisos_y_correos_cierre_bajos_reversa.sql
-- Prueba: supabase/pruebas-sql/b3_avisos_bajos.sql y scripts/avisos-carrera.sh
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay que aplicarla como postgres (current_user es %).', current_user;
  END IF;
  IF to_regprocedure('public.avisos_transaccion_mas_antigua()') IS NULL OR to_regprocedure('public.aviso_visto_hasta_sellar()') IS NULL
     OR to_regclass('public.avisos_vistos_hasta') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan los objetos de MA (20261203130000).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.avisos_transaccion_mas_antigua()')
                AND position('pg_stat_clear_snapshot' IN p.prosrc) > 0) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: esta migración ya está aplicada. No se repite.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.avisos_transaccion_mas_antigua()')
                    AND p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                    AND md5(replace(p.prosrc, E'\r\n', E'\n')) = '10bb6aac66d280186c632a078f607db7') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.avisos_transaccion_mas_antigua no es la de MA (DEFINER, search_path vacío y su cuerpo): alguien la cambió. No se reescribe a ciegas.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.aviso_visto_hasta_sellar()')
                    AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                    AND md5(replace(p.prosrc, E'\r\n', E'\n')) = '36e828415cdf9e7e5a7f93da8b014712') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.aviso_visto_hasta_sellar no es la de MA (INVOKER, search_path vacío y su cuerpo): alguien la cambió. No se toca a ciegas.';
  END IF;
  -- El disparador de la marca es el único que usa esa función, y está encendido.
  IF (SELECT count(*) FROM pg_trigger t WHERE t.tgfoid = 'public.aviso_visto_hasta_sellar()'::regprocedure AND NOT t.tgisinternal) <> 1
     OR NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgfoid = 'public.aviso_visto_hasta_sellar()'::regprocedure
                      AND t.tgrelid = 'public.avisos_vistos_hasta'::regclass AND t.tgenabled = 'O') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: aviso_visto_hasta_sellar() no es el disparador (único y encendido) de avisos_vistos_hasta.';
  END IF;
  -- Nadie más llama a la función de la transacción más antigua: sólo ese disparador.
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
                AND position('avisos_transaccion_mas_antigua' IN p.prosrc) > 0
                AND p.oid NOT IN ('public.aviso_visto_hasta_sellar()'::regprocedure, 'public.avisos_transaccion_mas_antigua()'::regprocedure)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: otra función de public llama a avisos_transaccion_mas_antigua(); quitarle el EXECUTE a authenticated la rompería.';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT proowner FROM pg_proc WHERE oid = 'public.aviso_visto_hasta_sellar()'::regprocedure), 'USAGE')
     OR NOT pg_has_role(current_user, (SELECT proowner FROM pg_proc WHERE oid = 'public.avisos_transaccion_mas_antigua()'::regprocedure), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de las funciones de avisos.', current_user;
  END IF;
  -- Las dos de correos, las de R1 (sólo se les pone comentario).
  IF (SELECT count(*) FROM pg_proc p
       WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'), to_regprocedure('public.cita_recordatorios_pendientes(integer)'))
         AND position('R1 · Sólo si ese comprobante salió' IN p.prosrc) > 0) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_correo_tomar o cita_recordatorios_pendientes no son las de R1 (20261207120000).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1 · MA 1 · la lectura de pg_stat_activity, siempre fresca.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.avisos_transaccion_mas_antigua()
 RETURNS timestamptz
 LANGUAGE plpgsql
 VOLATILE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- BASE-2 (B3) · Postgres congela pg_stat_activity en la primera lectura de la transacción: sin tirar esa
  -- foto, una segunda llamada en la misma transacción no vería una transacción abierta después.
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  RETURN (
    SELECT min(s.xact_start)
      FROM pg_catalog.pg_stat_activity s
     WHERE s.datname = pg_catalog.current_database()
       AND s.pid <> pg_catalog.pg_backend_pid()
       AND s.xact_start IS NOT NULL
       AND s.backend_type NOT LIKE 'autovacuum%' AND s.backend_type <> 'walsender');
END
$function$;

-- ---------------------------------------------------------------------
-- 2 · MA 2 · nadie la llama a mano: sólo el disparador de la marca, como dueño.
-- ---------------------------------------------------------------------
ALTER FUNCTION public.aviso_visto_hasta_sellar() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.avisos_transaccion_mas_antigua() FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3 · Los comentarios (MA 3 y el convenio de R1).
-- ---------------------------------------------------------------------
COMMENT ON FUNCTION public.avisos_transaccion_mas_antigua() IS
  'Avisos globales (MA; BASE-2 B3): el inicio de la transacción abierta más antigua de esta base (sin la propia, autovacuum ni replicación), o NULL. Tira antes la foto de estadísticas de la transacción (pg_stat_clear_snapshot) para leer siempre fresco. SÓLO la llama el disparador aviso_visto_hasta_sellar (SECURITY DEFINER), para que «Marcar todos» no adelante a un aviso cuya transacción aún no confirmó; ningún rol de la app la ejecuta. LÍMITE CONOCIDO, sin arreglo razonable: una transacción abierta mucho rato en la base (un volcado, una sesión olvidada en transacción) retiene la marca antes de su inicio mientras dure; avisos_revisar_todos lo compensa marcando uno a uno lo que quien pulsa veía (hasta 1000 por pulsación). No la acotes por edad ni por xid: reabre el defecto.';
COMMENT ON FUNCTION public.aviso_visto_hasta_sellar() IS
  'Avisos globales (M1, MA; BASE-2 B3): disparador de avisos_vistos_hasta: la marca de agua nunca en el futuro, nunca hacia atrás y nunca por delante de una transacción abierta. SECURITY DEFINER sólo para poder llamar a avisos_transaccion_mas_antigua(), que ningún rol de la app ejecuta; no lee nada de la sesión (sólo NEW, OLD y el reloj). No le añadas lecturas ni escrituras de tablas: correrían como su dueño.';
COMMENT ON FUNCTION public.cita_correo_tomar(uuid, uuid, text, uuid) IS
  'Agenda (F4; R1 20261207120000): toma el envío de UN correo de una cita (comprobante, recordatorio o confirmacion) con el candado 1792 y devuelve el destinatario, que decide la base. INVOKER, sólo service_role. CONVENIO «VAN JUNTAS» con cita_recordatorios_pendientes: (1) la expresión del destinatario y (2) la condición de R1: el comprobante de la reserva sólo quita el recordatorio si salió ya dentro de la ventana del recordatorio de esa cita, coalesce(enviado_en, tomado_en) >= inicio − recordatorio_horas. Si cambias una de las dos funciones, cambia la otra.';
COMMENT ON FUNCTION public.cita_recordatorios_pendientes(integer) IS
  'Listado ENTRE CLÍNICAS de recordatorios por mandar (sólo ids), para /api/cron/recordatorios. Sólo clínicas con la agenda v2 encendida, la puerta S3 (gcal_sync_clinica_habilitada) y el interruptor agenda_ajustes.recordatorio_encendido. CONVENIO «VAN JUNTAS» con cita_correo_tomar: (1) la expresión del destinatario y (2) la condición de R1 (20261207120000): el comprobante de la reserva sólo quita el recordatorio si salió ya dentro de la ventana del recordatorio de esa cita, coalesce(enviado_en, tomado_en) >= inicio − recordatorio_horas. Si cambias una de las dos funciones, cambia la otra.';

DO $$
DECLARE
  v_f regprocedure := 'public.avisos_transaccion_mas_antigua()'::regprocedure;
BEGIN
  IF has_function_privilege('anon', v_f, 'EXECUTE') OR has_function_privilege('authenticated', v_f, 'EXECUTE')
     OR has_function_privilege('service_role', v_f, 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                 WHERE p.oid = v_f AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: algún rol de la app (o PUBLIC) sigue pudiendo ejecutar avisos_transaccion_mas_antigua().';
  END IF;
  IF NOT (SELECT p.prosecdef AND p.proconfig = ARRAY['search_path=""'] AND position('pg_stat_clear_snapshot' IN p.prosrc) > 0
            FROM pg_proc p WHERE p.oid = v_f) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: avisos_transaccion_mas_antigua() no quedó DEFINER, con search_path vacío y tirando la foto.';
  END IF;
  IF NOT (SELECT p.prosecdef AND p.proconfig = ARRAY['search_path=""'] AND md5(replace(p.prosrc, E'\r\n', E'\n')) = '36e828415cdf9e7e5a7f93da8b014712'
            FROM pg_proc p WHERE p.oid = 'public.aviso_visto_hasta_sellar()'::regprocedure) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: aviso_visto_hasta_sellar() no quedó DEFINER con search_path vacío y el cuerpo de MA.';
  END IF;
  -- Sigue funcionando: como dueño devuelve un instante pasado o NULL, nunca un error.
  IF public.avisos_transaccion_mas_antigua() > clock_timestamp() THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: avisos_transaccion_mas_antigua() devolvió un instante futuro.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS resultado
FROM (
  SELECT 1 AS n, 'avisos_transaccion_mas_antigua: DEFINER, search_path vacío, tira la foto; anon/authenticated/service_role' AS comprobacion,
         (SELECT (p.prosecdef AND p.proconfig = ARRAY['search_path=""'] AND position('pg_stat_clear_snapshot' IN p.prosrc) > 0)::text || ' ; '
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.avisos_transaccion_mas_antigua()')) AS valor,
         'true ; false/false/false' AS esperado
  UNION ALL
  SELECT 2, 'aviso_visto_hasta_sellar: DEFINER, search_path vacío, con el cuerpo de MA (md5)',
         (SELECT (p.prosecdef AND p.proconfig = ARRAY['search_path=""'])::text || ' ; ' || md5(replace(p.prosrc, E'\r\n', E'\n'))
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.aviso_visto_hasta_sellar()')),
         'true ; 36e828415cdf9e7e5a7f93da8b014712'
  UNION ALL
  SELECT 3, 'dueño de las dos de avisos',
         (SELECT string_agg(DISTINCT pg_get_userbyid(p.proowner), ',') FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.avisos_transaccion_mas_antigua()'), to_regprocedure('public.aviso_visto_hasta_sellar()'))),
         'postgres'
  UNION ALL
  SELECT 4, 'las dos de correos llevan el convenio «VAN JUNTAS» en su comentario y conservan el cuerpo de R1',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'), to_regprocedure('public.cita_recordatorios_pendientes(integer)'))
             AND position('VAN JUNTAS' IN obj_description(p.oid, 'pg_proc')) > 0
             AND position('R1 · Sólo si ese comprobante salió' IN p.prosrc) > 0),
         '2'
  UNION ALL
  SELECT 5, 'transacciones abiertas ahora mismo en esta base, sin contar ésta (las que retienen la marca; lo normal es 0)',
         (SELECT count(*)::text FROM pg_catalog.pg_stat_activity s
           WHERE s.datname = current_database() AND s.pid <> pg_backend_pid() AND s.xact_start IS NOT NULL
             AND s.backend_type NOT LIKE 'autovacuum%' AND s.backend_type <> 'walsender'), NULL
) t
ORDER BY t.n;
