-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de 20261201150000_agenda_f3_reserva_enlace.sql (agenda v2 · F3)
-- ───────────────────────────────────────────────────────────────────────
-- Quita TODOS los objetos del bloque de la reserva por enlace, y sólo ésos,
-- en orden inverso de dependencias y sin CASCADE.
--
-- SUPONE que los bloques posteriores (F4 y F5b) ya se quitaron: sus
-- disparadores trg_appointments_aviso_clinica (WHEN reserva_enlace_id) y
-- trg_appointments_proteger_eleccion (WHEN old.reserva_canal) dependen de
-- columnas de este bloque. Si siguen ahí, el pre-vuelo aborta.
--
-- PIERDE DATOS: enlaces, verificaciones, incidencias, contactos bloqueados y
-- las columnas reserva_* de las citas. Por eso aborta si hay alguna fila: se
-- respalda y se decide a mano antes. audit_log no se toca.
--
-- Bloqueos: ACCESS EXCLUSIVE sobre appointments (DROP COLUMN/CONSTRAINT/
-- TRIGGER) hasta el COMMIT. lock_timeout 5 s.
-- También quita, si existen, las tres piezas que el conjunto fundido ya no
-- crea (reserva_enlace_regenerar_fijo, reserva_enlace_emitir de 7 argumentos
-- y la policy reserva_enlaces_insert), para que esta reversa sirva igual
-- sobre una base con las migraciones originales.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_n bigint := 0;
  v_t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
              AND tgname IN ('trg_appointments_aviso_clinica', 'trg_appointments_proteger_eleccion')) THEN
    RAISE EXCEPTION 'REVERSA F3: siguen los disparadores de F4/F5b que leen columnas reserva_*; quitar antes esos bloques.';
  END IF;
  FOREACH v_t IN ARRAY ARRAY['public.reserva_avisos', 'public.reserva_enlaces', 'public.reserva_verificaciones',
                             'public.reserva_incidencias', 'public.reserva_contactos'] LOOP
    IF to_regclass(v_t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %s', v_t) INTO v_n;
      IF v_n > 0 THEN
        RAISE EXCEPTION 'REVERSA F3: % tiene % filas; respaldar y decidir a mano antes de quitar el bloque.', v_t, v_n;
      END IF;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
              AND attname = 'reserva_canal' AND NOT attisdropped) THEN
    EXECUTE 'SELECT count(*) FROM public.appointments WHERE reserva_canal IS NOT NULL' INTO v_n;
    IF v_n > 0 THEN
      RAISE EXCEPTION 'REVERSA F3: hay % citas nacidas de un enlace; respaldar y decidir a mano antes.', v_n;
    END IF;
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
