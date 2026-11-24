-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de M2 (20261202130000_avisos_globales_rsvp_rechazo.sql)
-- NO es una migración: vive fuera de supabase/migrations/. Se corre a mano y
-- SÓLO si Angel lo pide.
-- ═══════════════════════════════════════════════════════════════════════
-- QUÉ HACE: borra public.cita_rsvp_google_rechazo. Nada más.
-- QUÉ SE PIERDE: el «No» de Google vuelve a no hacer nada (el código recibe
--   PGRST202 y sigue). Las citas que ya se cancelaron por un «No» se quedan
--   canceladas, con su aviso y su auditoría: no se reabre nada.
-- ORDEN EN LA CADENA: antes que la reversa de M1 (M2 exige M1, no al revés).
-- GUARDA DE DATOS: no tiene; no toca filas y nunca se niega por datos.
-- SEGUNDA PASADA: no hace nada y sale bien (IF EXISTS).
-- Ensayo: stack local, 2026-11-24: ida, reversa, ida otra vez.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DROP FUNCTION IF EXISTS public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[]);

COMMIT;

SELECT 1 AS n, 'cita_rsvp_google_rechazo quitada' AS comprobacion,
       (to_regprocedure('public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])') IS NULL)::text AS valor, 'true' AS esperado,
       CASE WHEN to_regprocedure('public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])') IS NULL THEN 'OK' ELSE 'REVISAR' END AS estado;
