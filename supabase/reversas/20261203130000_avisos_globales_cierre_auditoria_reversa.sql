-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de MA (20261203130000_avisos_globales_cierre_auditoria.sql)
-- NO es una migración: vive fuera de supabase/migrations/. Se corre a mano y
-- SÓLO si Angel lo pide.
-- ═══════════════════════════════════════════════════════════════════════
-- QUÉ HACE: devuelve aviso_visto_hasta_sellar(), avisos_revisar_todos(timestamptz)
--   y aviso_clinica_de_cambio_medico() al cuerpo de M1, byte a byte (los tres
--   bloques de abajo están COPIADOS de 20261202120000_avisos_globales_modelo.sql;
--   su huella es la que exige el pre-vuelo de MA), y borra
--   avisos_transaccion_mas_antigua().
-- QUÉ VUELVE: los hallazgos 2 y 4 de la tercera auditoría de M1 («Marcar todos»
--   puede tragarse un aviso cuya transacción no había confirmado; reasignar una
--   cita espera sin límite por sus avisos).
-- QUÉ NO DESHACE: el relleno de avisos_clinica.medico_id (hallazgo 1). La copia
--   rellenada es correcta también para M1; vaciarla sólo volvería lenta la
--   lectura. No toca ninguna otra fila.
-- ORDEN EN LA CADENA: antes que la de M2 y la de M1 (reescribe funciones de M1).
--   Respecto de M3 es indiferente: no comparten objetos.
-- GUARDA DE DATOS: no tiene; nunca se niega por datos.
-- SEGUNDA PASADA: no hace nada distinto y sale bien (CREATE OR REPLACE, IF EXISTS).
-- Ensayo: stack local, 2026-11-25: ida, reversa, ida otra vez.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.avisos_vistos_hasta') IS NULL
     OR to_regprocedure('public.avisos_revisar_todos(timestamptz)') IS NULL
     OR to_regprocedure('public.aviso_visto_hasta_sellar()') IS NULL
     OR to_regprocedure('public.aviso_clinica_de_cambio_medico()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no están los objetos de M1 (ya deshecha): esta reversa no tiene nada que devolver.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.aviso_visto_hasta_sellar()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.hasta := least(coalesce(NEW.hasta, clock_timestamp()), clock_timestamp());
  IF TG_OP = 'UPDATE' THEN NEW.hasta := greatest(OLD.hasta, NEW.hasta); END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.avisos_revisar_todos(p_hasta timestamptz)
 RETURNS boolean
 LANGUAGE sql
 VOLATILE
 SET search_path TO ''
AS $function$
  INSERT INTO public.avisos_vistos_hasta AS x (usuario_id, clinica_id, hasta)
  VALUES (auth.uid(), public.get_clinica_id(), p_hasta)
  ON CONFLICT (usuario_id) DO UPDATE SET clinica_id = EXCLUDED.clinica_id, hasta = EXCLUDED.hasta
  RETURNING true
$function$;

CREATE OR REPLACE FUNCTION public.aviso_clinica_de_cambio_medico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  BEGIN
    UPDATE public.avisos_clinica a SET medico_id = NEW.medico_id
     WHERE a.cita_id = NEW.id AND a.clinica_id = NEW.clinica_id AND a.medico_id IS DISTINCT FROM NEW.medico_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aviso_clinica_de_cambio_medico: médico de los avisos no actualizado (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NULL;
END
$function$;

COMMENT ON FUNCTION public.avisos_revisar_todos(timestamptz) IS
  'Avisos globales: «Marcar todos como revisados» para quien llama: su marca de agua en avisos_vistos_hasta (hasta = p_hasta o ahora; nunca hacia atrás). Cubre también lo que la lista no enseña (más allá del tope o de la ventana). INVOKER, bajo RLS. Sólo authenticated.';

DROP FUNCTION IF EXISTS public.avisos_transaccion_mas_antigua();

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'avisos_transaccion_mas_antigua quitada' AS comprobacion,
         (to_regprocedure('public.avisos_transaccion_mas_antigua()') IS NULL)::text AS valor, 'true' AS esperado
  UNION ALL
  SELECT 2, 'las tres funciones, con el cuerpo de M1',
         (SELECT count(*)::text FROM pg_proc p
           WHERE (p.oid, md5(replace(p.prosrc, E'\r\n', E'\n'))) IN (
                   (to_regprocedure('public.aviso_visto_hasta_sellar()'), '839f7457daa2d7c618daaea254106d7e'),
                   (to_regprocedure('public.avisos_revisar_todos(timestamptz)'), '5e1f662fee337d583e590d377425aec4'),
                   (to_regprocedure('public.aviso_clinica_de_cambio_medico()'), '200f5f6fec02d59bea2e51686ebf3a43'))),
         '3'
  UNION ALL
  SELECT 3, 'avisos_revisar_todos: quién la ejecuta (anon/authenticated/service_role)',
         (SELECT string_agg(has_function_privilege(r, 'public.avisos_revisar_todos(timestamptz)', 'EXECUTE')::text, '/')
            FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) WITH ORDINALITY AS x(r, o)),
         'false/true/false'
) t
ORDER BY t.n;
