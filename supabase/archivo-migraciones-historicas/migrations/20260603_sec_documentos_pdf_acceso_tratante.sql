-- ============================================================
-- SEC — documentos-pdf: acceso restringido al médico tratante
-- Fecha: 2026-06-03 · Protocolo D-T6
--
-- ⚠️  YA APLICADO EN PRODUCCIÓN el 2026-06-03 — NO re-ejecutar.
--     Aplicado vía SQL Editor del dashboard (Protocolo D-T6, NO
--     Supabase CLI). Este archivo es un REGISTRO DOCUMENTAL del SQL
--     ya ejecutado, no una migración pendiente.
-- ============================================================
-- CONTEXTO
-- Cierre de Eje 6 / E5-DT-14 (storage policies sin auditar). El bucket
-- documentos-pdf guarda los PDFs de los 8 formularios clínicos (recetas,
-- notas, solicitudes, cotizaciones, etc.). Los paths son
-- <paciente_id>/<nombre>.pdf.
--
-- VECTOR CERRADO (fuga cross-tenant de PHI)
-- Las 3 políticas previas — authenticated_select / authenticated_insert /
-- authenticated_delete — solo exigían bucket_id = 'documentos-pdf', SIN
-- filtro por clínica ni por paciente. Resultado: cualquier usuario
-- autenticado de CUALQUIER clínica podía leer, subir o borrar CUALQUIER
-- documento de cualquier paciente. Fuga cross-tenant (y también
-- intra-clínica) de datos personales sensibles de salud.
--
-- DECISIÓN DE PRODUCTO
-- Estos documentos SOLO los genera y consume el médico tratante; ni
-- admin ni secretaria acceden a ellos. Por eso el acceso se ata a
-- soy_medico_tratante(paciente_id) — el vínculo en public.paciente_medico —
-- y NO a la clínica. Esto cierra la fuga cross-tenant Y la intra-clínica
-- en un solo predicado: solo el médico vinculado al paciente dueño de la
-- carpeta puede leer/subir/borrar sus documentos.
--
-- CASE-GUARD DEL CAST A uuid
-- El primer segmento del path (<paciente_id>) se castea a uuid para
-- pasarlo a soy_medico_tratante(). El cast va envuelto en un CASE con un
-- regex de uuid PORQUE el AND de un qual de policy NO garantiza
-- corto-circuito en Postgres (el orden de evaluación de los operandos de
-- AND no está definido). Sin el CASE, un .list() futuro u otro objeto con
-- primer segmento no-uuid de otro bucket podría disparar el cast y
-- romper la evaluación con "invalid input syntax for type uuid". El CASE
-- SÍ garantiza el orden (el THEN ::uuid solo se evalúa si el regex pasó);
-- si no pasa, devuelve NULL → soy_medico_tratante(NULL) = false → deniega
-- sin error. Inocuo hoy (no hay .list() en el código; los 222 paths son
-- <uuid>/<nombre>.pdf), aplicado como blindaje definitivo.
--
-- HUÉRFANOS (decisión beta del dueño)
-- De los 222 documentos del bucket, 207 quedan accesibles para su médico
-- tratante; 15 quedan inaccesibles vía app: 14 de pacientes ya
-- inexistentes + 1 de un paciente sin vínculo vigente en paciente_medico.
-- Decisión del dueño: NO backfillear en beta. Se aceptan como daño
-- colateral; service_role (backend) los sigue viendo si hiciera falta.
--
-- VALIDACIÓN OPERATIVA POSTERIOR (2026-06-03, por el usuario)
-- Se probó en la app la regeneración de un documento existente: funciona
-- sin error y SIN necesidad de una policy UPDATE. El upsert:true de la
-- subida se resuelve por la ruta INSERT, cubierta por la nueva WITH CHECK.
--
-- SMOKE TESTS (al aplicar, en transacciones revertidas)
--   a) médico tratante lee sus documentos → 3 visibles ✓
--   b) usuario no-tratante de otra clínica → 0 visibles (BLOQUEADO) ✓
--   c) service_role (bypass RLS) → 3 visibles (backend OK) ✓
--
-- NOTA DE ESTILO sobre el POST-FLIGHT
-- Otras migraciones del repo (p.ej. 20260530_etapa5g_paso4_policies_documentos)
-- usan un POST-FLIGHT más estricto con array_agg + IS DISTINCT FROM que
-- aborta la transacción si el set de policies no es exacto. Aquí se
-- registra el POST-FLIGHT que REALMENTE se corrió: un SELECT
-- policyname, cmd filtrado, revisado a ojo. Se documenta tal cual se
-- aplicó, sin reescribir la verificación a posteriori.
-- ============================================================

-- ---------- UP (SQL literal aplicado) ----------
BEGIN;

-- PRE-FLIGHT: las 3 policies viejas deben existir (esperado: 3) y el helper debe existir.
SELECT count(*) AS politicas_viejas
FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND policyname IN ('authenticated_select','authenticated_insert','authenticated_delete');

SELECT count(*) AS helper_existe
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='soy_medico_tratante';

-- DROP de las 3 policies abiertas
DROP POLICY IF EXISTS "authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;

-- CREATE de las 3 policies por médico tratante (con CASE-guard)
CREATE POLICY "documentos_pdf_select_tratante"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-pdf'
    AND auth.uid() IS NOT NULL
    AND soy_medico_tratante(
      CASE WHEN (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN ((storage.foldername(name))[1])::uuid END
    )
  );

CREATE POLICY "documentos_pdf_insert_tratante"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-pdf'
    AND auth.uid() IS NOT NULL
    AND soy_medico_tratante(
      CASE WHEN (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN ((storage.foldername(name))[1])::uuid END
    )
  );

CREATE POLICY "documentos_pdf_delete_tratante"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos-pdf'
    AND auth.uid() IS NOT NULL
    AND soy_medico_tratante(
      CASE WHEN (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN ((storage.foldername(name))[1])::uuid END
    )
  );

-- POST-FLIGHT: confirmar el set final (3 nuevas, 0 viejas)
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND (policyname LIKE 'documentos_pdf_%tratante' OR policyname LIKE 'authenticated_%')
ORDER BY policyname;

COMMIT;

-- ---------- DOWN (rollback) — referencia, no se ejecuta ----------
-- ROLLBACK (restaura el estado previo — las policies abiertas):
-- DROP POLICY IF EXISTS "documentos_pdf_select_tratante" ON storage.objects;
-- DROP POLICY IF EXISTS "documentos_pdf_insert_tratante" ON storage.objects;
-- DROP POLICY IF EXISTS "documentos_pdf_delete_tratante" ON storage.objects;
-- CREATE POLICY "authenticated_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos-pdf');
-- CREATE POLICY "authenticated_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos-pdf');
-- CREATE POLICY "authenticated_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos-pdf');
