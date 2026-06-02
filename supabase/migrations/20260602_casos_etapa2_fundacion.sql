-- ═══════════════════════════════════════════════════════════
-- Módulo: Casos Clínicos
-- Etapa 2 — Migración / fundación de datos
-- Fecha de aplicación: 2026-06-02
--
-- ⚠️  ADVERTENCIA: NO EJECUTAR. Este SQL YA FUE APLICADO a producción
-- el 2026-06-02, manualmente vía SQL Editor, pieza por pieza, bajo el
-- Protocolo D-T6 (SQL atómico, una query a la vez, validar resultado
-- antes de la siguiente, snapshot antes, smoke test después).
-- El smoke test pasó (todo verde). Este archivo existe SOLO para
-- trazabilidad en git y para poder recrear el schema en un ambiente
-- nuevo (staging/dev).
--
-- Orden de aplicación (8 piezas):
--   1 → 2 → 2-bis (triggers updated_at) → 2-ter (trigger audit)
--     → 3 (RLS) → 4 (bucket) → 5 (storage policies) → 6 (índices)
--
-- Pre-flight ejecutado antes de la Pieza 1 (sin conflictos):
--   - to_regclass('public.casos_clinicos')          → NULL
--   - to_regclass('public.casos_clinicos_recursos') → NULL
--   - SELECT id FROM storage.buckets WHERE id='casos-clinicos' → 0 filas
--   - helpers get_clinica_id()/soy_admin_de_clinica()/log_tabla_change()
--     y tabla audit_log → presentes
-- ═══════════════════════════════════════════════════════════

-- PIEZA 1 — Tabla casos_clinicos
CREATE TABLE public.casos_clinicos (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinica_id                uuid NOT NULL REFERENCES public.clinicas(id),
  medico_id                 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  paciente_id               uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  titulo                    text NOT NULL,
  descripcion               text,
  tipo_caso                 text NOT NULL CHECK (tipo_caso IN ('pre_post_operatorio','documental','evolucion_clinica','educativo','diagnostico_imagen')),
  region_anatomica          text,
  tags                      text[] NOT NULL DEFAULT '{}',
  estado                    text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','listo')),
  consentimiento_otorgado   boolean,
  fecha_consentimiento      timestamptz,
  version_aviso_privacidad  text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  activo                    boolean NOT NULL DEFAULT true,
  fecha_baja                timestamptz
);

-- PIEZA 2 — Tabla casos_clinicos_recursos
CREATE TABLE public.casos_clinicos_recursos (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  caso_id         uuid NOT NULL REFERENCES public.casos_clinicos(id) ON DELETE CASCADE,
  clinica_id      uuid NOT NULL REFERENCES public.clinicas(id),
  storage_path    text NOT NULL,
  nombre_original text,
  mime_type       text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png')),
  tamano_bytes    bigint NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN ('foto','radiografia')),
  descripcion     text,
  anotaciones     jsonb NOT NULL DEFAULT '[]'::jsonb,
  orden           int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- PIEZA 2-bis — Triggers updated_at (convención per-tabla del repo)
CREATE OR REPLACE FUNCTION public.update_casos_clinicos_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$fn$;
DROP TRIGGER IF EXISTS trg_casos_clinicos_updated_at ON public.casos_clinicos;
CREATE TRIGGER trg_casos_clinicos_updated_at
  BEFORE UPDATE ON public.casos_clinicos
  FOR EACH ROW EXECUTE FUNCTION public.update_casos_clinicos_updated_at();

CREATE OR REPLACE FUNCTION public.update_casos_recursos_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$fn$;
DROP TRIGGER IF EXISTS trg_casos_recursos_updated_at ON public.casos_clinicos_recursos;
CREATE TRIGGER trg_casos_recursos_updated_at
  BEFORE UPDATE ON public.casos_clinicos_recursos
  FOR EACH ROW EXECUTE FUNCTION public.update_casos_recursos_updated_at();

-- PIEZA 2-ter — Auditoría NOM-024 (reusa log_tabla_change() existente)
DROP TRIGGER IF EXISTS audit_casos_clinicos ON public.casos_clinicos;
CREATE TRIGGER audit_casos_clinicos
  AFTER INSERT OR UPDATE OR DELETE ON public.casos_clinicos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

-- PIEZA 3 — RLS ambas tablas
ALTER TABLE public.casos_clinicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY casos_clinicos_select ON public.casos_clinicos
  FOR SELECT TO authenticated USING (
    clinica_id = public.get_clinica_id()
    AND medico_id = auth.uid()
    AND public.soy_admin_de_clinica()
  );

