-- supabase/produccion/plan/reversa-previa.sql
--
-- SÓLO LEE. La corre `aplicar.sh reversa` ANTES de deshacer la primera reversa
-- de la cadena (hallazgo A5 de auditoria/RONDA-1.md): reúne por adelantado
-- todas las negativas de las 9 reversas de la agenda (M2 no tiene ninguna), para no quitar T y F5b y
-- descubrir después que F4 no puede seguir.
--
-- Una fila por motivo, separada por «|»:   versión | clase | qué
--   clase BLOQUEA → la cadena NO empieza (no hay confirmación que lo salte):
--                   no eres postgres, la v2 está encendida en alguna clínica
--                   (regla de Angel: apagarla en TODAS antes de revertir), o
--                   falta el respaldo que necesita la reversa de F1.
--   clase DATOS   → esa reversa se negaría por datos que se perderían; se pide
--                   UNA confirmación, por adelantado, con la lista entera.
-- Sin filas = ninguna reversa se va a negar.
--
-- ⚠️ CADA CONDICIÓN ES COPIA DE LA GUARDA DE SU REVERSA (supabase/reversas/, su
-- cabecera «GUARDA DE DATOS» y su pre-vuelo; al día con la corrección A4 de F1):
-- si cambia una guarda, cambia aquí en el mismo commit. Las reversas siguen
-- comprobando lo suyo: esto sólo adelanta la pregunta.
--
-- Cómo cuenta sin fallar cuando la tabla o la columna no existen (reversa ya
-- hecha, o bloque sin aplicar): la consulta va en texto y se ejecuta con
-- query_to_xml SÓLO si existen la tabla y todas las columnas que nombra.
BEGIN TRANSACTION READ ONLY;

