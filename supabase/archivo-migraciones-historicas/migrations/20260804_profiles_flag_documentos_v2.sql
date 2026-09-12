-- ============================================================================
-- PENDIENTE DE APLICAR — la ejecuta Angel a mano, UNA CONSULTA A LA VEZ
-- ============================================================================
-- Sistema de documentos v2 · Paso 0.a (andamiaje inerte).
--
-- Feature flag por médico para el rollout de documentos v2.
--
-- ES UN FLAG TEMPORAL. Se retira (DROP COLUMN) cuando v2 esté al 100 %.
-- Deliberadamente NO es una tabla de flags ni un sistema genérico: sería
-- infraestructura para un solo uso y con fecha de caducidad conocida.
--
-- DEFAULT false: nadie ve v2 hasta que se marque explícitamente.
--
-- El flag no se lee desde ningún sitio del código todavía. Queda inerte hasta
-- que exista el primer formato v2 y el punto de ramificación de
-- `src/lib/mobileShare.ts` (buildClientElement) sepa qué hacer con él.
-- ============================================================================

-- ── Consulta 1 de 2 ──────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS usa_documentos_v2 boolean NOT NULL DEFAULT false;

-- ── Consulta 2 de 2 ──────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
