-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de F4 (20261201160000_agenda_f4_confirmacion_correos_avisos.sql)
-- ═══════════════════════════════════════════════════════════════════════
-- QUÉ HACE: quita TODOS los objetos de F4 y sólo ésos: los 3 disparadores que
--   F4 cuelga de tablas ajenas, sus 4 tablas (con sus índices, FK, policies,
--   disparadores y comentarios) y sus funciones; también
--   cita_correos_pendientes si existiera (no la crea F4, pero el post-vuelo
--   de F4 exige que no esté).
-- DE QUÉ DEPENDE: rol postgres. Va después de la reversa de F5b (orden inverso
--   de bloques); ningún objeto de F1, F2, F3 ni F5 depende de los de F4 en el
--   catálogo.
-- QUÉ SE PIERDE MIENTRAS TANTO: la confirmación por enlace, el reagendar por
--   el paciente y por la clínica, los correos de cita y los avisos de la
--   clínica. Con la v2 encendida y la app nueva desplegada esas rutas fallan:
--   apaga antes la v2.
-- DATOS: si alguna de las 4 tablas tiene filas (enlaces de confirmación y sus
--   respuestas, reagendados, registro de correos, avisos), la reversa SE NIEGA
--   sin tocar nada. Lo que ya escribió la auditoría (audit_log) se queda en
--   cualquier caso. Para seguir de todos modos (tras respaldar, p. ej.
--     CREATE TABLE respaldos.cita_confirmaciones_AAAAMMDD AS SELECT * FROM public.cita_confirmaciones;
--   e ídem las otras tres), confírmalo en la MISMA transacción:
--       BEGIN;
--       SET LOCAL spinus.reversa_con_datos = 'si';
--       \i supabase/reversas/20261201160000_agenda_f4_confirmacion_correos_avisos_reversa.sql
--   (el BEGIN de este archivo avisa «ya hay una transacción en curso» y sigue
--   en la tuya; su COMMIT la cierra).
-- RIESGO / BLOQUEOS: SHARE ROW EXCLUSIVE sobre appointments, clinicas,
--   profiles, reserva_empalmes_google y gcal_movimientos_rechazados (DROP
--   TRIGGER y las FK que se van con las tablas) hasta el COMMIT; lock_timeout
--   5 s (si no los obtiene, aborta sin cambiar nada). Una sola transacción.
-- SEGUNDA PASADA: no hace nada y sale bien (IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
DECLARE
  v_t     text;
  v_n     bigint;
  v_filas text;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: hay que correrla como el rol postgres (current_user es %).', current_user;
  END IF;
  FOREACH v_t IN ARRAY ARRAY['avisos_clinica', 'cita_correos', 'cita_reagendos', 'cita_confirmaciones'] LOOP
    IF to_regclass('public.' || v_t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', v_t) INTO v_n;
      IF v_n > 0 THEN
        v_filas := concat_ws(', ', v_filas, v_t || ' ' || v_n);
      END IF;
    END IF;
  END LOOP;
  IF v_filas IS NOT NULL THEN
    IF coalesce(current_setting('spinus.reversa_con_datos', true), '') <> 'si' THEN
      RAISE EXCEPTION 'REVERSA ABORTADA: hay datos de la v2 que se perderían (%). Respáldalos y, si aun así quieres seguir, repite con SET LOCAL spinus.reversa_con_datos = ''si'' en la misma transacción (ver la cabecera).', v_filas;
    END IF;
    RAISE WARNING 'REVERSA CON DATOS (spinus.reversa_con_datos = si): se borran las filas de %.', v_filas;
  END IF;
END
$pre$;

-- Disparadores de F4 sobre tablas de otros bloques.
DROP TRIGGER IF EXISTS trg_appointments_aviso_clinica ON public.appointments;
DROP TRIGGER IF EXISTS trg_reserva_empalmes_aviso_clinica ON public.reserva_empalmes_google;
DROP TRIGGER IF EXISTS trg_gcal_movimientos_aviso_clinica ON public.gcal_movimientos_rechazados;

-- Tablas: sus índices, policies y disparadores se van con ellas (sin CASCADE:
-- si algo ajeno dependiera de ellas, el DROP falla y nada se deshace).
-- cita_reagendos antes que cita_confirmaciones (FK).
DROP TABLE IF EXISTS public.avisos_clinica;
DROP TABLE IF EXISTS public.cita_correos;
DROP TABLE IF EXISTS public.cita_reagendos;
DROP TABLE IF EXISTS public.cita_confirmaciones;

-- Funciones.
DROP FUNCTION IF EXISTS public.aviso_clinica_de_movimiento_google();
DROP FUNCTION IF EXISTS public.aviso_clinica_de_empalme();
DROP FUNCTION IF EXISTS public.aviso_clinica_de_reagendo();
DROP FUNCTION IF EXISTS public.aviso_clinica_de_confirmacion();
DROP FUNCTION IF EXISTS public.aviso_clinica_de_respuesta();
DROP FUNCTION IF EXISTS public.aviso_clinica_de_cita();
DROP FUNCTION IF EXISTS public.aviso_clinica_revisar();
DROP FUNCTION IF EXISTS public.cita_nombre_saludo(uuid, uuid);
DROP FUNCTION IF EXISTS public.cita_recordatorios_pendientes(integer);
DROP FUNCTION IF EXISTS public.cita_correos_pendientes(integer);
DROP FUNCTION IF EXISTS public.cita_correo_marcar(uuid, uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.cita_correo_tomar(uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.cita_reagendar_oferta(uuid, text);
DROP FUNCTION IF EXISTS public.cita_confirmacion_responder(uuid, text, text);
DROP FUNCTION IF EXISTS public.cita_confirmacion_contexto(text);
DROP FUNCTION IF EXISTS public.cita_confirmacion_revocar(uuid, uuid);
DROP FUNCTION IF EXISTS public.cita_confirmacion_emitir(uuid, uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.cita_confirmacion_coincide(uuid, text, uuid, text);

DO $post$
BEGIN
  IF to_regclass('public.cita_confirmaciones') IS NOT NULL OR to_regclass('public.cita_reagendos') IS NOT NULL
     OR to_regclass('public.cita_correos') IS NOT NULL OR to_regclass('public.avisos_clinica') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
                  AND (p.proname LIKE 'aviso\_clinica\_%' OR p.proname LIKE 'cita\_confirmacion\_%' OR p.proname LIKE 'cita\_correo%'
                       OR p.proname IN ('cita_nombre_saludo', 'cita_reagendar_clinica', 'cita_reagendar_oferta',
                                        'cita_recordatorios_pendientes', 'reagendar_por_enlace')))
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
                  AND tgname IN ('trg_appointments_aviso_clinica', 'trg_reserva_empalmes_aviso_clinica',
                                 'trg_gcal_movimientos_aviso_clinica')) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: queda algún objeto de F4 (otra firma de una función, quizá): revisar.';
  END IF;
END
$post$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'objetos de F4 que quedan (tablas + funciones + disparadores ajenos)' AS comprobacion,
         ((SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
             AND relname IN ('avisos_clinica', 'cita_confirmaciones', 'cita_correos', 'cita_reagendos'))
          + (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
               AND (p.proname LIKE 'aviso\_clinica\_%' OR p.proname LIKE 'cita\_confirmacion\_%' OR p.proname LIKE 'cita\_correo%'
                    OR p.proname IN ('cita_nombre_saludo', 'cita_reagendar_clinica', 'cita_reagendar_oferta',
                                     'cita_recordatorios_pendientes', 'reagendar_por_enlace')))
          + (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal
               AND tgname IN ('trg_appointments_aviso_clinica', 'trg_reserva_empalmes_aviso_clinica',
                              'trg_gcal_movimientos_aviso_clinica')))::text AS valor,
         '0' AS esperado
) t;
