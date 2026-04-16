-- ═══════════════════════════════════════════════════════════════════════
-- Migración: Plantillas de Honorarios / Cotizaciones
-- Fecha: 2026-04-16
-- Descripción: Tabla dedicada para plantillas de documentos financieros.
--   Separada de `documentos` para no romper la RLS existente que depende
--   de paciente_id. Las plantillas no tienen paciente asociado.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Crear tabla
CREATE TABLE IF NOT EXISTS public.plantillas_honorarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinica_id  uuid NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  contenido   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Índice único: un médico no puede tener dos plantillas con el mismo nombre
CREATE UNIQUE INDEX IF NOT EXISTS idx_plantillas_honorarios_unique_name
  ON public.plantillas_honorarios (user_id, LOWER(TRIM(nombre)));

-- 3. Índice para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_plantillas_honorarios_user
  ON public.plantillas_honorarios (user_id, created_at DESC);

-- 4. RLS
ALTER TABLE public.plantillas_honorarios ENABLE ROW LEVEL SECURITY;

-- Solo el propietario puede ver sus plantillas
CREATE POLICY "owner_select" ON public.plantillas_honorarios
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Solo el propietario puede crear plantillas
CREATE POLICY "owner_insert" ON public.plantillas_honorarios
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Solo el propietario puede actualizar sus plantillas
CREATE POLICY "owner_update" ON public.plantillas_honorarios
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Solo el propietario puede borrar sus plantillas
CREATE POLICY "owner_delete" ON public.plantillas_honorarios
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 5. Trigger de updated_at
CREATE OR REPLACE FUNCTION public.update_plantillas_honorarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plantillas_honorarios_updated_at
  BEFORE UPDATE ON public.plantillas_honorarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_plantillas_honorarios_updated_at();
