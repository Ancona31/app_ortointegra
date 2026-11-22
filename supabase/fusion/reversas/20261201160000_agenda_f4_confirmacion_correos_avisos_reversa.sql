-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de F4 (20261201160000_agenda_f4_confirmacion_correos_avisos.sql)
-- ═══════════════════════════════════════════════════════════════════════
-- Quita TODOS los objetos de F4 y sólo ésos: los 3 disparadores que F4 cuelga
-- de tablas ajenas, sus 4 tablas (con sus índices, policies, disparadores y
-- comentarios) y sus funciones, también cita_correos_pendientes si existe (la
-- dejaban las migraciones originales; el archivo fundido ya no la crea).
-- Supone que F5b ya se deshizo (la reversa del conjunto va en orden inverso
-- de bloques); ningún objeto de F1, F2, F3 ni F5 depende de los de F4 en el
-- catálogo, así que no hay que tocar nada ajeno.
-- NO DESTRUYE DATOS: aborta si cualquiera de las 4 tablas tiene filas. Antes,
-- respaldar y vaciar a mano, p. ej.:
--   CREATE TABLE respaldos.cita_confirmaciones_AAAAMMDD AS SELECT * FROM public.cita_confirmaciones;
--   (ídem cita_reagendos, cita_correos, avisos_clinica). Lo que ya escribió la
--   auditoría (audit_log) se queda: audit_log no se toca.
-- Como postgres, de una vez. Re-ejecutable (IF EXISTS): una segunda pasada no
-- hace nada. Bloqueos: SHARE ROW EXCLUSIVE / ACCESS EXCLUSIVE un instante
-- sobre appointments, reserva_empalmes_google y gcal_movimientos_rechazados
-- (DROP TRIGGER) y sobre las tablas que se borran.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
DECLARE
  v_t text;
  v_n bigint;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: aplicar como postgres (es %).', current_user;
  END IF;
  FOREACH v_t IN ARRAY ARRAY['avisos_clinica', 'cita_correos', 'cita_reagendos', 'cita_confirmaciones'] LOOP
    IF to_regclass('public.' || v_t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', v_t) INTO v_n;
      IF v_n > 0 THEN
        RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.% tiene % filas. Respaldar y vaciar antes (ver cabecera); la reversa no borra datos.', v_t, v_n;
      END IF;
    END IF;
  END LOOP;
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
