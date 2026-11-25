-- ═══════════════════════════════════════════════════════════════════════
-- Reversa de F2 (20261201150000_agenda_f2_google.sql): quita TODOS los objetos
-- del bloque Google, y sólo ésos.
-- ───────────────────────────────────────────────────────────────────────
-- ORDEN DEL CONJUNTO: se corre DESPUÉS de deshacer F5b y F4, y ANTES de la
-- reversa de F3 (orden inverso de bloques: F5b, F4, F2, F3, F5a, F1). En
-- particular, F4 tiene que haber quitado:
--   · trg_appointments_aviso_clinica (su WHEN lee appointments.google_asignacion);
--   · trg_reserva_empalmes_aviso_clinica y trg_gcal_movimientos_aviso_clinica
--     (cuelgan de tablas de aquí; caerían solos con la tabla, pero su función
--     quedaría huérfana).
-- El pre-vuelo aborta si alguno de esos disparadores sigue ahí.
-- ⚠️ Lo que NO puede comprobar: F4 nombra gcal_sync_clinica_habilitada en una
-- función SQL y F3 la llama desde plpgsql, sin dependencia registrada en
-- pg_depend. Correr esta reversa con F4 todavía puesto lo deja roto sin error
-- hasta su primera llamada. F3 SÍ sigue puesto a propósito (va antes en el
-- conjunto): entre este COMMIT y el de su reversa, la reserva por enlace
-- falla (42883); su reversa va inmediatamente después y aborta si hay enlaces.
--
-- QUÉ SE PIERDE: los tokens y candados de sincronización (la siguiente pasada
-- hace una completa), los pares de empalme ya avisados, los intentos
-- rechazados y la marca «por asignar»/«evento» de las citas importadas de
-- Google (las citas se quedan). Por eso SE NIEGA, sin tocar nada, si hay
-- cualquiera de esas filas, y dice cuántas de cada. Para quitar el bloque CON
-- datos, respaldarlos antes y confirmarlo en la misma sesión:
-- «SET spinus.reversa_con_datos = 'si';» antes de correr el archivo (o
-- «SET LOCAL spinus.reversa_con_datos = 'si';» justo después de su BEGIN).
-- La auditoría en audit_log se queda. Sin CASCADE. Re-ejecutable (IF EXISTS).
-- GUARDA DE DATOS, SIN CORRER LA REVERSA (auditoría ronda 1, A5): consulta de
--   SÓLO LECTURA con la misma condición que la negativa de abajo, para
--   comprobar TODA la cadena de reversas antes de deshacer la primera. Con la
--   migración aplicada; 0 filas = esta reversa no se negará por datos.
--     SELECT 'F2: ' || t AS motivo, n FROM (
--       SELECT 'gcal_sync_estado' AS t, count(*) AS n FROM public.gcal_sync_estado
--       UNION ALL SELECT 'reserva_empalmes_google', count(*) FROM public.reserva_empalmes_google
--       UNION ALL SELECT 'gcal_movimientos_rechazados', count(*) FROM public.gcal_movimientos_rechazados
--       UNION ALL SELECT 'appointments con google_asignacion', count(*) FROM public.appointments
--                  WHERE google_asignacion IS NOT NULL) x
--      WHERE n > 0;
-- Bloqueos: ACCESS EXCLUSIVE sobre appointments (disparador, CHECK y columna) y
-- SHARE ROW EXCLUSIVE sobre clinicas (las FK) hasta el COMMIT. Si falla, no
-- deja nada.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_n   bigint;
  v_t   text;
  v_hay text[];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
               AND (tgname IN ('trg_appointments_aviso_clinica', 'trg_reserva_empalmes_aviso_clinica',
                               'trg_gcal_movimientos_aviso_clinica')
                    OR tgrelid IN (coalesce(to_regclass('public.reserva_empalmes_google'), 0),
                                   coalesce(to_regclass('public.gcal_movimientos_rechazados'), 0),
                                   coalesce(to_regclass('public.gcal_sync_estado'), 0)))) THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: quedan disparadores de F4 sobre objetos de F2; deshacer F4 antes.';
  END IF;
  -- Lo que se perdería: todas las filas que mira se cuentan antes de decidir.
  FOREACH v_t IN ARRAY ARRAY['public.gcal_sync_estado', 'public.reserva_empalmes_google',
                             'public.gcal_movimientos_rechazados'] LOOP
    IF to_regclass(v_t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %s', v_t) INTO v_n;
      IF v_n > 0 THEN
        v_hay := v_hay || (v_t || ': ' || v_n);
      END IF;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
              AND attname = 'google_asignacion' AND NOT attisdropped) THEN
    EXECUTE 'SELECT count(*) FROM public.appointments WHERE google_asignacion IS NOT NULL' INTO v_n;
    IF v_n > 0 THEN
      v_hay := v_hay || ('public.appointments con google_asignacion: ' || v_n);
    END IF;
  END IF;
  IF v_hay IS NOT NULL THEN
    IF current_setting('spinus.reversa_con_datos', true) IS DISTINCT FROM 'si' THEN
      RAISE EXCEPTION 'REVERSA F2 ABORTADA: se perderían datos (%). No se tocó nada. Respáldalos y confírmalo con spinus.reversa_con_datos = ''si'' (ver la cabecera).',
        array_to_string(v_hay, '; ');
    END IF;
    RAISE NOTICE 'Confirmado spinus.reversa_con_datos = si: se pierden %.', array_to_string(v_hay, '; ');
  END IF;
