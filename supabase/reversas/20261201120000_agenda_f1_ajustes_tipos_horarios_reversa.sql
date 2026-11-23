-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de 20261201120000_agenda_f1_ajustes_tipos_horarios.sql (bloque F1)
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ HACE: quita TODOS los objetos de F1 y sólo ésos, en orden inverso de
--   dependencias, sin CASCADE. Antes devuelve a consultorios.horario el valor
--   previo a la ÚLTIMA pasada del backfill (respaldo.horario_antes) en las
--   filas cuyo horario sigue siendo el que escribió la copia
--   (respaldo.horario_copiado): editar otro campo del consultorio no cuenta.
--   El ciclo aplicar → revertir → reaplicar → revertir funciona cada vez.
-- DEPENDE DE: va la ÚLTIMA, después de las reversas de F5b, F4, F2, F3 y F5a.
--   Si queda algo de esos bloques que nombre lo de F1, aborta sin tocar nada.
--   Necesita respaldos.consultorios_horario_20261119.
-- DATOS DE LA V2: se NIEGA (aborta sin tocar nada y dice cuántos hay) si hay
--   algo creado con la v2 que se perdería:
--   · filas de agenda_ajustes (ajustes guardados o el interruptor encendido);
--   · tipos de cita, y citas con tipo (appointments.tipo_cita_*);
--   · consultorios con horario revisado por una persona (horario_revisado_en)
--     o cuyo horario se editó desde la copia (o creados después con horario
--     propio);
--   · el huso «de fábrica» de alguna clínica (clinicas.timezone).
--   Para quitarlo igualmente: respaldar con
--     CREATE TABLE respaldos.agenda_ajustes_AAAAMMDD AS SELECT * FROM public.agenda_ajustes;
--     CREATE TABLE respaldos.tipos_cita_AAAAMMDD AS SELECT * FROM public.tipos_cita;
--     CREATE TABLE respaldos.citas_tipo_AAAAMMDD AS
--       SELECT id, tipo_cita_id, tipo_cita_nombre FROM public.appointments WHERE tipo_cita_id IS NOT NULL;
--     CREATE TABLE respaldos.consultorios_v2_AAAAMMDD AS
--       SELECT id, horario, horario_propio, horario_revisado_en FROM public.consultorios;
--     CREATE TABLE respaldos.clinicas_timezone_AAAAMMDD AS
--       SELECT id, timezone FROM public.clinicas WHERE timezone IS NOT NULL;
--   y confirmarlo: «SET LOCAL spinus.reversa_con_datos = 'si';» justo después
--   del BEGIN de este archivo (o «SET spinus.reversa_con_datos = 'si';» en la
--   misma sesión antes de él).
-- GUARDA DE DATOS, SIN CORRER LA REVERSA (sólo lectura; la misma condición
--   que el pre-vuelo de abajo; 0 filas = se puede revertir sin confirmar):
--     SELECT 'agenda_ajustes' FROM public.agenda_ajustes
--     UNION ALL SELECT 'tipos_cita' FROM public.tipos_cita
--     UNION ALL SELECT 'cita con tipo' FROM public.appointments WHERE tipo_cita_id IS NOT NULL
--     UNION ALL SELECT 'horario revisado' FROM public.consultorios WHERE horario_revisado_en IS NOT NULL
--     UNION ALL SELECT 'horario editado o creado tras la copia' FROM public.consultorios k
--      WHERE k.horario_propio AND NOT EXISTS (SELECT 1 FROM respaldos.consultorios_horario_20261119 r
--             WHERE r.id = k.id AND r.horario_copiado IS NOT DISTINCT FROM k.horario)
--     UNION ALL SELECT 'huso de fábrica' FROM public.clinicas WHERE timezone IS NOT NULL;
-- QUÉ SE QUEDA, a propósito:
--   · respaldos.consultorios_horario_20261119: es el único sitio con el
--     horario previo al backfill de las filas que se editaron después. Si
--     F1 se vuelve a aplicar, lo reutiliza: conserva la primera copia
--     (horario, respaldado_en) y renueva horario_antes/horario_copiado/copiado_en.
--     Borrarlo, cuando ya no haga falta: DROP TABLE respaldos.consultorios_horario_20261119;
--   · las filas de audit_log (inmutables).
-- RIESGO: ACCESS EXCLUSIVE sobre appointments, consultorios y clinicas
--   (DROP COLUMN / DROP CONSTRAINT / DROP TRIGGER) hasta el COMMIT, con
--   lock_timeout 5 s: aplicarla cuando no haya consulta. Una transacción: si
--   falla, no queda nada a medias.
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
  v_datos text[];
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
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'respaldos.consultorios_horario_20261119'::regclass
        AND NOT attisdropped AND attname IN ('horario_antes', 'horario_copiado')) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: respaldos.consultorios_horario_20261119 no tiene horario_antes/horario_copiado (es de una F1 anterior a la ronda 1 de la auditoría). No se toca nada.';
  END IF;

  -- Lo creado con la v2 que se perdería. Sin confirmación explícita, no se toca nada.
  SELECT array_agg(o) INTO v_datos FROM (
    SELECT format('agenda_ajustes: %s fila(s), %s con la v2 encendida', count(*), count(*) FILTER (WHERE agenda_v2_encendida)) AS o
      FROM public.agenda_ajustes HAVING count(*) > 0
    UNION ALL
    SELECT format('tipos_cita: %s', count(*)) FROM public.tipos_cita HAVING count(*) > 0
    UNION ALL
    SELECT format('citas con tipo: %s', count(*)) FROM public.appointments WHERE tipo_cita_id IS NOT NULL HAVING count(*) > 0
    UNION ALL
    SELECT format('consultorios con horario revisado: %s', count(*)) FROM public.consultorios
     WHERE horario_revisado_en IS NOT NULL HAVING count(*) > 0
    UNION ALL
    SELECT format('consultorios con horario editado o creados con horario propio tras la copia: %s', count(*))
      FROM public.consultorios k
     WHERE k.horario_propio
       AND NOT EXISTS (SELECT 1 FROM respaldos.consultorios_horario_20261119 r
                        WHERE r.id = k.id AND r.horario_copiado IS NOT DISTINCT FROM k.horario)
    HAVING count(*) > 0
    UNION ALL
    SELECT format('clínicas con huso de fábrica: %s', count(*)) FROM public.clinicas WHERE timezone IS NOT NULL HAVING count(*) > 0
  ) x;
  IF v_datos IS NOT NULL THEN
    IF current_setting('spinus.reversa_con_datos', true) IS DISTINCT FROM 'si' THEN
      RAISE EXCEPTION 'REVERSA ABORTADA: hay datos de la agenda v2 que se perderían: %. No se tocó nada. Respáldalos y confírmalo con spinus.reversa_con_datos = ''si'' (ver la cabecera).', v_datos;
    END IF;
    RAISE NOTICE 'Confirmado spinus.reversa_con_datos = si: se pierden %', v_datos;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Datos: el horario previo a la última pasada del backfill, sólo en las
--     filas cuyo horario sigue siendo el que escribió la copia. Las editadas
--     se quedan como están: no se pisan con un valor más viejo.
-- ---------------------------------------------------------------------
UPDATE public.consultorios k
   SET horario = r.horario_antes
  FROM respaldos.consultorios_horario_20261119 r
 WHERE r.id = k.id AND k.horario IS NOT DISTINCT FROM r.horario_copiado;

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

-- IF EXISTS sólo aquí: una base montada con las migraciones anteriores a la
-- fusión tiene todo lo demás de F1, pero no esta función.
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
