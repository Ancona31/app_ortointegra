-- ══════════════════════════════════════════════════════════════════
-- REVERSA de BASE-2 · B1 (20261208120000_gcal_quitar_cancelada.sql)
-- NO es una migración: vive fuera de supabase/migrations/. Se corre a mano y
-- SÓLO si Angel lo pide.
-- ══════════════════════════════════════════════════════════════════
-- QUÉ HACE: borra public.gcal_cita_quitar_cancelada(uuid, uuid, text, text).
-- QUÉ VUELVE: con el código que la llama desplegado, la sincronización de una
--   clínica se queda SIN AVANZAR (sin error: «no disponible») en la página en
--   la que Google informe del borrado del evento de una cita cancelada, hasta
--   que la función vuelva. Con el código anterior (d08ad0a3 o antes), nada.
-- QUÉ NO VUELVE: las citas que la función ya cerró siguen cerradas (una cerrada
--   no se reabre; sólo postgres, a mano).
-- ORDEN EN LA CADENA: independiente de B2 y B3. Antes que F5b y que F2.
-- GUARDA DE DATOS: no tiene; no toca filas y nunca se niega por datos.
-- SEGUNDA PASADA: no hace nada y sale bien (IF EXISTS).
-- Bloqueos: sólo catálogo.
-- Ensayo: stack local, 2026-11-27: ida, reversa, ida otra vez.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay que correrla como postgres (current_user es %).', current_user;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.gcal_cita_quitar_cancelada(uuid, uuid, text, text);

DO $$
BEGIN
  IF to_regprocedure('public.gcal_cita_quitar_cancelada(uuid, uuid, text, text)') IS NOT NULL THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: la función sigue ahí.';
  END IF;
END $$;

COMMIT;

SELECT 1 AS n, 'gcal_cita_quitar_cancelada ya no existe' AS comprobacion,
       (to_regprocedure('public.gcal_cita_quitar_cancelada(uuid, uuid, text, text)') IS NULL)::text AS valor, 'true' AS esperado,
       CASE WHEN to_regprocedure('public.gcal_cita_quitar_cancelada(uuid, uuid, text, text)') IS NULL THEN 'OK' ELSE 'REVISAR' END AS resultado;
