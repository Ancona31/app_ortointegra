-- ============================================================================
-- Migración 2.1: CREATE TABLE consultorios
-- Proyecto: Multiconsultorio Spinus
-- Branch: multiconsultorio
-- Aplicado en producción: 2026-06-15 vía SQL Editor de Supabase.
-- Smoke tests post-aplicación: pasados.
-- ============================================================================
-- Propósito:
-- Crear la tabla `public.consultorios` que persiste los consultorios físicos
-- de cada médico. Cada médico puede tener hasta 10 consultorios activos.
-- ============================================================================
-- Dependencias:
-- - Requiere tablas existentes: public.clinicas, public.profiles.
-- - Requiere extensión uuid-ossp (verificada como instalada v1.1).
-- - RLS NO se habilita aquí. Se habilita en la migración 2.3.
-- ============================================================================

-- ====================
-- UP
-- ====================

CREATE TABLE public.consultorios (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinica_id      uuid NOT NULL,
  medico_id       uuid NOT NULL,
  nombre          text NOT NULL,
  nombre_corto    text NOT NULL CHECK (char_length(nombre_corto) BETWEEN 1 AND 12),
  direccion       text NOT NULL,
  telefono        text,
  timezone        text NOT NULL DEFAULT 'America/Mexico_City',
  horario         jsonb NOT NULL DEFAULT '{
    "lunes":     {"activo": false, "inicio": "09:00", "fin": "19:00"},
    "martes":    {"activo": false, "inicio": "09:00", "fin": "19:00"},
    "miercoles": {"activo": false, "inicio": "09:00", "fin": "19:00"},
    "jueves":    {"activo": false, "inicio": "09:00", "fin": "19:00"},
    "viernes":   {"activo": false, "inicio": "09:00", "fin": "19:00"},
    "sabado":    {"activo": false, "inicio": "09:00", "fin": "14:00"},
    "domingo":   {"activo": false, "inicio": "09:00", "fin": "14:00"}
  }'::jsonb,
  es_default      boolean NOT NULL DEFAULT false,
  activo          boolean NOT NULL DEFAULT true,
  fecha_baja      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Foreign Keys nombradas y separadas (estilo del repo)
ALTER TABLE public.consultorios
  ADD CONSTRAINT consultorios_clinica_id_fkey
  FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE public.consultorios
  ADD CONSTRAINT consultorios_medico_id_fkey
  FOREIGN KEY (medico_id) REFERENCES public.profiles(id)
  ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Índices

-- 1) Unicidad del default activo por médico (≤1 default activo por médico)
CREATE UNIQUE INDEX consultorios_default_unico
  ON public.consultorios (medico_id)
  WHERE es_default = true AND activo = true;

-- 2) Índice parcial para queries "consultorios activos del médico X"
CREATE INDEX consultorios_medico_activo
  ON public.consultorios (medico_id)
  WHERE activo = true;

-- 3) Índice para queries por clínica (RLS de admin/secretaria + super admin)
CREATE INDEX consultorios_clinica
  ON public.consultorios (clinica_id);

-- ====================
-- DOWN (rollback)
-- ====================
-- Para revertir:
--   DROP TABLE public.consultorios CASCADE;
--
-- NOTA: Si esta migración ya se aplicó y la tabla tiene filas, el DROP las
-- elimina permanentemente. CASCADE limpia índices y constraints automáticamente.
-- Si migración 2.4 también fue aplicada (FKs desde appointments/consultas hacia
-- esta tabla), el CASCADE elimina silenciosamente esas FKs. Verificar el orden
-- de rollback (2.4 → 2.3 → 2.2 → 2.1) si se quiere rollback limpio sin sorpresas.
