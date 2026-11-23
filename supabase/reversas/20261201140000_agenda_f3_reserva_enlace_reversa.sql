-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de 20261201140000_agenda_f3_reserva_enlace.sql (agenda v2 · F3)
-- ───────────────────────────────────────────────────────────────────────
-- Quita TODOS los objetos del bloque de la reserva por enlace, y sólo ésos,
-- en orden inverso de dependencias y sin CASCADE.
--
-- SUPONE que los bloques posteriores (F5b, F4 y F2) ya se quitaron: los
-- disparadores trg_appointments_aviso_clinica (F4, WHEN reserva_enlace_id) y
-- trg_appointments_proteger_eleccion (F5b, WHEN old.reserva_canal) dependen de
-- columnas de este bloque, y cita_asignacion_google() (F2, disparador BEFORE)
-- lee NEW.reserva_canal: sin la columna fallaría toda alta de cita. Si alguno
-- sigue ahí, el pre-vuelo aborta.
--
-- PIERDE DATOS: avisos aprobados, enlaces emitidos, verificaciones,
-- incidencias, contactos bloqueados y las columnas reserva_* de las citas
-- nacidas de un enlace (las citas se quedan). Por eso SE NIEGA, sin tocar
-- nada, si hay cualquiera de esas filas, y dice cuántas de cada.
-- Para quitar el bloque CON datos, respaldarlos antes y confirmarlo en la
-- misma sesión: «SET spinus.reversa_con_datos = 'si';» antes de correr el
-- archivo (o «SET LOCAL spinus.reversa_con_datos = 'si';» justo después de
-- su BEGIN). audit_log no se toca.
--
-- Bloqueos: ACCESS EXCLUSIVE sobre appointments (DROP COLUMN/CONSTRAINT/
-- TRIGGER) hasta el COMMIT. lock_timeout 5 s. Si falla, no deja nada.
-- También quita, si existen, reserva_enlace_regenerar_fijo y la
-- reserva_enlace_emitir de 7 argumentos, que este bloque no crea pero puede
-- haber en una base que las tenga.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_n bigint := 0;
  v_t text;
  v_hay text[];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
              AND tgname IN ('trg_appointments_aviso_clinica', 'trg_appointments_proteger_eleccion')) THEN
    RAISE EXCEPTION 'REVERSA F3: siguen los disparadores de F4/F5b que leen columnas reserva_*; quitar antes esos bloques.';
  END IF;
  IF to_regprocedure('public.cita_asignacion_google()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                 AND tgname = 'trg_appointments_asignacion_google') THEN
    RAISE EXCEPTION 'REVERSA F3: sigue F2 (cita_asignacion_google lee reserva_canal); deshacer F2 antes.';
  END IF;
  -- Lo que se perdería: todas las filas que mira se cuentan antes de decidir.
  FOREACH v_t IN ARRAY ARRAY['public.reserva_avisos', 'public.reserva_enlaces', 'public.reserva_verificaciones',
                             'public.reserva_incidencias', 'public.reserva_contactos'] LOOP
    IF to_regclass(v_t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %s', v_t) INTO v_n;
      IF v_n > 0 THEN
        v_hay := v_hay || (v_t || ': ' || v_n);
      END IF;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
       AND attname IN ('reserva_canal', 'reserva_enlace_id', 'reserva_reagendados') AND NOT attisdropped) = 3 THEN
    EXECUTE 'SELECT count(*) FROM public.appointments
              WHERE reserva_canal IS NOT NULL OR reserva_enlace_id IS NOT NULL OR reserva_reagendados <> 0' INTO v_n;
    IF v_n > 0 THEN
      v_hay := v_hay || ('public.appointments con reserva_*: ' || v_n);
    END IF;
  END IF;
  IF v_hay IS NOT NULL THEN
    IF current_setting('spinus.reversa_con_datos', true) IS DISTINCT FROM 'si' THEN
      RAISE EXCEPTION 'REVERSA F3 ABORTADA: se perderían datos (%). No se tocó nada. Respáldalos y confírmalo con spinus.reversa_con_datos = ''si'' (ver la cabecera).',
        array_to_string(v_hay, '; ');
    END IF;
    RAISE NOTICE 'Confirmado spinus.reversa_con_datos = si: se pierden %.', array_to_string(v_hay, '; ');
  END IF;
END $$;

-- 1 · El disparador del bloque en appointments.
DROP TRIGGER IF EXISTS trg_appointments_reserva_incidencia ON public.appointments;

-- 2 · Tablas que cuelgan de reserva_enlaces o de appointments (con ellas se
--     van sus índices, restricciones, policies y disparadores).
DROP TABLE IF EXISTS public.reserva_contactos;
DROP TABLE IF EXISTS public.reserva_incidencias;
DROP TABLE IF EXISTS public.reserva_verificaciones;

-- 3 · appointments: índices, restricciones y columnas reserva_*.
DROP INDEX IF EXISTS public.idx_appointments_reserva_correo;
DROP INDEX IF EXISTS public.idx_appointments_reserva_tel;
DROP INDEX IF EXISTS public.idx_appointments_reserva_enlace;
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_reserva_reagendados_check,
  DROP CONSTRAINT IF EXISTS appointments_reserva_check,
  DROP CONSTRAINT IF EXISTS appointments_reserva_aviso_fkey,
  DROP CONSTRAINT IF EXISTS appointments_reserva_enlace_fkey;
ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS reserva_reagendados,
  DROP COLUMN IF EXISTS reserva_historial_previo,
  DROP COLUMN IF EXISTS reserva_aceptado_en,
  DROP COLUMN IF EXISTS reserva_aviso_version,
  DROP COLUMN IF EXISTS reserva_correo_hmac,
  DROP COLUMN IF EXISTS reserva_tel_hmac,
  DROP COLUMN IF EXISTS reserva_correo,
  DROP COLUMN IF EXISTS reserva_telefono,
  DROP COLUMN IF EXISTS reserva_nombre,
  DROP COLUMN IF EXISTS reserva_canal,
  DROP COLUMN IF EXISTS reserva_enlace_id;

-- 4 · Las dos tablas base.
DROP TABLE IF EXISTS public.reserva_enlaces;
DROP TABLE IF EXISTS public.reserva_avisos;

-- 5 · Funciones (sus disparadores ya no existen).
DROP FUNCTION IF EXISTS public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.rate_limit_espera(text, integer, integer);
DROP FUNCTION IF EXISTS public.reserva_espera_reenvio(uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.reserva_codigo_verificar(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.reserva_codigo_emitir(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.reserva_contexto(text, text, text);
DROP FUNCTION IF EXISTS public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.reserva_enlace_emitir(uuid, uuid, uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.reserva_enlace_regenerar_fijo(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.reserva_contactos_bloqueados();
DROP FUNCTION IF EXISTS public.reserva_contacto_marcar(uuid, text);
DROP FUNCTION IF EXISTS public.reserva_contacto_estado(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.reserva_registrar_incidencia();
DROP FUNCTION IF EXISTS public.proteger_reserva_contactos();
DROP FUNCTION IF EXISTS public.proteger_reserva_enlace_unico();
DROP FUNCTION IF EXISTS public.proteger_reserva_enlaces();

-- 6 · Post-vuelo: no queda nada del bloque.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace
              AND relname IN ('reserva_avisos', 'reserva_enlaces', 'reserva_verificaciones', 'reserva_incidencias', 'reserva_contactos'))
     OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
                 AND attname LIKE 'reserva\_%' AND NOT attisdropped)
     OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
                 AND proname IN ('proteger_reserva_contactos', 'proteger_reserva_enlace_unico', 'proteger_reserva_enlaces',
                                 'rate_limit_espera', 'reserva_codigo_emitir', 'reserva_codigo_verificar', 'reserva_contacto_estado',
                                 'reserva_contacto_marcar', 'reserva_contactos_bloqueados', 'reserva_contexto', 'reserva_enlace_emitir',
                                 'reserva_enlace_regenerar_fijo', 'reserva_espera_reenvio', 'reserva_ocupacion',
                                 'reserva_registrar_incidencia', 'reservar_por_enlace')) THEN
    RAISE EXCEPTION 'REVERSA F3: queda algún objeto del bloque.';
  END IF;
END $$;

COMMIT;

SELECT 'reversa F3' AS comprobacion,
       (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname IN
          ('reserva_avisos', 'reserva_enlaces', 'reserva_verificaciones', 'reserva_incidencias', 'reserva_contactos'))::text
       || ' tablas / '
       || (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
            AND attname LIKE 'reserva\_%' AND NOT attisdropped)::text || ' columnas' AS valor,
       '0 tablas / 0 columnas' AS esperado;
