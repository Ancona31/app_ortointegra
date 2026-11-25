-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de M3 (20261206120000_agenda_para_todos.sql)
-- NO es una migración: vive fuera de supabase/migrations/. Se corre a mano y
-- SÓLO si Angel lo pide.
-- ═══════════════════════════════════════════════════════════════════════
-- QUÉ HACE: quita el disparador trg_clinicas_agenda_ajustes y su función;
--   devuelve agenda_ajustes.agenda_v2_encendida a DEFAULT false; devuelve
--   public.agenda_v2_encendida(uuid) al cuerpo de F1 («sin fila = false»); y
--   devuelve los tres COMMENT de F1.
-- ⚠️ NO TOCA FILAS, Y POR ESO NO APAGA NADA POR SÍ SOLA. Las filas que M3
--   creó o pasó a true se quedan como estén. Lo que apaga la agenda v2 de una
--   clínica es su FILA con false. Por eso el guion (aplicar.sh, regla de Angel
--   para TODA reversa de la agenda) exige que la v2 esté apagada en todas las
--   clínicas ANTES de correr ésta: quien quiere deshacer M3 apaga primero
--   (docs/spec/agenda-para-todos/ENSAYO.md, «Deshacer M3») y revierte
--   después. Con las filas en false, tras esta reversa todo queda como antes
--   de M3, salvo que cada clínica tiene ya su fila (apagada).
-- QUÉ SE PIERDE: ningún dato. Una clínica creada DESPUÉS de esta reversa nace
--   sin fila y, otra vez, apagada.
-- ORDEN EN LA CADENA: la PRIMERA (antes que la de M2). La de F1 se niega si
--   sigue existiendo agenda_ajustes_de_clinica_nueva() (nombra agenda_ajustes).
-- GUARDA DE DATOS: no tiene; no toca filas y nunca se niega por datos.
-- SEGUNDA PASADA: no hace nada y sale bien (IF EXISTS; el resto es idempotente).
-- Bloqueos: SHARE ROW EXCLUSIVE sobre clinicas (DROP TRIGGER) y ACCESS
--   EXCLUSIVE sobre agenda_ajustes (el DEFAULT), en el último bloque DO.
-- Ensayo: stack local, 2026-11-25: ida, reversa, ida otra vez.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.agenda_ajustes') IS NULL OR to_regprocedure('public.agenda_v2_encendida(uuid)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe public.agenda_ajustes o agenda_v2_encendida(uuid) (F1 ya deshecha): esta reversa no tiene nada que devolver.';
  END IF;
END $$;

-- El cuerpo de F1, byte a byte (su huella es la que exige el pre-vuelo de M3).
CREATE OR REPLACE FUNCTION public.agenda_v2_encendida(p_clinica_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT coalesce((SELECT a.agenda_v2_encendida FROM public.agenda_ajustes a
                    WHERE a.clinica_id = p_clinica_id), false)
$fn$;

COMMENT ON TABLE public.agenda_ajustes IS
  'Ajustes de agenda por clínica (mejora_agendaV2 §2). Sin fila = valores de fábrica (24 h, 2 h, 60 d, 7 d) e interruptor apagado. Los límites viven aquí en CHECK y en LIMITES_AJUSTES_AGENDA (src/lib/agenda/ajustesAgenda.ts): cambiar los dos.';
COMMENT ON COLUMN public.agenda_ajustes.agenda_v2_encendida IS
  'Interruptor de las funciones nuevas de la agenda para ESTA clínica. Sólo lo cambia postgres (trg_agenda_ajustes_proteger). Cualquier error al leerlo se trata como false.';
COMMENT ON FUNCTION public.agenda_v2_encendida(uuid) IS
  'La única lectura común del interruptor de la agenda v2 de una clínica. Sin fila = false (falla cerrado). INVOKER a propósito: con la sesión lee con la RLS de agenda_ajustes (sólo la clínica propia); dentro de una SECURITY DEFINER, como su dueño. No la hagas DEFINER. Sin EXECUTE para anon.';

DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_clinicas_agenda_ajustes ON public.clinicas;
  DROP FUNCTION IF EXISTS public.agenda_ajustes_de_clinica_nueva();
  ALTER TABLE public.agenda_ajustes ALTER COLUMN agenda_v2_encendida SET DEFAULT false;
END $$;

DO $$
BEGIN
  IF public.agenda_v2_encendida('00000000-0000-0000-0000-000000000000'::uuid) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: agenda_v2_encendida no devuelve false sin fila.';
  END IF;
  IF has_function_privilege('anon', 'public.agenda_v2_encendida(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.agenda_v2_encendida(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.agenda_v2_encendida(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: los privilegios de agenda_v2_encendida cambiaron.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'disparador y función de M3 que quedan' AS comprobacion,
         ((SELECT count(*) FROM pg_trigger WHERE tgrelid = to_regclass('public.clinicas') AND tgname = 'trg_clinicas_agenda_ajustes')
          + (to_regprocedure('public.agenda_ajustes_de_clinica_nueva()') IS NOT NULL)::int)::text AS valor,
         '0' AS esperado
  UNION ALL
  SELECT 2, 'agenda_ajustes.agenda_v2_encendida: DEFAULT',
         (SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
           WHERE a.attrelid = to_regclass('public.agenda_ajustes') AND a.attname = 'agenda_v2_encendida'),
         'false'
  UNION ALL
  SELECT 3, 'agenda_v2_encendida: cuerpo de F1 / sin fila',
         (SELECT (md5(replace(p.prosrc, E'\r\n', E'\n')) = '18288c1dd2adc17c6ef0b88ee701942b')::text || '/'
                 || public.agenda_v2_encendida('00000000-0000-0000-0000-000000000000'::uuid)::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.agenda_v2_encendida(uuid)')),
         'true/false'
  UNION ALL
  SELECT 4, 'filas de agenda_ajustes: total / con la v2 encendida (no se tocan)',
         (SELECT count(*)::text || ' / ' || count(*) FILTER (WHERE agenda_v2_encendida)::text FROM public.agenda_ajustes), NULL
) t
ORDER BY t.n;
