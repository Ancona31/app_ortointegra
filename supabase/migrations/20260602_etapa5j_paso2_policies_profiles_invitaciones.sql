-- ═══════════════════════════════════════════════════════════
-- Etapa 5.J — Paso 2: Limpieza menor profiles + invitaciones
-- (consolidación de policies + naming uniforme + endurecimiento)
-- Aplicado a producción: 2026-06-02
-- ═══════════════════════════════════════════════════════════
-- Reemplaza 7 policies actuales (4 profiles + 3 invitaciones) por 5
-- policies nuevas con naming uniforme tabla_operacion y predicados
-- endurecidos.
--
-- Contexto de seguridad: aplicada DESPUÉS del cierre del auditor de
-- seguridad (2026-06-02) que eliminó la ruta muerta complete-registro
-- (commit 8c3c007) y aplicó el trigger guardián de columnas sensibles
-- en profiles (migración 20260602_sec_proteger_columnas_sensibles_profiles.sql).
-- El trigger guardián congela role, clinica_id y es_admin_de_clinica
-- para auth.uid() IS NOT NULL, cerrando las vulnerabilidades 🔴
-- cross-tenant detectadas durante el diseño de 5.J.
--
-- D-5.J-PROFILES-SELECT: 3 ramas — propio OR admin OR secretaria, dentro
-- del tenant. Permite que admin y secretaria vean perfiles de su clínica
-- (necesario para listado de equipo, validación server-side de medico_id,
-- JOINs con nombres de médicos); médico invitado solo ve su propio perfil.
--
-- D-5.J-PROFILES-UPDATE: 2 ramas — propio OR admin, dentro del tenant.
-- USING + WITH CHECK idénticos. La defensa contra escalada de tenant
-- via UPDATE de clinica_id tiene DOS capas complementarias:
-- (1) WITH CHECK a nivel de fila: un admin no puede reasignar clinica_id
--     de perfil AJENO a otra clínica.
-- (2) Trigger guardián a nivel de columna
--     (20260602_sec_proteger_columnas_sensibles_profiles.sql): congela
--     role, clinica_id y es_admin_de_clinica para auth.uid() IS NOT NULL.
--     Cierra el hueco que la rama "OR id=auth.uid()" del WITH CHECK
--     dejaba abierto para auto-reasignación.
-- Sin rama secretaria: secretaria no gestiona personal, eso es del admin.
--
-- D-5.J-INVITACIONES-ROL: las 3 policies viejas (admin_select_invitaciones,
-- admin_insert_invitaciones, admin_delete_invitaciones) tenían un bug
-- histórico: prefijo "admin_" engañoso porque ninguna validaba rol. Las
-- nuevas (invitaciones_select/insert/delete) validan explícitamente con
-- soy_admin_de_clinica(). Cero call sites TS-side actuales: el flujo real
-- de "agregar usuario" es via /api/admin/crear-usuario (endpoint directo
-- con admin client + service_role). La tabla queda endurecida para el
-- futuro flujo de invitación si se implementa.
--
-- D-5.J-PUBLIC→AUTHENTICATED: las 2 policies legacy de profiles
-- ("Actualizar propio perfil" y "Ver perfiles de la misma clinica") eran
-- TO public, semánticamente neutras (su predicado igualmente exigía
-- auth.uid()), pero conviene formalizar TO authenticated (D8).
--
-- D-5.J-GET-SUSCRIPCION: get_suscripcion_estado() (baseline
-- 05_functions.sql:60-67) se conserva intencionalmente sin cambio (D9).
-- Función huérfana sin call sites actuales pero útil para Etapa 6 /
-- queries de auditoría. NO se toca en esta migración.
--
-- D-5.J-SUPER-ADMIN: no se agrega rama explícita. Super_admin opera via
-- service_role (Mecanismo 1, ya operativo en /api/super-admin/**).
-- Caso edge del super_admin con clinica_id=NULL: la rama id=auth.uid()
-- en SELECT permite que se vea a sí mismo; para todo lo demás opera por
-- service_role. UPDATE: el super_admin único en producción puede editar
-- su propio perfil via rama id=auth.uid(); no necesita acceso a perfiles
-- ajenos via client de usuario.
--
-- Sin cambios de schema (no se agregan ni eliminan columnas).
-- Sin cambios de helpers (los 3 ya en producción se reutilizan).
-- Sin cambios de código TypeScript (5.J no toca src/).

BEGIN;

-- ─── PRE-FLIGHT ──────────────────────────────────────────────
DO $$
DECLARE
  v_profiles_viejas int;
  v_invitaciones_viejas int;
BEGIN
  -- Validar RLS habilitada en ambas tablas
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'profiles'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: RLS no está habilitada en public.profiles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'invitaciones'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: RLS no está habilitada en public.invitaciones';
  END IF;

  -- Validar conteo de policies viejas en profiles (4 esperadas)
  SELECT count(*) INTO v_profiles_viejas
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'profiles'
    AND cls.relnamespace = 'public'::regnamespace
    AND pol.polname IN (
      'Actualizar propio perfil',
      'Ver perfiles de la misma clinica',
      'profiles_select_own',
      'profiles_update_own'
    );

  IF v_profiles_viejas <> 4 THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: se esperaban 4 policies viejas en profiles, se encontraron %', v_profiles_viejas;
  END IF;

  -- Validar conteo de policies viejas en invitaciones (3 esperadas)
  SELECT count(*) INTO v_invitaciones_viejas
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'invitaciones'
    AND cls.relnamespace = 'public'::regnamespace
    AND pol.polname IN (
      'admin_select_invitaciones',
      'admin_insert_invitaciones',
      'admin_delete_invitaciones'
    );

  IF v_invitaciones_viejas <> 3 THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: se esperaban 3 policies viejas en invitaciones, se encontraron %', v_invitaciones_viejas;
  END IF;

  -- Validar helpers existentes
  IF to_regprocedure('public.get_clinica_id()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.get_clinica_id() no existe';
  END IF;
  IF to_regprocedure('public.get_my_role()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.get_my_role() no existe';
  END IF;
  IF to_regprocedure('public.soy_admin_de_clinica()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.soy_admin_de_clinica() no existe';
  END IF;

  -- Validar que get_suscripcion_estado() sigue viva (D9: conservar)
  IF to_regprocedure('public.get_suscripcion_estado()') IS NULL THEN
    RAISE EXCEPTION 'PRE-FLIGHT FAIL: función public.get_suscripcion_estado() debería conservarse (D9)';
  END IF;

  RAISE NOTICE 'PRE-FLIGHT OK: 7 policies viejas presentes, 3 helpers + get_suscripcion_estado disponibles, RLS habilitada en ambas tablas';
END $$;

-- ─── DROP de las 7 policies viejas ───────────────────────────
-- profiles (4 policies con naming heterogéneo)
DROP POLICY IF EXISTS "Actualizar propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Ver perfiles de la misma clinica" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

-- invitaciones (3 policies admin_* con bug histórico de naming)
DROP POLICY IF EXISTS admin_select_invitaciones ON public.invitaciones;
DROP POLICY IF EXISTS admin_insert_invitaciones ON public.invitaciones;
DROP POLICY IF EXISTS admin_delete_invitaciones ON public.invitaciones;

-- ─── CREATE de las 2 policies nuevas en profiles ─────────────

-- 3 ramas: propio perfil OR admin de la clínica OR secretaria, dentro
-- del tenant. Cubre flujos de listado de equipo, validación de medico_id
-- server-side, JOINs con nombres en consultas/citas.
CREATE POLICY profiles_select
  ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (
      id = auth.uid()
      OR public.soy_admin_de_clinica()
      OR public.get_my_role() = 'secretaria'
    )
    AND (
      clinica_id = public.get_clinica_id()
      OR id = auth.uid()
    )
  );

-- 2 ramas: propio perfil OR admin. USING + WITH CHECK idénticos.
-- Defensa en profundidad combinada con el trigger guardián de columnas
-- sensibles (20260602): WITH CHECK previene reasignación de clinica_id
-- de perfiles ajenos; el trigger guardián previene auto-reasignación de
-- clinica_id propio.
CREATE POLICY profiles_update
  ON public.profiles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    (id = auth.uid() OR public.soy_admin_de_clinica())
    AND (clinica_id = public.get_clinica_id() OR id = auth.uid())
  )
  WITH CHECK (
    (id = auth.uid() OR public.soy_admin_de_clinica())
    AND (clinica_id = public.get_clinica_id() OR id = auth.uid())
  );

-- ─── CREATE de las 3 policies nuevas en invitaciones ─────────

-- Solo admin: cierra el bug histórico de las admin_* del baseline que no
-- validaban rol pese al prefijo. Sin call sites TS-side actuales.
CREATE POLICY invitaciones_select
  ON public.invitaciones
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    clinica_id = public.get_clinica_id()
    AND public.soy_admin_de_clinica()
  );

CREATE POLICY invitaciones_insert
  ON public.invitaciones
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinica_id = public.get_clinica_id()
    AND public.soy_admin_de_clinica()
  );

CREATE POLICY invitaciones_delete
  ON public.invitaciones
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    clinica_id = public.get_clinica_id()
    AND public.soy_admin_de_clinica()
  );

-- ─── POST-FLIGHT (IS DISTINCT FROM con normalización de colación) ─
DO $$
DECLARE
  v_esperadas_profiles     text[] := ARRAY['profiles_select', 'profiles_update'];
  v_esperadas_invitaciones text[] := ARRAY['invitaciones_delete', 'invitaciones_insert', 'invitaciones_select'];
  v_actuales_profiles      text[];
  v_actuales_invitaciones  text[];
BEGIN
  SELECT array_agg(pol.polname ORDER BY pol.polname) INTO v_actuales_profiles
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'profiles'
    AND cls.relnamespace = 'public'::regnamespace;

  IF v_actuales_profiles IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(v_esperadas_profiles) x) THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: policies en profiles = %, esperado %', v_actuales_profiles, v_esperadas_profiles;
  END IF;

  SELECT array_agg(pol.polname ORDER BY pol.polname) INTO v_actuales_invitaciones
  FROM pg_policy pol
  JOIN pg_class cls ON cls.oid = pol.polrelid
  WHERE cls.relname = 'invitaciones'
    AND cls.relnamespace = 'public'::regnamespace;

  IF v_actuales_invitaciones IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(v_esperadas_invitaciones) x) THEN
    RAISE EXCEPTION 'POST-FLIGHT FAIL: policies en invitaciones = %, esperado %', v_actuales_invitaciones, v_esperadas_invitaciones;
  END IF;

  RAISE NOTICE 'POST-FLIGHT OK: 2 policies en profiles, 3 en invitaciones, sin extras';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK (DOWN) — referencia, no se ejecuta
-- ═══════════════════════════════════════════════════════════
-- Restaura el estado pre-5.J: drop las 5 nuevas, recrea las 7 viejas
-- semánticamente equivalentes al estado real de producción (post b2_02 +
-- etapa1 + etapa4a8). NOTA: la policy "Ver perfiles de la misma clinica"
-- se restaura con get_clinica_id() (NO get_my_clinica_id, que ya fue
-- eliminada en b2_02 y NO se recreará en el rollback porque revertir esa
-- consolidación está fuera de scope de 5.J).
--
-- BEGIN;
--
-- DROP POLICY IF EXISTS profiles_select        ON public.profiles;
-- DROP POLICY IF EXISTS profiles_update        ON public.profiles;
-- DROP POLICY IF EXISTS invitaciones_select    ON public.invitaciones;
-- DROP POLICY IF EXISTS invitaciones_insert    ON public.invitaciones;
-- DROP POLICY IF EXISTS invitaciones_delete    ON public.invitaciones;
--
-- CREATE POLICY "Actualizar propio perfil"
--   ON public.profiles FOR UPDATE TO public
--   USING (id = auth.uid());
--
-- CREATE POLICY "Ver perfiles de la misma clinica"
--   ON public.profiles FOR SELECT TO public
--   USING ((clinica_id = public.get_clinica_id()) OR (id = auth.uid()));
--
-- CREATE POLICY profiles_select_own
--   ON public.profiles FOR SELECT TO authenticated
--   USING (id = auth.uid());
--
-- CREATE POLICY profiles_update_own
--   ON public.profiles FOR UPDATE TO authenticated
--   USING (id = auth.uid())
--   WITH CHECK (id = auth.uid());
--
-- CREATE POLICY admin_select_invitaciones
--   ON public.invitaciones FOR SELECT TO authenticated
--   USING (clinica_id = public.get_clinica_id());
--
-- CREATE POLICY admin_insert_invitaciones
--   ON public.invitaciones FOR INSERT TO authenticated
--   WITH CHECK (clinica_id = public.get_clinica_id());
--
-- CREATE POLICY admin_delete_invitaciones
--   ON public.invitaciones FOR DELETE TO authenticated
--   USING (clinica_id = public.get_clinica_id());
--
-- COMMIT;
