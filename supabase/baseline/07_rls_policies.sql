-- =============================================================================
-- 07_rls_policies.sql
-- ENABLE RLS y CREATE POLICY para las 20 tablas del schema public.
--
-- Refleja LITERALMENTE el estado de prod (60 policies en total). El objetivo
-- de este archivo es servir de baseline reconstructivo: NO se limpian las
-- policies legacy `{public}` aquí. Esa limpieza es Fase B.
--
-- Patrón DROP POLICY IF EXISTS + CREATE POLICY para idempotencia.
-- =============================================================================


-- =============================================================================
-- ENABLE ROW LEVEL SECURITY (todas las tablas, no forzado)
-- =============================================================================

ALTER TABLE public.addendums              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analitos_catalogo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculadora_resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cat_cie10              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinicas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitaciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_rate_limits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicamentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediciones_analitos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_honorarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_arco       ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- POLICIES por tabla
-- =============================================================================


-- ----------------------------------------------------------------------------
-- addendums (2 policies — todas {authenticated})
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS addendums_insert ON public.addendums;
CREATE POLICY addendums_insert ON public.addendums
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consultas c
      JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.id = addendums.consulta_id
        AND p.clinica_id = get_clinica_id()
    )
  );

DROP POLICY IF EXISTS addendums_select ON public.addendums;
CREATE POLICY addendums_select ON public.addendums
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM consultas c
      JOIN pacientes p ON p.id = c.paciente_id
      WHERE c.id = addendums.consulta_id
        AND p.clinica_id = get_clinica_id()
    )
  );


-- ----------------------------------------------------------------------------
-- analitos_catalogo (1 policy — read-only del catálogo activo)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS catalogo_select_authenticated ON public.analitos_catalogo;
CREATE POLICY catalogo_select_authenticated ON public.analitos_catalogo
  FOR SELECT TO authenticated
  USING (activo = true);


-- ----------------------------------------------------------------------------
-- appointments (4 policies — clinica_*)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS clinica_delete ON public.appointments;
CREATE POLICY clinica_delete ON public.appointments
  FOR DELETE TO authenticated
  USING (clinica_id = get_clinica_id());

DROP POLICY IF EXISTS clinica_insert ON public.appointments;
CREATE POLICY clinica_insert ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (clinica_id = get_clinica_id());

DROP POLICY IF EXISTS clinica_select ON public.appointments;
CREATE POLICY clinica_select ON public.appointments
  FOR SELECT TO authenticated
  USING (clinica_id = get_clinica_id());

DROP POLICY IF EXISTS clinica_update ON public.appointments;
CREATE POLICY clinica_update ON public.appointments
  FOR UPDATE TO authenticated
  USING (clinica_id = get_clinica_id())
  WITH CHECK (clinica_id = get_clinica_id());


-- ----------------------------------------------------------------------------
-- audit_log (2 policies — duplicadas funcionalmente, ambas SELECT super_admin)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_log_view_solo_super_admin ON public.audit_log;
CREATE POLICY audit_log_view_solo_super_admin ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'super_admin'::text
    )
  );

DROP POLICY IF EXISTS audit_super_admin_select ON public.audit_log;
CREATE POLICY audit_super_admin_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'::text
    )
  );


-- ----------------------------------------------------------------------------
-- calculadora_resultados (4 policies — clinica_*)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS clinica_delete ON public.calculadora_resultados;
CREATE POLICY clinica_delete ON public.calculadora_resultados
  FOR DELETE TO authenticated
  USING (clinica_id = get_clinica_id());

DROP POLICY IF EXISTS clinica_insert ON public.calculadora_resultados;
CREATE POLICY clinica_insert ON public.calculadora_resultados
  FOR INSERT TO authenticated
  WITH CHECK (clinica_id = get_clinica_id());

DROP POLICY IF EXISTS clinica_select ON public.calculadora_resultados;
CREATE POLICY clinica_select ON public.calculadora_resultados
  FOR SELECT TO authenticated
  USING (clinica_id = get_clinica_id());

