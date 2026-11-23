-- scripts/local/almacenes-locales.sql — SÓLO LA BASE LOCAL.
--
-- Deja en la Supabase local los seis almacenes (buckets) de Storage que tiene
-- producción, con el mismo id, público/privado, límite de tamaño y tipos
-- permitidos, y las 13 policies de `storage.objects` de producción. Fuente: la
-- foto de estructura del 2026-11-22 (`06-buckets.tsv` y el catálogo); Angel
-- autorizó copiar ESTO de la foto: «Son estructura, no datos ni secretos».
--
-- Por qué hace falta: ninguna migración crea los buckets (en producción se
-- crearon en el panel), y `supabase db reset --local` los borra. Sin ellos el
-- PDF de un documento no se guarda, «Enviar por correo» no tiene adjunto y
-- «Regenerar» queda bloqueado. Las policies sí las traen las migraciones
-- (`20260912190416_remote_schema.sql`); aquí sólo se crean si FALTAN, nunca se
-- reescriben: si una migración cambia una, manda la migración.
--
-- NO es una migración ni va a producción. Idempotente. Lo corre
-- `scripts/local/almacenes-locales.sh` (y la semilla, que lo llama).

\set ON_ERROR_STOP on

DO $$
BEGIN
  -- Defensa en profundidad: el .sh sólo habla con el contenedor local por su
  -- socket (inet_server_addr() NULL). Por TCP, sólo a una dirección local.
  IF inet_server_addr() IS NOT NULL
     AND NOT (inet_server_addr() << inet '127.0.0.0/8' OR inet_server_addr() = inet '::1') THEN
    RAISE EXCEPTION 'almacenes-locales: la base no es local (%). No se toca nada.', inet_server_addr();
  END IF;
END $$;

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('casos-clinicos',   'casos-clinicos',   false, 15728640, ARRAY['image/jpeg','image/png']),
  ('clinica-logos',    'clinica-logos',    true,  NULL,     NULL),
  ('documentos-pdf',   'documentos-pdf',   false, NULL,     NULL),
  ('firmas-medicos',   'firmas-medicos',   false, NULL,     NULL),
  ('identificaciones', 'identificaciones', false, 5242880,  ARRAY['image/jpeg','image/png']),
  ('labs-documentos',  'labs-documentos',  false, 52428800,
     ARRAY['application/pdf','image/jpeg','image/png','application/dicom','application/octet-stream'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
DECLARE
  -- Prefijos de las condiciones repetidas, tal cual están en producción.
  clinica text := $q$(("storage"."foldername"("name"))[1] = 'clinicas'::"text") AND (("storage"."foldername"("name"))[2] = ("public"."get_clinica_id"())::"text")$q$;
  tratante text := $q$"public"."soy_medico_tratante"(CASE WHEN (("storage"."foldername"("name"))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::"text") THEN (("storage"."foldername"("name"))[1])::"uuid" ELSE NULL::"uuid" END)$q$;
  p record;
BEGIN
  FOR p IN
    SELECT * FROM (VALUES
      ('casos_clinicos_storage_delete_propia_clinica', 'FOR DELETE TO "authenticated" USING', 'casos-clinicos', 'c'),
      ('casos_clinicos_storage_insert_propia_clinica', 'FOR INSERT TO "authenticated" WITH CHECK', 'casos-clinicos', 'c'),
      ('casos_clinicos_storage_select_propia_clinica', 'FOR SELECT TO "authenticated" USING', 'casos-clinicos', 'c'),
      ('casos_clinicos_storage_update_propia_clinica', 'FOR UPDATE TO "authenticated" USING', 'casos-clinicos', 'c'),
      ('documentos_pdf_delete_tratante', 'FOR DELETE TO "authenticated" USING', 'documentos-pdf', 't'),
      ('documentos_pdf_insert_tratante', 'FOR INSERT TO "authenticated" WITH CHECK', 'documentos-pdf', 't'),
      ('documentos_pdf_select_tratante', 'FOR SELECT TO "authenticated" USING', 'documentos-pdf', 't'),
      ('labs_documentos_delete_propia_clinica', 'FOR DELETE TO "authenticated" USING', 'labs-documentos', 'c'),
      ('labs_documentos_insert_propia_clinica', 'FOR INSERT TO "authenticated" WITH CHECK', 'labs-documentos', 'c'),
      ('labs_documentos_select_propia_clinica', 'FOR SELECT TO "authenticated" USING', 'labs-documentos', 'c'),
      ('labs_documentos_update_propia_clinica', 'FOR UPDATE TO "authenticated" USING', 'labs-documentos', 'c')
    ) AS v(nombre, clausula, bucket, tipo)
  LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = p.nombre);
    EXECUTE format('CREATE POLICY %I ON "storage"."objects" %s ((("bucket_id" = %L::"text") AND ("auth"."uid"() IS NOT NULL) AND %s))',
      p.nombre, p.clausula, p.bucket, CASE p.tipo WHEN 'c' THEN clinica ELSE tratante END);
    RAISE NOTICE 'almacenes-locales: creada la policy %', p.nombre;
  END LOOP;

  -- Las dos de denegación total (el servidor entra con service_role).
  FOR p IN SELECT * FROM (VALUES ('firmas_medicos_deny_all_users', 'firmas-medicos'), ('identificaciones_deny_all_users', 'identificaciones')) AS v(nombre, bucket)
  LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = p.nombre);
    EXECUTE format('CREATE POLICY %I ON "storage"."objects" AS RESTRICTIVE TO "authenticated", "anon" USING (("bucket_id" <> %L::"text")) WITH CHECK (("bucket_id" <> %L::"text"))',
      p.nombre, p.bucket, p.bucket);
    RAISE NOTICE 'almacenes-locales: creada la policy %', p.nombre;
  END LOOP;
END $$;

COMMIT;

SELECT 'almacenes-locales: ' || count(*) || ' buckets' FROM storage.buckets
 WHERE id IN ('casos-clinicos','clinica-logos','documentos-pdf','firmas-medicos','identificaciones','labs-documentos');
