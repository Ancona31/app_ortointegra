-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda K, agente K2 (punto 10 de Angel) — los 30 s entre dos
-- códigos se cuentan POR ENLACE Y CORREO, no por correo en todo Spinus
-- Rama: feature/agenda-v2-k2 · Escrita: 2026-11-18
-- Riesgo estimado: BAJO (una función nueva de sólo lectura, sólo
-- service_role. Ninguna tabla, columna, fila, índice ni policy cambia).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de esta cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (justo después de
--   20261123130000_agenda_k2_espera_codigo; con el conjunto de la agenda v2).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- 20261123130000 contaba los 30 s con `rate_limit_espera` sobre la llave
-- del límite por correo (`reserva:codigo:correo:<hmac>`), que es GLOBAL: no
-- lleva enlace ni clínica. Una revisión de seguridad lo marcó (MEDIA, fuga
-- entre clínicas): con el enlace de OTRA clínica, pedir un código con el
-- correo de alguien y leer `espera_reenvio` con su tiempo decía si esa
-- persona había pedido un código en cualquier enlace en los últimos 30 s.
-- Ahora la espera sale de `reserva_verificaciones`, que ya está atada a
-- (clinica_id, enlace_id, correo_hmac) y tiene índice justo para eso
-- (`reserva_verificaciones_busqueda`): el último código EMITIDO a ese
-- correo EN ESE ENLACE. Desde otro enlace, la espera es 0.
-- El tope global de 3 códigos por correo por hora NO cambia (sigue en
-- `LIMITES`, contado por `rate_limit_intento`).
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- public.reserva_espera_reenvio(p_clinica_id uuid, p_enlace_id uuid,
--   p_correo_hmac text, p_segundos integer) → integer (segundos que faltan
--   para poder emitir otro código a ese correo en ese enlace; 0 si ya).
--   NUEVA. STABLE, INVOKER, search_path vacío, SÓLO service_role. Filtra
--   SIEMPRE por clinica_id y enlace_id (CLAUDE.md, aislamiento). No escribe.
-- `rate_limit_espera` (130000) se queda: la siguen usando los Retry-After
--   de los 429 de los límites de `LIMITES`.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere D3 (reserva_verificaciones). Bloqueos: ninguno sobre tablas.
-- Orden respecto al código: MIGRACIÓN PRIMERO.
--   · Código nuevo, base sin esto: la RPC no existe → la espera es «no se
--     sabe» (null): el reenvío dentro de los 30 s no se frena en el servidor
--     (sí en la página) y el tope de 3 por hora sigue igual. Nada falla.
--   · Código viejo, base con esto: nadie la llama.
-- Alcance de los roles:
--   gana — service_role: saber cuánto falta para reenviar en un enlace.
--   pierde — nada.
-- Contrato con spinus-consola: función nueva; nada que la consola lea cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP FUNCTION IF EXISTS public.reserva_espera_reenvio(uuid, uuid, text, integer);
--
-- ═══ AUDITORÍA INDEPENDIENTE (2026-11-18, con supabase/AUDITORIA-MIGRACIONES.md) ═══
-- APTA, sin cambios obligatorios; las tres observaciones leves, aplicadas:
-- (1) `least(p_segundos, …)`: created_at lo sella clock_timestamp() y podía
-- dar 31 s; (2) el COMMENT dice lo que sí revela en el MISMO enlace (un bit,
-- 30 s; aceptado); (3) la fila 4 de la rejilla pasa a INFO (no depende de
-- 130000). Índice comprobado con EXPLAIN: Index Only Scan de
-- reserva_verificaciones_busqueda. Revisión de seguridad aparte de la ruta
-- /codigo: APROBADO (fuga entre clínicas cerrada, sin límites relajados).
--
-- ═══ APLICACIÓN LOCAL (2026-11-18, base de Docker, nunca producción) ═══
-- Ensayo con ROLLBACK: nada quedó (1-3 REVISAR). Dos pasadas reales: 1-3
-- OK (la segunda, replay sin cambios). Prueba:
-- supabase/pruebas-sql/k2_espera_codigo.sql (caso 5c y permisos del 6).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.reserva_verificaciones') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta reserva_verificaciones (D3).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.reserva_verificaciones'::regclass AND NOT attisdropped
        AND (attname, atttypid::regtype) IN (('clinica_id', 'uuid'::regtype), ('enlace_id', 'uuid'::regtype),
                                             ('correo_hmac', 'text'::regtype), ('created_at', 'timestamptz'::regtype))) <> 4 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_verificaciones sin clinica_id/enlace_id uuid, correo_hmac text o created_at timestamptz.';
  END IF;
  IF to_regclass('public.reserva_verificaciones_busqueda') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta el índice reserva_verificaciones_busqueda (D3).';
  END IF;
  -- INVOKER: service_role necesita saltarse la RLS y SELECT sobre la tabla.
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false)
     OR NOT has_table_privilege('service_role', 'public.reserva_verificaciones', 'SELECT') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no se salta la RLS o no tiene SELECT en reserva_verificaciones.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.reserva_espera_reenvio(uuid, uuid, text, integer)') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_espera_reenvio ya existe como SECURITY DEFINER.';
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 2 · La función.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserva_espera_reenvio(
  p_clinica_id uuid, p_enlace_id uuid, p_correo_hmac text, p_segundos integer)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_sale timestamptz;