DROP POLICY IF EXISTS clinica_update ON public.calculadora_resultados;
CREATE POLICY clinica_update ON public.calculadora_resultados
  FOR UPDATE TO authenticated
  USING (clinica_id = get_clinica_id())
  WITH CHECK (clinica_id = get_clinica_id());


-- ----------------------------------------------------------------------------
-- cat_cie10 (1 policy — read-only para todo authenticated)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS authenticated_read ON public.cat_cie10;
CREATE POLICY authenticated_read ON public.cat_cie10
  FOR SELECT TO authenticated
  USING (true);


-- ----------------------------------------------------------------------------
-- clinicas (1 policy — SELECT abierto a cualquier authenticated)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuarios ven su clinica" ON public.clinicas;
CREATE POLICY "Usuarios ven su clinica" ON public.clinicas
  FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);


-- ----------------------------------------------------------------------------
-- consultas (8 policies — 4 legacy {public} + 4 nuevas {authenticated})
-- Ver nota al final del archivo.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Actualizar consultas solo medico" ON public.consultas;
CREATE POLICY "Actualizar consultas solo medico" ON public.consultas
  FOR UPDATE TO public
  USING (
    auth.uid() IN (
      SELECT profiles.id FROM profiles
      WHERE profiles.role = ANY (ARRAY['medico'::text, 'super_admin'::text])
    )
  );

DROP POLICY IF EXISTS "Eliminar consultas solo medico" ON public.consultas;
CREATE POLICY "Eliminar consultas solo medico" ON public.consultas
  FOR DELETE TO public
  USING (
    auth.uid() IN (
      SELECT profiles.id FROM profiles
      WHERE profiles.role = ANY (ARRAY['medico'::text, 'super_admin'::text])
    )
  );

DROP POLICY IF EXISTS "Insertar consultas solo medico" ON public.consultas;
CREATE POLICY "Insertar consultas solo medico" ON public.consultas
  FOR INSERT TO public
  WITH CHECK (
    auth.uid() IN (
      SELECT profiles.id FROM profiles
      WHERE profiles.role = ANY (ARRAY['medico'::text, 'super_admin'::text])
    )
  );

DROP POLICY IF EXISTS "Ver consultas de pacientes de la clinica" ON public.consultas;
CREATE POLICY "Ver consultas de pacientes de la clinica" ON public.consultas
  FOR SELECT TO public
  USING (
    paciente_id IN (
      SELECT pacientes.id FROM pacientes
      WHERE pacientes.clinica_id = (
        SELECT profiles.clinica_id FROM profiles
        WHERE profiles.id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS clinica_delete ON public.consultas;
CREATE POLICY clinica_delete ON public.consultas
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = consultas.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );

DROP POLICY IF EXISTS clinica_insert ON public.consultas;
CREATE POLICY clinica_insert ON public.consultas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = consultas.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );

DROP POLICY IF EXISTS clinica_select ON public.consultas;
CREATE POLICY clinica_select ON public.consultas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = consultas.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );

DROP POLICY IF EXISTS clinica_update ON public.consultas;
CREATE POLICY clinica_update ON public.consultas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = consultas.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );


-- ----------------------------------------------------------------------------
-- documentos (6 policies — 2 legacy {public} + 4 nuevas {authenticated})
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Insertar documentos solo medico" ON public.documentos;
CREATE POLICY "Insertar documentos solo medico" ON public.documentos
  FOR INSERT TO public
  WITH CHECK (
    auth.uid() IN (
      SELECT profiles.id FROM profiles
      WHERE profiles.role = ANY (ARRAY['medico'::text, 'super_admin'::text])
    )
  );