CREATE POLICY casos_clinicos_insert ON public.casos_clinicos
  FOR INSERT TO authenticated WITH CHECK (
    clinica_id = public.get_clinica_id()
    AND medico_id = auth.uid()
    AND public.soy_admin_de_clinica()
  );

CREATE POLICY casos_clinicos_update ON public.casos_clinicos
  FOR UPDATE TO authenticated USING (
    clinica_id = public.get_clinica_id()
    AND medico_id = auth.uid()
    AND public.soy_admin_de_clinica()
  ) WITH CHECK (
    clinica_id = public.get_clinica_id()
    AND medico_id = auth.uid()
    AND public.soy_admin_de_clinica()
  );

ALTER TABLE public.casos_clinicos_recursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY casos_clinicos_recursos_select ON public.casos_clinicos_recursos
  FOR SELECT TO authenticated USING (
    clinica_id = public.get_clinica_id()
    AND public.soy_admin_de_clinica()
    AND EXISTS (SELECT 1 FROM public.casos_clinicos c WHERE c.id = caso_id AND c.medico_id = auth.uid())
  );

CREATE POLICY casos_clinicos_recursos_insert ON public.casos_clinicos_recursos
  FOR INSERT TO authenticated WITH CHECK (
    clinica_id = public.get_clinica_id()
    AND public.soy_admin_de_clinica()
    AND EXISTS (SELECT 1 FROM public.casos_clinicos c WHERE c.id = caso_id AND c.medico_id = auth.uid())
  );

CREATE POLICY casos_clinicos_recursos_update ON public.casos_clinicos_recursos
  FOR UPDATE TO authenticated USING (
    clinica_id = public.get_clinica_id()
    AND public.soy_admin_de_clinica()
    AND EXISTS (SELECT 1 FROM public.casos_clinicos c WHERE c.id = caso_id AND c.medico_id = auth.uid())
  ) WITH CHECK (
    clinica_id = public.get_clinica_id()
    AND public.soy_admin_de_clinica()
    AND EXISTS (SELECT 1 FROM public.casos_clinicos c WHERE c.id = caso_id AND c.medico_id = auth.uid())
  );

CREATE POLICY casos_clinicos_recursos_delete ON public.casos_clinicos_recursos
  FOR DELETE TO authenticated USING (
    clinica_id = public.get_clinica_id()
    AND public.soy_admin_de_clinica()
    AND EXISTS (SELECT 1 FROM public.casos_clinicos c WHERE c.id = caso_id AND c.medico_id = auth.uid())
  );

-- PIEZA 4 — Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('casos-clinicos', 'casos-clinicos', false, 15728640, ARRAY['image/jpeg','image/png']::text[])
ON CONFLICT (id) DO NOTHING;

-- PIEZA 5 — Policies storage.objects (creadas como rol elevado en SQL Editor)
CREATE POLICY casos_clinicos_storage_select_propia_clinica ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'casos-clinicos' AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'clinicas'
    AND (storage.foldername(name))[2] = (public.get_clinica_id())::text
  );

CREATE POLICY casos_clinicos_storage_insert_propia_clinica ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'casos-clinicos' AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'clinicas'
    AND (storage.foldername(name))[2] = (public.get_clinica_id())::text
  );

CREATE POLICY casos_clinicos_storage_update_propia_clinica ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'casos-clinicos' AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'clinicas'
    AND (storage.foldername(name))[2] = (public.get_clinica_id())::text
  );

CREATE POLICY casos_clinicos_storage_delete_propia_clinica ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'casos-clinicos' AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'clinicas'
    AND (storage.foldername(name))[2] = (public.get_clinica_id())::text
  );

-- PIEZA 6 — Índices
CREATE INDEX idx_casos_clinicos_clinica_medico   ON public.casos_clinicos (clinica_id, medico_id);
CREATE INDEX idx_casos_clinicos_paciente         ON public.casos_clinicos (paciente_id);
CREATE INDEX idx_casos_clinicos_tags             ON public.casos_clinicos USING GIN (tags);
CREATE INDEX idx_casos_clinicos_recursos_caso    ON public.casos_clinicos_recursos (caso_id);
CREATE INDEX idx_casos_clinicos_recursos_clinica ON public.casos_clinicos_recursos (clinica_id);

-- FIN DE MIGRACIÓN