BEGIN
  IF p_clinica_id IS NULL OR p_enlace_id IS NULL OR p_correo_hmac IS NULL OR p_segundos IS NULL OR p_segundos < 1 THEN
    RAISE EXCEPTION 'reserva_espera_reenvio: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT r.created_at + make_interval(secs => p_segundos) INTO v_sale
    FROM public.reserva_verificaciones r
   WHERE r.clinica_id = p_clinica_id AND r.enlace_id = p_enlace_id AND r.correo_hmac = p_correo_hmac
   ORDER BY r.created_at DESC
   LIMIT 1;
  IF v_sale IS NULL OR v_sale <= now() THEN
    RETURN 0;
  END IF;
  -- `least`: created_at lo sella clock_timestamp() en otra transacción y puede ir por delante de now() (auditoría 1).
  RETURN least(p_segundos, greatest(1, ceil(extract(epoch FROM v_sale - now()))::integer));
END
$fn$;

COMMENT ON FUNCTION public.reserva_espera_reenvio(uuid, uuid, text, integer) IS
  'Tanda K (K2, punto 10): segundos que faltan para poder emitir otro código a ese correo EN ESE ENLACE (p_segundos desde el último emitido; 0 = ya). Filtra por clinica_id y enlace_id: desde otro enlace no revela nada; desde ESE enlace sí dice, durante 30 s, que ese correo pidió un código ahí (aceptado: un bit, una ventana de 30 s, tras los límites de IP y dispositivo, y sondear sin espera manda un código al titular). No escribe; consulta NO atómica (dos peticiones simultáneas pueden pasar las dos; el tope de 3 por correo por hora, en rate_limit_intento, sí lo es). Sólo service_role.';

-- Permisos de funciones (CLAUDE.md). SÓLO service_role: la llama la ruta
-- pública del código con createAdminClient(); ni la consola ni las sesiones.
REVOKE EXECUTE ON FUNCTION public.reserva_espera_reenvio(uuid, uuid, text, integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_espera_reenvio(uuid, uuid, text, integer) TO service_role;

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'reserva_espera_reenvio: INVOKER / STABLE / search_path vacío' AS comprobacion,
         coalesce((SELECT (NOT p.prosecdef)::text || ' / ' || (p.provolatile = 's')::text || ' / ' || (p.proconfig @> ARRAY['search_path=""'])::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_espera_reenvio(uuid, uuid, text, integer)')), 'AUSENTE') AS valor,
         'true / true / true' AS esperado
  UNION ALL
  SELECT 2, 'EXECUTE: anon / authenticated / service_role',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ' / ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_espera_reenvio(uuid, uuid, text, integer)')), 'AUSENTE'),
         'false / false / true'
  UNION ALL
  SELECT 3, 'sin EXECUTE a PUBLIC',
         coalesce((SELECT (NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                                       WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE'))::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_espera_reenvio(uuid, uuid, text, integer)')), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 4, 'INFO: rate_limit_espera (130000) presente (no es requisito de ésta)',
         (to_regprocedure('public.rate_limit_espera(text, integer, integer)') IS NOT NULL)::text,
         NULL
) t
ORDER BY t.n;