DROP POLICY IF EXISTS "Ver documentos de la clinica" ON public.documentos;
CREATE POLICY "Ver documentos de la clinica" ON public.documentos
  FOR SELECT TO public
  USING (
    paciente_id IN (
      SELECT pacientes.id FROM pacientes
      WHERE pacientes.clinica_id = (
        SELECT profiles.clinica_id FROM profiles
        WHERE profiles.id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS clinica_delete ON public.documentos;
CREATE POLICY clinica_delete ON public.documentos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = documentos.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );

DROP POLICY IF EXISTS clinica_insert ON public.documentos;
CREATE POLICY clinica_insert ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = documentos.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );

DROP POLICY IF EXISTS clinica_select ON public.documentos;
CREATE POLICY clinica_select ON public.documentos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = documentos.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );

DROP POLICY IF EXISTS clinica_update ON public.documentos;
CREATE POLICY clinica_update ON public.documentos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = documentos.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );


-- ----------------------------------------------------------------------------
-- google_tokens (5 policies — 1 ALL legacy {public} + 4 separadas {authenticated})
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users manage own tokens" ON public.google_tokens;
CREATE POLICY "Users manage own tokens" ON public.google_tokens
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS tokens_delete_own ON public.google_tokens;
CREATE POLICY tokens_delete_own ON public.google_tokens
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS tokens_insert_own ON public.google_tokens;
CREATE POLICY tokens_insert_own ON public.google_tokens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS tokens_select_own ON public.google_tokens;
CREATE POLICY tokens_select_own ON public.google_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS tokens_update_own ON public.google_tokens;
CREATE POLICY tokens_update_own ON public.google_tokens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- invitaciones (3 policies — admin_*)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS admin_delete_invitaciones ON public.invitaciones;
CREATE POLICY admin_delete_invitaciones ON public.invitaciones
  FOR DELETE TO authenticated
  USING (clinica_id = get_clinica_id());

DROP POLICY IF EXISTS admin_insert_invitaciones ON public.invitaciones;
CREATE POLICY admin_insert_invitaciones ON public.invitaciones
  FOR INSERT TO authenticated
  WITH CHECK (clinica_id = get_clinica_id());

DROP POLICY IF EXISTS admin_select_invitaciones ON public.invitaciones;
CREATE POLICY admin_select_invitaciones ON public.invitaciones
  FOR SELECT TO authenticated
  USING (clinica_id = get_clinica_id());


-- ----------------------------------------------------------------------------
-- ip_rate_limits (sin policies — solo service_role accede)
-- ----------------------------------------------------------------------------
-- (RLS habilitado pero sin policies — bloquea cualquier acceso desde cliente)


-- ----------------------------------------------------------------------------
-- medicamentos (1 policy — read-only para authenticated)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Lectura para usuarios autenticados" ON public.medicamentos;
CREATE POLICY "Lectura para usuarios autenticados" ON public.medicamentos
  FOR SELECT TO authenticated
  USING (true);


-- ----------------------------------------------------------------------------
-- mediciones_analitos (4 policies — clinica_*)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS clinica_delete ON public.mediciones_analitos;
CREATE POLICY clinica_delete ON public.mediciones_analitos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = mediciones_analitos.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );

DROP POLICY IF EXISTS clinica_insert ON public.mediciones_analitos;
CREATE POLICY clinica_insert ON public.mediciones_analitos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = mediciones_analitos.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );

DROP POLICY IF EXISTS clinica_select ON public.mediciones_analitos;
CREATE POLICY clinica_select ON public.mediciones_analitos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = mediciones_analitos.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );

DROP POLICY IF EXISTS clinica_update ON public.mediciones_analitos;
CREATE POLICY clinica_update ON public.mediciones_analitos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = mediciones_analitos.paciente_id
        AND p.clinica_id = get_clinica_id()
    )
  );


-- ----------------------------------------------------------------------------
-- pacientes (7 policies — mix de {public} y {authenticated})
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS clinica_insert ON public.pacientes;
CREATE POLICY clinica_insert ON public.pacientes
  FOR INSERT TO authenticated
  WITH CHECK (clinica_id = get_clinica_id());