WITH c(version, clase, que, tabla, columnas, consulta) AS (VALUES
  -- M1 (20261202120000_avisos_globales_modelo_reversa.sql): las marcas de visto se perderían, y los
  -- avisos con la forma de M1 impedirían volver a la de F4.
  ('20261202120000', 'DATOS', 'avisos_vistos (marcas de «revisado» por usuario)', 'public.avisos_vistos', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.avisos_vistos'),
  ('20261202120000', 'DATOS', 'avisos_vistos_hasta («Marcar todos como revisados» por usuario)', 'public.avisos_vistos_hasta', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.avisos_vistos_hasta'),
  ('20261202120000', 'DATOS', 'avisos_clinica con la forma de M1 (sin cita, dirigidos, con actor o de un tipo nuevo)',
     'public.avisos_clinica', ARRAY['destinatario_id', 'actor_id', 'datos'],
     'SELECT count(*) AS n FROM public.avisos_clinica WHERE cita_id IS NULL OR destinatario_id IS NOT NULL OR actor_id IS NOT NULL OR datos IS NOT NULL OR tipo NOT IN (''reserva_enlace'', ''cancelacion_paciente'', ''reagendado_paciente'', ''google_por_asignar'', ''empalme_google'', ''google_movimiento_rechazado'', ''confirmacion_paciente'')'),
  -- F5b (20261201170000_agenda_f5b_protecciones_cita_reversa.sql)
  ('20261201170000', 'DATOS', 'citas canceladas cerradas (cerrada_en/sustituida_por; reaparecerían en la agenda)',
     'public.appointments', ARRAY['cerrada_en', 'sustituida_por'],
     'SELECT count(*) AS n FROM public.appointments WHERE cerrada_en IS NOT NULL OR sustituida_por IS NOT NULL'),
  -- F4 (20261201160000_agenda_f4_confirmacion_correos_avisos_reversa.sql)
  ('20261201160000', 'DATOS', 'avisos_clinica', 'public.avisos_clinica', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.avisos_clinica'),
  ('20261201160000', 'DATOS', 'cita_correos', 'public.cita_correos', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.cita_correos'),
  ('20261201160000', 'DATOS', 'cita_reagendos', 'public.cita_reagendos', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.cita_reagendos'),
  ('20261201160000', 'DATOS', 'cita_confirmaciones', 'public.cita_confirmaciones', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.cita_confirmaciones'),
  -- F2 (20261201150000_agenda_f2_google_reversa.sql)
  ('20261201150000', 'DATOS', 'gcal_sync_estado', 'public.gcal_sync_estado', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.gcal_sync_estado'),
  ('20261201150000', 'DATOS', 'reserva_empalmes_google', 'public.reserva_empalmes_google', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.reserva_empalmes_google'),
  ('20261201150000', 'DATOS', 'gcal_movimientos_rechazados', 'public.gcal_movimientos_rechazados', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.gcal_movimientos_rechazados'),
  ('20261201150000', 'DATOS', 'citas con google_asignacion', 'public.appointments', ARRAY['google_asignacion'],
     'SELECT count(*) AS n FROM public.appointments WHERE google_asignacion IS NOT NULL'),
  -- F3 (20261201140000_agenda_f3_reserva_enlace_reversa.sql)
  ('20261201140000', 'DATOS', 'reserva_avisos', 'public.reserva_avisos', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.reserva_avisos'),
  ('20261201140000', 'DATOS', 'reserva_enlaces', 'public.reserva_enlaces', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.reserva_enlaces'),
  ('20261201140000', 'DATOS', 'reserva_verificaciones', 'public.reserva_verificaciones', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.reserva_verificaciones'),
  ('20261201140000', 'DATOS', 'reserva_incidencias', 'public.reserva_incidencias', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.reserva_incidencias'),
  ('20261201140000', 'DATOS', 'reserva_contactos', 'public.reserva_contactos', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.reserva_contactos'),
  ('20261201140000', 'DATOS', 'citas con reserva_* (reservadas por enlace)', 'public.appointments',
     ARRAY['reserva_canal', 'reserva_enlace_id', 'reserva_reagendados'],
     'SELECT count(*) AS n FROM public.appointments WHERE reserva_canal IS NOT NULL OR reserva_enlace_id IS NOT NULL OR reserva_reagendados <> 0'),
  -- F5a (20261201130000_agenda_f5a_bloqueos_reversa.sql)
  ('20261201130000', 'DATOS', 'agenda_bloqueos', 'public.agenda_bloqueos', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.agenda_bloqueos'),
  -- F1 (20261201120000_agenda_f1_ajustes_tipos_horarios_reversa.sql)
  ('20261201120000', 'DATOS', 'agenda_ajustes (filas)', 'public.agenda_ajustes', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.agenda_ajustes'),
  ('20261201120000', 'DATOS', 'tipos_cita', 'public.tipos_cita', ARRAY[]::text[],
     'SELECT count(*) AS n FROM public.tipos_cita'),
  ('20261201120000', 'DATOS', 'citas con tipo', 'public.appointments', ARRAY['tipo_cita_id'],
     'SELECT count(*) AS n FROM public.appointments WHERE tipo_cita_id IS NOT NULL'),
  ('20261201120000', 'DATOS', 'consultorios con horario revisado', 'public.consultorios', ARRAY['horario_revisado_en'],
     'SELECT count(*) AS n FROM public.consultorios WHERE horario_revisado_en IS NOT NULL'),
  ('20261201120000', 'DATOS', 'consultorios con horario editado o creados con horario propio tras la copia',
     'respaldos.consultorios_horario_20261119', ARRAY['horario_copiado'],
     'SELECT count(*) AS n FROM public.consultorios k WHERE k.horario_propio AND NOT EXISTS (SELECT 1 FROM respaldos.consultorios_horario_20261119 r WHERE r.id = k.id AND r.horario_copiado IS NOT DISTINCT FROM k.horario)'),
  ('20261201120000', 'DATOS', 'clínicas con huso de fábrica (clinicas.timezone)', 'public.clinicas', ARRAY['timezone'],
     'SELECT count(*) AS n FROM public.clinicas WHERE timezone IS NOT NULL')
),
cuentas AS (
  SELECT c.version, c.clase, c.que,
         CASE WHEN to_regclass(c.tabla) IS NOT NULL
               AND (SELECT count(*) FROM pg_catalog.pg_attribute a
                     WHERE a.attrelid = to_regclass(c.tabla) AND NOT a.attisdropped
                       AND a.attname = ANY (c.columnas)) = cardinality(c.columnas)
              THEN (xpath('/row/n/text()', query_to_xml(c.consulta, false, true, '')))[1]::text::bigint
         END AS n
    FROM c
)
SELECT version || '|' || clase || '|' || que || ': ' || n FROM cuentas WHERE n > 0
UNION ALL
-- Previa de toda la cadena. G13 (ronda 2 del guion): dice CUÁLES (ids de
-- clínica; un uuid no es un dato personal), no sólo cuántas. aplicar.sh lo
-- vuelve a comprobar dentro de la transacción de CADA reversa (G2).
SELECT 'previo|BLOQUEA|la v2 está ENCENDIDA en estas clínicas (apágala en TODAS antes de revertir): ' || x.ids
  FROM (SELECT CASE WHEN to_regclass('public.agenda_ajustes') IS NOT NULL
                    THEN (xpath('/row/n/text()', query_to_xml(
                           'SELECT string_agg(clinica_id::text, '', '' ORDER BY clinica_id) AS n FROM public.agenda_ajustes WHERE agenda_v2_encendida',
                           false, true, '')))[1]::text
               END AS ids) x
 WHERE x.ids IS NOT NULL
UNION ALL
SELECT 'previo|BLOQUEA|hay que correr la reversa como el rol postgres (current_user es ' || current_user || ')'
 WHERE current_user <> 'postgres'
UNION ALL
SELECT '20261201120000|BLOQUEA|falta respaldos.consultorios_horario_20261119: la reversa de F1 no podría devolver el horario previo'
 WHERE to_regclass('public.agenda_ajustes') IS NOT NULL
   AND to_regclass('respaldos.consultorios_horario_20261119') IS NULL
UNION ALL
SELECT '20261201120000|BLOQUEA|respaldos.consultorios_horario_20261119 no tiene horario_antes/horario_copiado (de una F1 anterior a la ronda 1): la reversa de F1 se negaría'
 WHERE to_regclass('public.agenda_ajustes') IS NOT NULL
   AND to_regclass('respaldos.consultorios_horario_20261119') IS NOT NULL
   AND (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid = to_regclass('respaldos.consultorios_horario_20261119')
         AND NOT attisdropped AND attname IN ('horario_antes', 'horario_copiado')) <> 2;

ROLLBACK;
