-- =============================================================================
-- 20260427_b1_01_clinicas_rls.sql
--
-- Propósito:
--   Cerrar la fuga de datos comerciales cross-clínica añadiendo una policy
--   SELECT en `public.clinicas` que filtre por `clinica_id` del usuario, con
--   excepción explícita para `super_admin` (que necesita ver todas las
--   clínicas en el dashboard global).
--
-- Hallazgo Fase A que corrige:
--   C2 — `RLS de clinicas permite SELECT a cualquier authenticated`
--   (docs/schema-recovery-report-final.md líneas 100-106).
--   La única policy actual `"Usuarios ven su clinica"` es
--     FOR SELECT TO public USING (auth.uid() IS NOT NULL)
--   y expone columnas comerciales (plan, suscripcion_estado,
--   stripe_customer_id, max_pacientes, horario_consulta, suspendida) de
--   TODAS las clínicas a cualquier usuario autenticado.
--
-- Riesgo estimado: BAJO en aplicación, MEDIO en efecto real.
--   - BAJO en aplicación: añade una policy nueva, no modifica las
--     existentes. No bloquea endpoints actuales: las rutas server-side
--     usan `admin` client (service_role) que bypasa RLS, y las rutas que
--     leen con cliente normal filtran por `id = profile.clinica_id` (que
--     ahora también es lo que la policy exige).
--   - MEDIO en efecto: mientras la policy laxa
--     `"Usuarios ven su clinica"` siga viva, Postgres aplica OR entre
--     policies del mismo comando, así que la nueva policy NO cierra la
--     fuga por sí sola. Cierre real ocurre en B2 cuando se elimine la
--     policy laxa (consolidación de policies legacy {public}).
--
-- Dependencia conocida con B2:
--   Esta migración prepara la policy correcta pero NO resuelve C2 hasta
--   que B2 elimine la policy laxa heredada. Documentado para evitar la
--   ilusión de cierre.
--
-- Decisión de diseño aplicada (presentar en reporte):
--   super_admin obtiene SELECT sobre TODAS las clínicas vía rama OR.
--   Razón: el dashboard global de super-admin (§3 listas de clínicas en
--   /super-admin/dashboard) necesita ver todas; sin esa rama habría que
--   forzar service_role en endpoints que hoy podrían cambiarse al
--   cliente del usuario. Si el usuario prefiere que super_admin pase
--   solo por service_role, eliminar la rama OR.
--
-- Smoke tests recomendados (post-aplicación, en SQL Editor):
--   1) SELECT polname, polroles::regrole[], polqual
--        FROM pg_policies pp
--        JOIN pg_policy p ON p.oid = (
--          SELECT oid FROM pg_policy
--          WHERE polrelid = 'public.clinicas'::regclass
--            AND polname = 'clinicas_select_own_or_super_admin'
--        )
--        WHERE pp.tablename = 'clinicas';
--      → Confirmar que la policy nueva existe.
--   2) Como médico autenticado:
--        SELECT count(*) FROM public.clinicas;
--      → Si la policy laxa SIGUE viva (B2 sin aplicar): devuelve N (todas).
--      → Si la policy laxa YA SE ELIMINÓ (B2 aplicado): devuelve 1 (solo
--        la del médico).
--   3) Como super_admin autenticado:
--        SELECT count(*) FROM public.clinicas;
--      → Devuelve N (todas), independientemente del estado de B2.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- UP
-- -----------------------------------------------------------------------------

-- Policy nueva: filtro estricto por clinica_id, con escape para super_admin.
-- IDEMPOTENTE: usa DROP IF EXISTS para permitir re-aplicación.
DROP POLICY IF EXISTS clinicas_select_own_or_super_admin ON public.clinicas;
CREATE POLICY clinicas_select_own_or_super_admin ON public.clinicas
  FOR SELECT TO authenticated
  USING (
    id = public.get_clinica_id()
    OR public.get_my_role() = 'super_admin'
  );

COMMENT ON POLICY clinicas_select_own_or_super_admin ON public.clinicas IS
  'B1: cierra fuga de datos comerciales cross-clínica. Authenticated solo ve su clínica; super_admin ve todas. Cierre real depende de B2 (eliminar policy laxa "Usuarios ven su clinica").';


-- -----------------------------------------------------------------------------
-- DOWN
-- -----------------------------------------------------------------------------
-- Inverso EXACTO: elimina solo la policy nueva. NO restaura nada porque
-- la policy laxa heredada no se tocó en UP.

-- DROP POLICY IF EXISTS clinicas_select_own_or_super_admin ON public.clinicas;


-- -----------------------------------------------------------------------------
-- Verificación post-aplicación
-- -----------------------------------------------------------------------------
-- Pegar en SQL Editor de Supabase y confirmar:
--
-- SELECT
--   polname,
--   polcmd,
--   pg_get_expr(polqual, polrelid) AS using_clause,
--   roles.rolname AS to_role
-- FROM pg_policy p
-- JOIN pg_class c ON c.oid = p.polrelid
-- LEFT JOIN LATERAL unnest(p.polroles) AS r(oid) ON TRUE
-- LEFT JOIN pg_roles roles ON roles.oid = r.oid
-- WHERE c.relname = 'clinicas'
-- ORDER BY polname, to_role;
--
-- Resultado esperado:
--   Filas para "Usuarios ven su clinica" (legacy laxa, sigue viva — B2)
--   + Filas para "clinicas_select_own_or_super_admin" con
--     using_clause = "((id = get_clinica_id()) OR (get_my_role() = 'super_admin'::text))"
--     to_role = 'authenticated'