DROP POLICY IF EXISTS clinica_update ON public.pacientes;
CREATE POLICY clinica_update ON public.pacientes
  FOR UPDATE TO authenticated
  USING (clinica_id = get_clinica_id())
  WITH CHECK (clinica_id = get_clinica_id());

DROP POLICY IF EXISTS pacientes_delete_solo_sin_historial ON public.pacientes;
CREATE POLICY pacientes_delete_solo_sin_historial ON public.pacientes
  FOR DELETE TO authenticated
  USING (
    clinica_id = get_clinica_id()
    AND NOT EXISTS (SELECT 1 FROM consultas c WHERE c.paciente_id = pacientes.id)
    AND NOT EXISTS (SELECT 1 FROM documentos d WHERE d.paciente_id = pacientes.id)
  );

DROP POLICY IF EXISTS pacientes_insert ON public.pacientes;
CREATE POLICY pacientes_insert ON public.pacientes
  FOR INSERT TO public
  WITH CHECK (clinica_id = get_my_clinica_id());

DROP POLICY IF EXISTS pacientes_select_activos ON public.pacientes;
CREATE POLICY pacientes_select_activos ON public.pacientes
  FOR SELECT TO authenticated
  USING (
    clinica_id = get_clinica_id()
    AND ((activo = true) OR (activo IS NULL))
  );

DROP POLICY IF EXISTS pacientes_select_inactivos_admin ON public.pacientes;
CREATE POLICY pacientes_select_inactivos_admin ON public.pacientes
  FOR SELECT TO authenticated
  USING (
    clinica_id = get_clinica_id()
    AND activo = false
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['admin'::text, 'super_admin'::text])
    )
  );

DROP POLICY IF EXISTS pacientes_update ON public.pacientes;
CREATE POLICY pacientes_update ON public.pacientes
  FOR UPDATE TO public
  USING (
    CASE get_my_role()
      WHEN 'medico'::text THEN (medico_id = auth.uid())
      ELSE (clinica_id = get_my_clinica_id())
    END
  );


-- ----------------------------------------------------------------------------
-- pdf_jobs (1 policy — ALL legacy {public})
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS users_own_pdf_jobs ON public.pdf_jobs;
CREATE POLICY users_own_pdf_jobs ON public.pdf_jobs
  FOR ALL TO public
  USING (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- plantillas_honorarios (4 policies — owner_*)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS owner_delete ON public.plantillas_honorarios;
CREATE POLICY owner_delete ON public.plantillas_honorarios
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS owner_insert ON public.plantillas_honorarios;
CREATE POLICY owner_insert ON public.plantillas_honorarios
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS owner_select ON public.plantillas_honorarios;
CREATE POLICY owner_select ON public.plantillas_honorarios
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS owner_update ON public.plantillas_honorarios;
CREATE POLICY owner_update ON public.plantillas_honorarios
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- profiles (4 policies — 2 legacy {public} + 2 nuevas {authenticated})
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Actualizar propio perfil" ON public.profiles;
CREATE POLICY "Actualizar propio perfil" ON public.profiles
  FOR UPDATE TO public
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Ver perfiles de la misma clinica" ON public.profiles;
CREATE POLICY "Ver perfiles de la misma clinica" ON public.profiles
  FOR SELECT TO public
  USING (
    (clinica_id = get_my_clinica_id()) OR (id = auth.uid())
  );

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ----------------------------------------------------------------------------
-- rate_limits (1 policy)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS usuario_own ON public.rate_limits;
CREATE POLICY usuario_own ON public.rate_limits
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- solicitudes_arco (1 policy — ALL legacy {public}, solo super_admin)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "super_admin full access arco" ON public.solicitudes_arco;
CREATE POLICY "super_admin full access arco" ON public.solicitudes_arco
  FOR ALL TO public
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'::text
    )
  );


-- =============================================================================
-- NOTA: las policies marcadas con {public} en pacientes, consultas y documentos
-- son redundantes con las {authenticated} y serán removidas en Fase B. Se
-- mantienen aquí para reflejar el estado actual de prod.
-- =============================================================================
