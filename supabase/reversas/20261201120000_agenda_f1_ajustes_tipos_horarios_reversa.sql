-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de 20261201120000_agenda_f1_ajustes_tipos_horarios.sql (bloque F1)
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ HACE: quita TODOS los objetos de F1 y sólo ésos, en orden inverso de
--   dependencias, sin CASCADE. Antes devuelve a consultorios.horario el valor
--   previo al backfill en las filas que nadie editó desde la copia.
-- CUÁNDO: la ÚLTIMA, después de las reversas de F5b, F4, F2, F3 y F5a. Si
--   queda algo de esos bloques que nombre lo de F1, aborta sin tocar nada.
-- QUÉ SE PIERDE (respaldar antes si hace falta):
--   · los ajustes y el interruptor de cada clínica (agenda_ajustes);
--   · los tipos de cita y qué tipo tenía cada cita (appointments.tipo_cita_*);
--   · qué consultorios tienen horario propio, cuáles revisó una persona y el
--     huso «de fábrica» de cada clínica.
--     CREATE TABLE respaldos.agenda_ajustes_AAAAMMDD AS SELECT * FROM public.agenda_ajustes;
--     CREATE TABLE respaldos.tipos_cita_AAAAMMDD AS SELECT * FROM public.tipos_cita;
--     CREATE TABLE respaldos.citas_tipo_AAAAMMDD AS
--       SELECT id, tipo_cita_id, tipo_cita_nombre FROM public.appointments WHERE tipo_cita_id IS NOT NULL;
--     CREATE TABLE respaldos.consultorios_v2_AAAAMMDD AS
--       SELECT id, horario, horario_propio, horario_revisado_en FROM public.consultorios;
--     CREATE TABLE respaldos.clinicas_timezone_AAAAMMDD AS
--       SELECT id, timezone FROM public.clinicas WHERE timezone IS NOT NULL;
-- QUÉ SE QUEDA, a propósito:
--   · respaldos.consultorios_horario_20261119: es el único sitio con el
--     horario previo al backfill de las filas que se editaron después. Si
--     F1 se vuelve a aplicar, lo reutiliza (conserva la primera copia).
--     Borrarlo, cuando ya no haga falta: DROP TABLE respaldos.consultorios_horario_20261119;
--   · las filas de audit_log (inmutables).
-- Bloqueos: ACCESS EXCLUSIVE sobre appointments, consultorios y clinicas
--   (DROP COLUMN / DROP CONSTRAINT / DROP TRIGGER) hasta el COMMIT.
-- SEGUNDA PASADA: aborta limpio (F1 ya no está).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de tocar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_resto text[];
BEGIN
  IF to_regclass('public.agenda_ajustes') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: F1 no está aplicado (no existe public.agenda_ajustes). No se toca nada.';
  END IF;
  -- Lo de los bloques posteriores que todavía colgaría de F1: sus tablas, sus
  -- columnas en appointments y cualquier función ajena que nombre los objetos
  -- de F1 (las SQL no dejan dependencia en el catálogo y quedarían rotas).
  SELECT array_agg(o) INTO v_resto FROM (
    SELECT t AS o FROM unnest(ARRAY['public.agenda_bloqueos', 'public.gcal_sync_estado', 'public.reserva_enlaces',
                                    'public.reserva_avisos', 'public.cita_confirmaciones', 'public.avisos_clinica']) AS t
     WHERE to_regclass(t) IS NOT NULL
    UNION ALL
    SELECT 'appointments.' || a.attname FROM pg_attribute a
     WHERE a.attrelid = 'public.appointments'::regclass AND NOT a.attisdropped
       AND a.attname IN ('reserva_canal', 'google_asignacion', 'cerrada_en')
    UNION ALL
    SELECT p.oid::regprocedure::text FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname NOT IN ('agenda_v2_encendida', 'proteger_agenda_ajustes', 'validar_tipo_cita_medico',
                             'validar_tipo_cita_consultorio', 'update_tipos_cita_updated_at',
                             'log_cita_change', 'agenda_restablecer_configuracion')
       AND p.prosrc ~ '(agenda_ajustes|tipos_cita|agenda_v2_encendida|log_cita_change|horario_propio|horario_revisado_en)'
  ) x;
  IF v_resto IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: quedan objetos de bloques posteriores que dependen de F1: %. Corre antes sus reversas.', v_resto;
  END IF;
  IF to_regclass('respaldos.consultorios_horario_20261119') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta respaldos.consultorios_horario_20261119; sin él no se puede devolver el horario previo. No se toca nada.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Datos: el horario previo al backfill, sólo en las filas que nadie
