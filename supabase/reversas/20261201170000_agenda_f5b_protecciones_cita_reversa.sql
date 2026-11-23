-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de 20261201170000_agenda_f5b_protecciones_cita.sql (F5b).
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ HACE: quita TODO lo de F5b, y sólo eso, en orden inverso de
--   dependencias: disparadores → funciones → índice, CHECK y FK del cierre →
--   columnas cerrada_en / sustituida_por → índices de rango. Sin CASCADE: nada
--   de otro bloque depende de estos objetos en el catálogo (sólo los nombran
--   comentarios y cuerpos plpgsql, que no crean dependencia).
--
-- DE QUÉ DEPENDE: rol postgres (dueño de appointments). Va la PRIMERA de las
--   reversas del conjunto (F5b → F4 → F2 → F3 → F5a → F1).
--
-- ⚠️ QUÉ QUEDA DESPROTEGIDO desde que corre hasta que se vuelva a aplicar F5b
--   (con la app nueva desplegada, la API sigue vetando parte de esto; quien
--   escriba con PostgREST o con service_role, no):
--   · borrado de citas con paciente o por ligar con la v2 encendida
--     (cita_proteger_borrado);
--   · cambiar de estado, mover o borrar una cita ATENDIDA con nota clínica,
--     también para service_role (cita_proteger_atendida);
--   · escribir las columnas reserva_* desde la sesión (cita_proteger_reserva);
--   · agendar o mover citas dentro de un bloqueo de horario (cita_proteger_bloqueo);
--   · cambiar médico, consultorio o inicio de una cita reservada por enlace sin
--     «Reagendar» (cita_proteger_eleccion);
--   · el cierre de canceladas (columnas que desaparecen).
--   Hazla con la v2 APAGADA en todas las clínicas o con la app en mantenimiento.
--
-- DATOS: si hay canceladas CERRADAS (cerrada_en o sustituida_por no nulos),
--   quitar las columnas las haría reaparecer en la agenda y perdería a qué cita
--   se sustituyó cada una. En ese caso la reversa SE NIEGA sin tocar nada.
--   Para seguir de todos modos (tras respaldarlas, p. ej. en el esquema
--   respaldos), confírmalo en la MISMA transacción:
--       BEGIN;
--       SET LOCAL spinus.reversa_con_datos = 'si';
--       \i supabase/reversas/20261201170000_agenda_f5b_protecciones_cita_reversa.sql
--   (el BEGIN de este archivo avisa «ya hay una transacción en curso» y sigue
--   en la tuya; su COMMIT la cierra).
--
-- RIESGO: bajo en el catálogo, alto en lo que deja abierto (arriba).
--   Bloqueos: DROP TRIGGER y DROP COLUMN toman ACCESS EXCLUSIVE sobre
--   appointments hasta el COMMIT (lock_timeout 5 s; si no lo obtiene, aborta
--   sin cambiar nada). Una sola transacción.
-- SEGUNDA PASADA: no hace nada y sale bien (IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_cerradas bigint := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: hay que correrla como el rol postgres (current_user es %).', current_user;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.appointments'::regclass
              AND attname = 'cerrada_en' AND NOT attisdropped)
     AND EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.appointments'::regclass
                  AND attname = 'sustituida_por' AND NOT attisdropped) THEN
    EXECUTE 'SELECT count(*) FROM public.appointments WHERE cerrada_en IS NOT NULL OR sustituida_por IS NOT NULL'
      INTO v_cerradas;
  END IF;
  IF v_cerradas > 0 THEN
    IF coalesce(current_setting('spinus.reversa_con_datos', true), '') <> 'si' THEN
      RAISE EXCEPTION 'REVERSA ABORTADA: hay % citas canceladas cerradas (cerrada_en/sustituida_por). Quitar las columnas las haría reaparecer en la agenda y perdería sus sustitutas. Respáldalas y, si aun así quieres seguir, repite con SET LOCAL spinus.reversa_con_datos = ''si'' en la misma transacción (ver la cabecera).', v_cerradas;
    END IF;
    RAISE WARNING 'REVERSA CON DATOS (spinus.reversa_con_datos = si): se pierde el cierre de % citas canceladas.', v_cerradas;
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
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.appointments'::regclass AND NOT tgisinternal
              AND (tgname LIKE 'trg_appointments_proteger\_%' OR tgname = 'trg_appointments_horario_bloqueado'))
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace = 'public'::regnamespace
                 AND (proname LIKE 'cita_proteger\_%' OR proname = 'cita_tiene_nota_ligada'))
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
                 AND attname IN ('cerrada_en', 'sustituida_por'))
     OR to_regclass('public.idx_appointments_clinica_inicio') IS NOT NULL
     OR to_regclass('public.idx_appointments_clinica_medico_inicio') IS NOT NULL THEN
    RAISE EXCEPTION 'REVERSA: quedó algún objeto de F5b.';
  END IF;
END $$;

COMMIT;

SELECT 'F5b quitada' AS resultado,
       (SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.appointments'::regclass AND NOT tgisinternal) AS disparadores_que_quedan_en_appointments;
