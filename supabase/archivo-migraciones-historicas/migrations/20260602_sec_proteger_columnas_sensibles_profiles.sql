-- ============================================================
-- SEC — Trigger guardián de columnas sensibles en public.profiles
-- Fecha: 2026-06-02 · Protocolo D-T6
--
-- ⚠️  YA APLICADO EN PRODUCCIÓN el 2026-06-02 — NO re-ejecutar.
--     Aplicado vía SQL Editor del dashboard (Protocolo D-T6, NO
--     Supabase CLI). Este archivo es un REGISTRO DOCUMENTAL del SQL
--     ya ejecutado, no una migración pendiente.
-- ============================================================
-- QUÉ CIERRA
-- Tres vulnerabilidades cross-tenant 🔴 explotables hoy vía PostgREST
-- directo (supabase.from('profiles').update(...) con la anon key /
-- sesión authenticated), porque las policies RLS de UPDATE de profiles
-- solo restringen la FILA (id = auth.uid()) y NO las columnas:
--   1.2 — auto-promoción a super_admin   (UPDATE profiles SET role='super_admin')
--   1.1 — reasignación de clinica_id     (UPDATE profiles SET clinica_id=<otra>)
--   1.3 — auto-promoción es_admin_de_clinica (UPDATE profiles SET es_admin_de_clinica=true)
--
-- POR QUÉ UN TRIGGER (y no un GRANT/REVOKE de columna)
-- El rol authenticated tiene privilegio UPDATE a nivel TABLA sobre
-- profiles (confirmado vía information_schema.column_privileges), por lo
-- que revocar columna por columna no es viable sin romper el UPDATE
-- legítimo del resto de campos. El trigger BEFORE UPDATE discrimina por
-- columna y por invocador, sin tocar privilegios.
--
-- MECANISMO
--   - Exenta al service_role: cuando auth.uid() IS NULL (sin JWT, es
--     decir admin client / service_role / migraciones), RETURN NEW —
--     no bloquea. Los únicos writes legítimos a esas 3 columnas
--     (registro, crear-usuario, backfills) corren con service_role.
--   - Rechaza al authenticated: si auth.uid() NO es NULL y cualquiera
--     de las 3 columnas cambia de valor (IS DISTINCT FROM, así un no-op
--     con valor idéntico NO se bloquea), aborta con RAISE EXCEPTION.
--
-- VALIDACIÓN REALIZADA AL APLICAR (2026-06-02)
--   - PRE-FLIGHT: 0 triggers previos sobre public.profiles.
--   - POST-FLIGHT: trigger creado y habilitado (pg_trigger, tgenabled).
--   - 4 smoke tests en transacciones revertidas (ROLLBACK):
--       a) ataque authenticated (cambio de role) → RECHAZADO (P0001).
--       b) cambio legítimo authenticated (otra columna, p.ej. nombre) → OK.
--       c) service_role con cambio REAL de las 3 columnas → EXENTO, OK.
--       d) no-op (mismo valor en las 3 columnas) → OK (no dispara excepción).
--
-- DEUDA RELACIONADA
--   El trigger es BEFORE UPDATE. Hoy NO existe policy de INSERT para
--   authenticated en profiles (solo service_role inserta), así que el
--   vector de creación de filas con role/clinica_id arbitrarios está
--   cerrado por RLS. SI EN EL FUTURO se agrega una policy INSERT para
--   authenticated, replicar esta protección en un trigger BEFORE INSERT.
-- ============================================================

-- ---------- UP (SQL literal aplicado) ----------
CREATE OR REPLACE FUNCTION public.proteger_columnas_sensibles_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No autorizado: no puede modificar role, clinica_id ni es_admin_de_clinica';
  END IF;
  IF NEW.clinica_id IS DISTINCT FROM OLD.clinica_id THEN
    RAISE EXCEPTION 'No autorizado: no puede modificar role, clinica_id ni es_admin_de_clinica';
  END IF;
  IF NEW.es_admin_de_clinica IS DISTINCT FROM OLD.es_admin_de_clinica THEN
    RAISE EXCEPTION 'No autorizado: no puede modificar role, clinica_id ni es_admin_de_clinica';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proteger_columnas_sensibles_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_columnas_sensibles_profiles();

-- ---------- DOWN (rollback) — referencia, no se ejecuta ----------
-- ROLLBACK:
-- DROP TRIGGER IF EXISTS trg_proteger_columnas_sensibles_profiles ON public.profiles;
-- DROP FUNCTION IF EXISTS public.proteger_columnas_sensibles_profiles();