--     editó desde la copia (su updated_at sigue siendo el de la copia). Las
--     editadas se quedan como están: no se pisan con un valor más viejo.
-- ---------------------------------------------------------------------
UPDATE public.consultorios k
   SET horario = r.horario
  FROM respaldos.consultorios_horario_20261119 r
 WHERE r.id = k.id AND k.updated_at = r.respaldado_en;

-- ---------------------------------------------------------------------
-- 3 · Objetos, en orden inverso de dependencias. DROP TABLE se lleva sus
--     índices, restricciones, policies y disparadores propios.
-- ---------------------------------------------------------------------
DROP TRIGGER audit_appointments_update ON public.appointments;
DROP TRIGGER audit_appointments ON public.appointments;
DROP FUNCTION public.log_cita_change();

DROP FUNCTION public.agenda_restablecer_configuracion(uuid, uuid);

DROP INDEX public.idx_appointments_tipo_cita;
ALTER TABLE public.appointments
  DROP CONSTRAINT appointments_tipo_cita_fkey,
  DROP CONSTRAINT appointments_tipo_cita_snapshot_check,
  DROP COLUMN tipo_cita_nombre,
  DROP COLUMN tipo_cita_id;

DROP TABLE public.tipos_cita;
DROP FUNCTION public.update_tipos_cita_updated_at();
DROP FUNCTION public.validar_tipo_cita_consultorio();
DROP FUNCTION public.validar_tipo_cita_medico();

-- IF EXISTS sólo aquí: es la única pieza de F1 que no existía en las 44
-- migraciones originales, y así la reversa también sirve sobre una base
-- montada con ellas.
DROP FUNCTION IF EXISTS public.agenda_v2_encendida(uuid);
DROP TABLE public.agenda_ajustes;
DROP FUNCTION public.proteger_agenda_ajustes();

ALTER TABLE public.consultorios
  DROP COLUMN horario_revisado_en,
  DROP COLUMN horario_propio;
ALTER TABLE public.clinicas DROP COLUMN timezone;

-- ---------------------------------------------------------------------
-- 4 · Post-vuelo: no queda nada de F1 (salvo el respaldo).
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.agenda_ajustes') IS NOT NULL OR to_regclass('public.tipos_cita') IS NOT NULL
     OR to_regclass('public.idx_appointments_tipo_cita') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
                 AND proname IN ('agenda_v2_encendida', 'proteger_agenda_ajustes', 'validar_tipo_cita_medico',
                                 'validar_tipo_cita_consultorio', 'update_tipos_cita_updated_at',
                                 'log_cita_change', 'agenda_restablecer_configuracion'))
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                 AND tgname IN ('audit_appointments', 'audit_appointments_update'))
     OR EXISTS (SELECT 1 FROM pg_attribute a WHERE NOT a.attisdropped
                 AND (a.attrelid, a.attname) IN (('public.appointments'::regclass, 'tipo_cita_id'),
                                                 ('public.appointments'::regclass, 'tipo_cita_nombre'),
                                                 ('public.consultorios'::regclass, 'horario_propio'),
                                                 ('public.consultorios'::regclass, 'horario_revisado_en'),
                                                 ('public.clinicas'::regclass, 'timezone'))) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: quedó algún objeto de F1.';
  END IF;
END $$;

COMMIT;

SELECT 1 AS n, 'objetos de F1 que quedan (salvo el respaldo)' AS comprobacion,
       (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace
         AND proname IN ('agenda_v2_encendida', 'proteger_agenda_ajustes', 'validar_tipo_cita_medico',
                         'validar_tipo_cita_consultorio', 'update_tipos_cita_updated_at',
                         'log_cita_change', 'agenda_restablecer_configuracion'))
       || ' / ' || (to_regclass('public.agenda_ajustes') IS NULL AND to_regclass('public.tipos_cita') IS NULL)::text AS valor,
       '0 / true' AS esperado
UNION ALL
SELECT 2, 'respaldo conservado (filas)',
       (SELECT count(*)::text FROM respaldos.consultorios_horario_20261119), NULL;
