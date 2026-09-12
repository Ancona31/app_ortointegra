-- ════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Stripe billing + planes de suscripción
-- Ejecutar en: Supabase > SQL Editor
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Campos de suscripción en clinicas ─────────────────────────────

ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id        TEXT,
  ADD COLUMN IF NOT EXISTS plan                   TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'individual', 'basica', 'pro', 'premium')),
  ADD COLUMN IF NOT EXISTS suscripcion_estado     TEXT NOT NULL DEFAULT 'free'
    CHECK (suscripcion_estado IN ('free', 'trial', 'activo', 'vencido', 'cancelado')),
  ADD COLUMN IF NOT EXISTS trial_ends_at          TIMESTAMPTZ DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS suscripcion_ends_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_pacientes          INT DEFAULT 15;

-- Clínicas existentes ya activas quedan en free con límite 15
-- (el super_admin puede cambiarlas manualmente o vía upgrade)

-- ─── 2. Índices ────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clinicas_stripe_customer
  ON clinicas(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinicas_stripe_subscription
  ON clinicas(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ─── 3. Tabla de invitaciones de equipo ───────────────────────────────

CREATE TABLE IF NOT EXISTS invitaciones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinica_id  UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('medico', 'secretaria')),
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitaciones_token     ON invitaciones(token);
CREATE INDEX IF NOT EXISTS idx_invitaciones_clinica   ON invitaciones(clinica_id);
CREATE INDEX IF NOT EXISTS idx_invitaciones_email     ON invitaciones(email);

-- ─── 4. RLS para invitaciones ─────────────────────────────────────────

ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;

-- Admin de la clínica puede ver y crear invitaciones
CREATE POLICY "admin_select_invitaciones" ON invitaciones
  FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id());

CREATE POLICY "admin_insert_invitaciones" ON invitaciones
  FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.get_clinica_id());

CREATE POLICY "admin_delete_invitaciones" ON invitaciones
  FOR DELETE TO authenticated
  USING (clinica_id = public.get_clinica_id());

-- ─── 5. Función helper: verificar estado de suscripción ───────────────

CREATE OR REPLACE FUNCTION public.get_suscripcion_estado()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT suscripcion_estado
  FROM clinicas
  WHERE id = public.get_clinica_id()
$$;

-- ─── 6. Función helper: obtener límite de pacientes ───────────────────

CREATE OR REPLACE FUNCTION public.get_max_pacientes()
RETURNS INT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT max_pacientes
  FROM clinicas
  WHERE id = public.get_clinica_id()
$$;

-- ─── 7. Actualizar RLS de pacientes: respetar límite free ─────────────
-- El límite de 15 pacientes en plan free se verifica en la aplicación.
-- La política de insert ya existe; no es necesario modificarla aquí.
-- El bloqueo se hace a nivel de API/componente con conteo previo.
