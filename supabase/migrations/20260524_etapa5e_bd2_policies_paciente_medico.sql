-- ═══════════════════════════════════════════════════════════
-- Etapa 5.E — Paso 1 (BD-2): policies RLS de paciente_medico
-- Aplicado a producción: 2026-05-24
-- ═══════════════════════════════════════════════════════════
-- Crea 3 policies PERMISSIVE TO authenticated en paciente_medico
-- (SELECT, INSERT, DELETE; sin UPDATE — los vínculos no se editan).
-- La tabla tenía RLS ON y 0 policies (cerrada). El flujo real de
-- creación de vínculos va por el RPC crear_paciente_con_medico
-- (SECURITY DEFINER, se salta RLS); estas policies son la red de
-- seguridad para acceso directo no-RPC.
-- Anti-recursión: usan paciente_pertenece_a_mi_clinica() (consulta
-- pacientes) — NO soy_medico_tratante() (consultaría paciente_medico).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.paciente_medico'::regclass AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'paciente_medico no tiene RLS habilitada — abortar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = 'public.paciente_medico'::regclass
  ) THEN
    RAISE EXCEPTION 'paciente_medico ya tiene policies — abortar (estado inesperado)';
  END IF;

  CREATE POLICY paciente_medico_select ON public.paciente_medico
    FOR SELECT TO authenticated
    USING (
      medico_id = auth.uid()
      OR (public.soy_admin_de_clinica()
          AND public.paciente_pertenece_a_mi_clinica(paciente_id))
    );

  CREATE POLICY paciente_medico_insert ON public.paciente_medico
    FOR INSERT TO authenticated
    WITH CHECK (
      public.paciente_pertenece_a_mi_clinica(paciente_id)
      AND (
        (public.get_my_role() = 'medico' AND medico_id = auth.uid())
        OR public.soy_admin_de_clinica()
        OR public.get_my_role() = 'secretaria'
      )
    );

  CREATE POLICY paciente_medico_delete ON public.paciente_medico
    FOR DELETE TO authenticated
    USING (
      medico_id = auth.uid()
      OR (public.soy_admin_de_clinica()
          AND public.paciente_pertenece_a_mi_clinica(paciente_id))
    );

  RAISE NOTICE 'BD-2 aplicado: 3 policies creadas en paciente_medico';
END $$;

-- ── ROLLBACK (DOWN) — referencia, no se ejecuta ──────────────
-- DROP POLICY IF EXISTS paciente_medico_select ON public.paciente_medico;
-- DROP POLICY IF EXISTS paciente_medico_insert ON public.paciente_medico;
-- DROP POLICY IF EXISTS paciente_medico_delete ON public.paciente_medico;
