-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de 20261201170000_agenda_f5b_protecciones_cita.sql (F5b).
-- Quita TODO lo de F5b, y sólo eso, en orden inverso de dependencias:
--   disparadores → funciones → índice, CHECK y FK del cierre → columnas
--   cerrada_en / sustituida_por → índices de rango.
-- Sin CASCADE. F5b es el último bloque del conjunto: nada de otro bloque
-- depende de estos objetos en el catálogo (comprobado: sólo los nombran en
-- comentarios cita_movimiento_google_registrar (F2) y otros cuerpos plpgsql).
-- ⚠️ Quitar los disparadores ABRE caminos de escritura de appointments que hoy
--   están cerrados (borrar citas con paciente, mover una atendida con nota,
--   escribir reserva_*…). Hazlo con la app en mantenimiento o con la v2 apagada.
-- ⚠️ Datos: si hay canceladas CERRADAS (cerrada_en no nulo), quitar las columnas
--   las haría reaparecer en la agenda y perdería a qué cita se sustituyó. La
--   reversa ABORTA en ese caso: respáldalas antes (p. ej. a un esquema de
--   respaldos) y decide; no se borra nada sin que alguien lo decida.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: el rol % no es dueño de public.appointments.', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND attname = 'cerrada_en' AND NOT attisdropped) THEN
    IF EXISTS (SELECT 1 FROM public.appointments WHERE cerrada_en IS NOT NULL OR sustituida_por IS NOT NULL) THEN
      RAISE EXCEPTION 'REVERSA ABORTADA: hay citas canceladas cerradas (cerrada_en/sustituida_por). Respáldalas antes; quitar las columnas las haría reaparecer en la agenda.';
    END IF;
  END IF;
END $$;

-- 1 · Disparadores.
DROP TRIGGER IF EXISTS trg_appointments_horario_bloqueado ON public.appointments;
DROP TRIGGER IF EXISTS trg_appointments_proteger_atendida ON public.appointments;
DROP TRIGGER IF EXISTS trg_appointments_proteger_borrado ON public.appointments;
DROP TRIGGER IF EXISTS trg_appointments_proteger_cierre ON public.appointments;
DROP TRIGGER IF EXISTS trg_appointments_proteger_eleccion ON public.appointments;
DROP TRIGGER IF EXISTS trg_appointments_proteger_reserva ON public.appointments;

-- 2 · Funciones (cita_proteger_atendida antes que cita_tiene_nota_ligada, que es la que llama).
DROP FUNCTION IF EXISTS public.cita_proteger_bloqueo();
DROP FUNCTION IF EXISTS public.cita_proteger_atendida();
DROP FUNCTION IF EXISTS public.cita_proteger_borrado();
DROP FUNCTION IF EXISTS public.cita_proteger_cierre();
DROP FUNCTION IF EXISTS public.cita_proteger_eleccion();
DROP FUNCTION IF EXISTS public.cita_proteger_reserva();
DROP FUNCTION IF EXISTS public.cita_tiene_nota_ligada(uuid, uuid);

-- 3 · La cancelada cerrada.
DROP INDEX IF EXISTS public.idx_appointments_sustituida_por;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_cierre_check;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_sustituida_por_fkey;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS sustituida_por, DROP COLUMN IF EXISTS cerrada_en;

-- 4 · Índices de rango.
DROP INDEX IF EXISTS public.idx_appointments_clinica_medico_inicio;
DROP INDEX IF EXISTS public.idx_appointments_clinica_inicio;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass AND NOT tgisinternal
              AND (tgname LIKE 'trg_appointments_proteger\_%' OR tgname = 'trg_appointments_horario_bloqueado'))
     OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
                 AND (proname LIKE 'cita_proteger\_%' OR proname = 'cita_tiene_nota_ligada'))
     OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
                 AND attname IN ('cerrada_en', 'sustituida_por'))
     OR to_regclass('public.idx_appointments_clinica_inicio') IS NOT NULL
     OR to_regclass('public.idx_appointments_clinica_medico_inicio') IS NOT NULL THEN
    RAISE EXCEPTION 'REVERSA: quedó algún objeto de F5b.';
  END IF;
END $$;

COMMIT;

SELECT 'F5b quitada' AS resultado,
       (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass AND NOT tgisinternal) AS disparadores_que_quedan_en_appointments;
