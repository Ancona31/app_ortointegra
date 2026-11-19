-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda L, agente L5 (punto 13 de Angel) — aviso en la campana
-- cuando el paciente confirma su cita desde su enlace
-- Rama: feature/agenda-v2-l5 · Escrita: 2026-11-18
-- Riesgo estimado: BAJO (una función de disparador nueva, un disparador AFTER
-- nuevo sobre cita_confirmaciones que sólo INSERTA en avisos_clinica, y la
-- CHECK de tipos de avisos_clinica ampliada con un valor. Ninguna policy,
-- columna, función existente ni fila cambia; sin arrastre).
-- Lo que hay que saber: el disparador corre DENTRO de la transacción de
-- cita_confirmacion_responder; si su INSERT fallara, la confirmación del
-- paciente se revertiría (500 en /api/confirmar). Es el mismo riesgo que ya
-- acepta el aviso de cancelación de I5, y el pre-vuelo comprueba lo único que
-- podría hacerlo fallar (el índice único parcial del ON CONFLICT). No lleva
-- EXCEPTION WHEN OTHERS: rompería la simetría con I5 y escondería errores.
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de esta cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de E1, 20261115120000,
--   I5, 20261121150000, y J4, 20261122140000; con el conjunto de la agenda v2).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 13 de Angel (tanda L), literal: «Cuando un paciente confirma su cita
-- desde su enlace (llegue por correo o por WhatsApp), aparece un aviso en la
-- campana: "[Nombre] confirmó su cita del [día] a las [hora]". Igual que los
-- demás avisos: lleva a la cita al pulsarlo y sale como emergente breve si la
-- agenda está abierta. Un aviso por confirmación, no uno por cada
-- sincronización. La confirmación marcada a mano por el personal no genera
-- aviso.»
--
-- ═══ DÓNDE SE ESCRIBE, Y POR QUÉ AHÍ ═══════════════════════════════════
-- La fuente de verdad de «confirmó el paciente por su enlace» es la fila de
-- cita_confirmaciones (E1): sólo cita_confirmacion_responder (INVOKER, sólo
-- service_role, la llama POST /api/confirmar/[codigo]) le escribe
-- respuesta = 'confirmo', y SÓLO cuando la cita pasa de verdad de
-- 'scheduled' a 'confirmed' (una cita ya confirmada responde 'ya_confirmada'
-- sin escribir nada). authenticated no tiene UPDATE en esa tabla, así que el
-- personal no puede fingirlo; la confirmación del personal (PUT de la cita,
-- «Marcar como confirmada») sólo toca appointments y no la toca a ella; la
-- RSVP de Google (E9) tampoco. Es la misma fuente que el aviso de cancelación
-- de I5 (trg_cita_confirmaciones_aviso_clinica, 'cancelo').
-- «Un aviso por confirmación»: el disparador mira la escritura de la
-- respuesta, no la cita. Un segundo POST, recargar la página, una
-- sincronización con Google (que sólo toca appointments) o un cambio
-- posterior de la cita no escriben cita_confirmaciones: no hay aviso nuevo.
-- Si el personal devuelve la cita a «agendada» y el paciente vuelve a
-- confirmar, es otra confirmación (respondido_en nuevo) y, revisado el
-- anterior, nace otro aviso; sin revisar, se queda el que había (índice único
-- parcial (tipo, cita) de I5 + ON CONFLICT DO NOTHING, como la cancelación).
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- avisos_clinica_tipo_check: + 'confirmacion_paciente'. DROP + ADD de la
--   CHECK: la nueva es más amplia, todas las filas existentes la cumplen.
-- public.aviso_clinica_de_confirmacion() — RETURNS trigger, SECURITY DEFINER
--   (dueño postgres), search_path vacío, como los escritores de I5: SÓLO
--   inserta el aviso con lo que trae la fila del disparador (clinica_id y
--   appointment_id de cita_confirmaciones). Nada clínico: el aviso guarda
--   tipo, cita y clínica; el nombre, el día y la hora los pone el lector con
--   la RLS de appointments.
-- trg_cita_confirmaciones_aviso_confirmacion — AFTER UPDATE OF respuesta,
--   respondido_en ON cita_confirmaciones, WHEN la respuesta queda en
--   'confirmo' y cambió la respuesta o su hora.
-- Sin arrastre: las confirmaciones de antes no eran avisos y no lo pasan a ser.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere E1 (cita_confirmaciones), I5 (avisos_clinica) y J4 (su CHECK de
-- seis tipos). PG ≥ 14.
-- Bloqueos (lock_timeout 5 s): ALTER TABLE avisos_clinica DROP/ADD CONSTRAINT
--   → ACCESS EXCLUSIVE un instante y un recorrido de la tabla para validar la
--   CHECK (pocas filas); CREATE TRIGGER → SHARE ROW EXCLUSIVE un instante sobre
--   cita_confirmaciones (bloquea escrituras, no lecturas).
-- Orden respecto al código: cualquiera es seguro.
--   · Código nuevo, base sin esto: nadie escribe el tipo nuevo; la campana es
--     la de antes. Confirmar funciona igual.
--   · Código viejo, base con esto: los avisos de confirmación quedan en la
--     tabla y el lector viejo los salta (`leerAvisosClinica` pide sólo los tipos
--     que conoce, J4); la campana enseña lo de siempre.
-- Alcance de los roles:
--   gana — authenticated: ve el aviso nuevo con la RLS de avisos_clinica (de
--          su clínica y de citas que ve), igual que los demás avisos.
--   pierde — nada.
-- Contrato con spinus-consola: función y disparador nuevos; la CHECK de
--   avisos_clinica (tabla de la agenda v2) se amplía; nada que la consola lea
--   cambia de nombre, tipo ni significado.
-- Orden entre migraciones: el pre-vuelo de J4 (20261122140000) admite su CHECK
--   de 5 o 6 tipos; reaplicar J4 DESPUÉS de esta aborta limpio en su pre-vuelo
--   (sin daño), como AG-DT-166 y AG-DT-197. En el orden de nombre no ocurre.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TRIGGER IF EXISTS trg_cita_confirmaciones_aviso_confirmacion ON public.cita_confirmaciones;
--   DROP FUNCTION IF EXISTS public.aviso_clinica_de_confirmacion();
--   UPDATE public.avisos_clinica SET revisado_en = now()       -- (sólo si hay; o respaldarlos antes)
--    WHERE tipo = 'confirmacion_paciente' AND revisado_en IS NULL;
--   -- y la CHECK de J4 con sus seis tipos: falla si quedan filas del tipo
--   -- nuevo (revisadas o no); se conservan como registro y se deja la CHECK.
--
-- ═══ AUDITORÍA INDEPENDIENTE ═══════════════════════════════════════════
-- 2026-11-18, agente aparte (Sonnet), sólo lectura: APTA CON CAMBIOS, sin
-- hallazgos altos. Aplicados: (1, media) el pre-vuelo comprueba el índice
-- único parcial del ON CONFLICT; (2) esta cabecera dice que un fallo del
-- INSERT revierte la confirmación; (3) nota de recalcular el md5; (5) la
-- prueba cubre que revocar el enlace de una confirmada no avisa. No aplicado:
-- (4) comprobar en el pre-vuelo la definición de un disparador homónimo
-- (opcional según la propia auditoría; CREATE OR REPLACE lo deja como aquí).
-- Confirmó: el único escritor de respuesta/respondido_en es
-- cita_confirmacion_responder (INVOKER, sólo service_role); authenticated no
-- tiene UPDATE; ninguna policy creada ni tocada; contrato de spinus-consola
-- intacto; sin PII nueva.
--
-- ═══ APLICACIÓN LOCAL ══════════════════════════════════════════════════
-- 2026-11-18, base local (supabase_db_app_ortointegra), bajo el flock:
-- ensayo con ROLLBACK, dos pasadas con veredicto OK en las 8 filas, y
-- registrada en supabase_migrations.schema_migrations. Tras la auditoría,
-- re-aplicada (el pre-vuelo nuevo pasa; mismo md5). Pruebas:
-- l5_aviso_confirmacion.sql y la batería pruebas-sql.sh en verde.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_def text;
  v_n   integer;
