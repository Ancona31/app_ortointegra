-- ============================================================================
-- PENDIENTE DE APLICAR — la ejecuta Angel a mano, UNA CONSULTA A LA VEZ
-- ============================================================================
-- Sistema de documentos v2 · Paso 0.a (andamiaje inerte).
--
-- Añade `formato_version` a public.documentos: marca con qué chasis de diseño
-- se emitió cada documento. Sin esta columna no hay forma de distinguir un
-- documento v1 de uno v2, y por tanto no hay forma de impedir que se
-- reimprima un papel ya entregado con el diseño equivocado
-- (DOCUMENTOS_SPEC.md §I.3.9 — inmutabilidad).
--
-- Verificado contra producción antes de escribir esto: la columna NO existe.
-- Las 14 columnas actuales son id, paciente_id, consulta_id, tipo, contenido,
-- pdf_url, created_at, client_id, storage_bucket, storage_path, mime_type,
-- tamaño_bytes, nombre_original, subido_por.
--
-- DEFAULT 1 es deliberado: todo lo existente y todo lo que se emita de aquí en
-- adelante queda marcado como v1 sin tocar ninguno de los 8 insertPayload de
-- los formularios. El INSERT explícito con 2 llega cuando exista el primer
-- formato v2, no antes.
-- ============================================================================

-- ── Consulta 1 de 3 ──────────────────────────────────────────────────────────
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS formato_version integer NOT NULL DEFAULT 1;

-- ── Consulta 2 de 3 ──────────────────────────────────────────────────────────
-- Separada del ADD COLUMN para poder correrla aparte y para que el nombre del
-- constraint sea explícito (Postgres no acepta IF NOT EXISTS en ADD CONSTRAINT;
-- si ya existe, esta consulta falla y se ignora sin consecuencias).
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_formato_version_check
  CHECK (formato_version IN (1, 2));

-- ── Consulta 3 de 3 ──────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