END $$;

-- «Por asignar»
DROP TRIGGER IF EXISTS trg_appointments_asignacion_google ON public.appointments;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_google_asignacion_check;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS google_asignacion;
DROP FUNCTION IF EXISTS public.cita_asignacion_google();

-- Funciones
DROP FUNCTION IF EXISTS public.gcal_bloqueo_aplicar(uuid, text, text, uuid, text, timestamptz, boolean, timestamptz, timestamptz, date, date);
DROP FUNCTION IF EXISTS public.cita_movimiento_google_registrar(uuid, uuid, timestamptz);
DROP FUNCTION IF EXISTS public.cita_rsvp_google(uuid, uuid, text, text, text[]);
DROP FUNCTION IF EXISTS public.reserva_empalmes_registrar(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.gcal_importar_evento(uuid, text, text, text, timestamptz, text, timestamptz, timestamptz, boolean, text, text, uuid);
DROP FUNCTION IF EXISTS public.gcal_aplicar_evento(uuid, uuid, timestamptz, text, text, timestamptz, text, boolean, timestamptz, timestamptz, boolean, text, boolean, text, boolean);
DROP FUNCTION IF EXISTS public.gcal_citas_por_evento(uuid, text[], uuid[]);
DROP FUNCTION IF EXISTS public.gcal_sync_frescura(uuid);
DROP FUNCTION IF EXISTS public.gcal_sync_clinicas_pendientes(integer);
DROP FUNCTION IF EXISTS public.gcal_sync_soltar(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.gcal_sync_reiniciar(uuid, uuid);
DROP FUNCTION IF EXISTS public.gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer);
DROP FUNCTION IF EXISTS public.gcal_sync_tomar(uuid, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.gcal_sync_clinica_habilitada(uuid);

-- Tablas (con ellas caen sus índices, restricciones, policy y comentarios)
DROP POLICY IF EXISTS reserva_empalmes_google_select ON public.reserva_empalmes_google;
DROP TABLE IF EXISTS public.gcal_movimientos_rechazados;
DROP TABLE IF EXISTS public.reserva_empalmes_google;
DROP TABLE IF EXISTS public.gcal_sync_estado;

DO $$
BEGIN
  IF to_regclass('public.gcal_sync_estado') IS NOT NULL OR to_regclass('public.reserva_empalmes_google') IS NOT NULL
     OR to_regclass('public.gcal_movimientos_rechazados') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
                  AND attname = 'google_asignacion' AND NOT attisdropped)
     OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
                  AND (proname LIKE 'gcal\_%' OR proname IN ('reserva_empalmes_registrar', 'cita_rsvp_google',
                                                             'cita_asignacion_google', 'cita_movimiento_google_registrar'))) THEN
    RAISE EXCEPTION 'REVERSA: quedó algún objeto de F2.';
  END IF;
END $$;

COMMIT;

SELECT 'F2 quitado' AS comprobacion,
       (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
          AND (proname LIKE 'gcal\_%' OR proname IN ('reserva_empalmes_registrar', 'cita_rsvp_google',
                                                     'cita_asignacion_google', 'cita_movimiento_google_registrar')))::text
       || ' funciones / '
       || (SELECT count(*) FROM pg_class WHERE oid IN (to_regclass('public.gcal_sync_estado'), to_regclass('public.reserva_empalmes_google'),
                                                       to_regclass('public.gcal_movimientos_rechazados')))::text
       || ' tablas' AS valor,
       '0 funciones / 0 tablas' AS esperado;