BEGIN
  IF to_regclass('public.avisos_clinica') IS NULL OR to_regclass('public.cita_confirmaciones') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta avisos_clinica (I5) o cita_confirmaciones (E1).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.cita_confirmaciones'::regclass AND NOT attisdropped
        AND attname IN ('clinica_id', 'appointment_id', 'respuesta', 'respondido_en')) <> 4 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: a cita_confirmaciones le faltan columnas de E1.';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.avisos_clinica'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.avisos_clinica.', current_user;
  END IF;
  -- La CHECK es la de J4 (seis tipos) o ya la de esta migración (replay).
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.avisos_clinica'::regclass AND conname = 'avisos_clinica_tipo_check';
  SELECT count(*) INTO v_n FROM regexp_matches(coalesce(v_def, ''), '''[a-z_]+''', 'g');
  IF v_def IS NULL OR NOT (
       v_def LIKE '%''reserva_enlace''%' AND v_def LIKE '%''cancelacion_paciente''%' AND v_def LIKE '%''reagendado_paciente''%'
       AND v_def LIKE '%''google_por_asignar''%' AND v_def LIKE '%''empalme_google''%' AND v_def LIKE '%''google_movimiento_rechazado''%'
       AND (v_n = 6 OR (v_n = 7 AND v_def LIKE '%''confirmacion_paciente''%'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: avisos_clinica_tipo_check no es la de J4 ni la de esta migración: %', v_def;
  END IF;
  -- El ON CONFLICT del disparador necesita el índice único parcial de I5: sin él, la primera
  -- confirmación real fallaría y arrastraría la del paciente (auditoría, hallazgo 1).
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'avisos_clinica'
                   AND indexname = 'avisos_clinica_pendiente_key' AND indexdef LIKE 'CREATE UNIQUE INDEX%'
                   AND indexdef LIKE '%(tipo, cita_id)%' AND indexdef LIKE '%(revisado_en IS NULL)%') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta el índice único avisos_clinica_pendiente_key (tipo, cita_id) WHERE revisado_en IS NULL (I5).';
  END IF;
  -- Replay: la función, si existe, es la de esta migración (md5 de prosrc).
  -- ⚠️ Si se edita el cuerpo de la función de abajo (aunque sea un espacio), recalcular este md5.
  SELECT md5(p.prosrc) INTO v_def FROM pg_proc p WHERE p.oid = to_regprocedure('public.aviso_clinica_de_confirmacion()');
  IF FOUND AND v_def <> '2e8660335e4e7b26697355ce26fb9151' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.aviso_clinica_de_confirmacion() ya existe con otro cuerpo (md5 %).', v_def;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · El tipo nuevo de aviso.
-- ---------------------------------------------------------------------
ALTER TABLE public.avisos_clinica DROP CONSTRAINT IF EXISTS avisos_clinica_tipo_check;
ALTER TABLE public.avisos_clinica ADD CONSTRAINT avisos_clinica_tipo_check
  CHECK (tipo IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente',
                  'google_por_asignar', 'empalme_google', 'google_movimiento_rechazado',
                  'confirmacion_paciente'));

-- ---------------------------------------------------------------------
-- 3 · El escritor. SECURITY DEFINER (dueño postgres), como los de I5: sólo
--     inserta en avisos_clinica con lo que trae la fila del disparador; así
--     no depende de los permisos de quien llama (service_role en
--     cita_confirmacion_responder). RETURNS trigger: no se puede llamar por RPC.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aviso_clinica_de_confirmacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
  VALUES (NEW.clinica_id, 'confirmacion_paciente', NEW.appointment_id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
  RETURN NULL;
END
$fn$;

-- Permisos de funciones (CLAUDE.md), escritos aunque sea RETURNS trigger (no
-- se puede llamar por RPC; lo que cuenta es quién dispara el disparador). Los
-- mismos tres roles que los escritores de I5 y J4.
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_confirmacion() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_confirmacion() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.aviso_clinica_de_confirmacion() IS
  'Tanda L (punto 13): deja el aviso confirmacion_paciente cuando el paciente confirma su cita por su enlace (cita_confirmacion_responder escribe respuesta = confirmo). Uno sin revisar por cita (índice de I5). La confirmación del personal no pasa por aquí.';

-- ---------------------------------------------------------------------
-- 4 · El disparador.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_cita_confirmaciones_aviso_confirmacion
  AFTER UPDATE OF respuesta, respondido_en ON public.cita_confirmaciones
  FOR EACH ROW
  WHEN (NEW.respuesta = 'confirmo'
        AND (OLD.respuesta IS DISTINCT FROM 'confirmo' OR OLD.respondido_en IS DISTINCT FROM NEW.respondido_en))
  EXECUTE FUNCTION public.aviso_clinica_de_confirmacion();

COMMIT;

-- ---------------------------------------------------------------------
-- 5 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'avisos_clinica_tipo_check admite el tipo nuevo (7 tipos)' AS comprobacion,
         coalesce((SELECT (pg_get_constraintdef(oid) LIKE '%confirmacion_paciente%')::text || ' / '
                          || (SELECT count(*) FROM regexp_matches(pg_get_constraintdef(oid), '''[a-z_]+''', 'g'))::text
                     FROM pg_constraint WHERE conrelid = 'public.avisos_clinica'::regclass AND conname = 'avisos_clinica_tipo_check'), 'AUSENTE') AS valor,
         'true / 7' AS esperado
  UNION ALL
  SELECT 2, 'función: DEFINER / search_path vacío / dueño',
         coalesce((SELECT p.prosecdef::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text || ' / ' || pg_get_userbyid(p.proowner)
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.aviso_clinica_de_confirmacion()')), 'AUSENTE'),
         'true / true / postgres'
  UNION ALL
  SELECT 3, 'EXECUTE: PUBLIC / anon / authenticated / service_role',
         coalesce((SELECT (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                                    WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE'))::text
                          || ' / ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.aviso_clinica_de_confirmacion()')), 'AUSENTE'),
         'false / true / true / true'
  UNION ALL
  SELECT 4, 'disparador nuevo (AFTER UPDATE, por fila, habilitado)',
         coalesce((SELECT tgname || ' / ' || tgenabled::text FROM pg_trigger
                    WHERE NOT tgisinternal AND tgname = 'trg_cita_confirmaciones_aviso_confirmacion'
                      AND tgrelid = 'public.cita_confirmaciones'::regclass), 'AUSENTE'),
         'trg_cita_confirmaciones_aviso_confirmacion / O'
  UNION ALL
  SELECT 5, 'el disparador de cancelación de I5, intacto',
         coalesce((SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname = 'trg_cita_confirmaciones_aviso_clinica'
                      AND tgrelid = 'public.cita_confirmaciones'::regclass), 'AUSENTE'),
         'trg_cita_confirmaciones_aviso_clinica'
  UNION ALL
  SELECT 6, 'policies de avisos_clinica, intactas',
         coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avisos_clinica'), 'NINGUNA'),
         'avisos_clinica_select,avisos_clinica_update'
  UNION ALL
  SELECT 7, 'policies de cita_confirmaciones, intactas',
         coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cita_confirmaciones'), 'NINGUNA'),
         'cita_confirmaciones_select'
  UNION ALL
  SELECT 8, 'avisos de confirmación sin revisar',
         (SELECT count(*)::text FROM public.avisos_clinica WHERE tipo = 'confirmacion_paciente' AND revisado_en IS NULL),
         NULL
) t
ORDER BY t.n;
