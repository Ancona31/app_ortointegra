-- ═══════════════════════════════════════════════════════════════════════
-- REVERSA de supabase/migrations/20261126120000_public_sin_truncate.sql
-- NO es una migración: vive fuera de supabase/migrations/ para que ni la CLI
-- ni un db reset la apliquen. Se pega a mano y SÓLO si Angel lo pide:
-- reabre el hueco (TRUNCATE no pasa por la RLS ni por la auditoría).
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ HACE: deja los permisos como estaban en PRODUCCIÓN antes de la
--   migración:
--   · devuelve TRUNCATE en las 28 tablas del inventario de abajo, a los
--     mismos roles que lo tenían (las que no existan se saltan);
--   · devuelve TRUNCATE en los privilegios por omisión de postgres en public
--     (en producción eran arwdDxtm para los tres roles);
--   · quita los 11 disparadores trg_<tabla>_sin_truncate y la función
--     public.prohibir_truncate().
-- EL INVENTARIO es el de la foto de la estructura de producción (22/11/2026,
--   aclexplode(relacl) de cada tabla de public; todos con otorgante postgres),
--   no el de la base local, que difería en cinco tablas. Fuera de él, a
--   propósito:
--   · audit_log: su TRUNCATE lo quita 20261125170000 (va antes por nombre) y
--     lo devuelve su propia reversa, que se corre después de ésta;
--   · las tablas de la agenda v2 (agenda_ajustes, tipos_cita, …): se crean
--     después de esta migración y ya nacen sin TRUNCATE para esos roles.
--   Si la migración quitó TRUNCATE a alguna tabla que no está aquí (la fila 2
--   de su rejilla las lista, con lo que había en la base al aplicarla),
--   añádela a v_inventario antes de pegar esto.
-- DEPENDE DE: que la migración esté aplicada (si no existe
--   public.prohibir_truncate(), aborta sin tocar nada).
-- RIESGO: bajo. GRANT y ALTER DEFAULT PRIVILEGES sólo escriben catálogo; cada
--   DROP TRIGGER toma ACCESS EXCLUSIVE un instante sobre su tabla
--   (lock_timeout 5 s: si alguna está ocupada, aborta entera). Una transacción.
-- SEGUNDA PASADA: aborta limpio (la función ya no está).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  -- tabla:roles que tenían TRUNCATE en producción antes de la migración (foto de la estructura).
  v_inventario constant text[] := ARRAY[
    'addendums:anon,authenticated,service_role',
    'analitos_catalogo:anon,authenticated,service_role', 'appointments:anon,authenticated,service_role',
    'calculadora_resultados:anon,authenticated,service_role', 'casos_clinicos:anon,authenticated,service_role',
    'casos_clinicos_recursos:anon,authenticated,service_role', 'cat_cie10:anon,authenticated,service_role',
    'clinica_conexiones_google:service_role', 'clinicas:anon,authenticated,service_role',
    'consultas:anon,authenticated,service_role', 'consultorios:anon,authenticated,service_role',
    'documentos:anon,authenticated,service_role', 'firmas_documento:service_role',
    'folios_contador:service_role', 'google_tokens:anon,authenticated,service_role',
    'invitaciones:anon,authenticated,service_role', 'ip_rate_limits:anon,authenticated,service_role',
    'medicamentos:anon,authenticated,service_role', 'mediciones_analitos:anon,authenticated,service_role',
    'paciente_medico:anon,authenticated,service_role', 'pacientes:anon,authenticated,service_role',
    'pdf_jobs:anon,authenticated,service_role', 'plantillas_documento:authenticated,service_role',
    'plantillas_honorarios:anon,authenticated,service_role', 'profiles:anon,authenticated,service_role',
    'rate_limits:anon,authenticated,service_role', 'solicitudes_arco:anon,authenticated,service_role',
    'stripe_webhook_events:anon,authenticated,service_role'];
  v_tablas constant text[] := ARRAY['addendums', 'appointments', 'calculadora_resultados', 'casos_clinicos',
    'casos_clinicos_recursos', 'consultas', 'documentos', 'mediciones_analitos', 'paciente_medico',
    'pacientes', 'solicitudes_arco'];
  v_e text;
  v_t text;
BEGIN
  IF to_regprocedure('public.prohibir_truncate()') IS NULL THEN
    RAISE EXCEPTION 'REVERSA ABORTADA: 20261126120000 no está aplicada (no existe public.prohibir_truncate()). No se toca nada.';
  END IF;
  FOREACH v_e IN ARRAY v_inventario LOOP
    IF to_regclass('public.' || split_part(v_e, ':', 1)) IS NOT NULL THEN
      EXECUTE format('GRANT TRUNCATE ON TABLE public.%I TO %s', split_part(v_e, ':', 1),
                     (SELECT string_agg(quote_ident(r), ', ') FROM unnest(string_to_array(split_part(v_e, ':', 2), ',')) r));
    END IF;
  END LOOP;
  FOREACH v_t IN ARRAY v_tablas LOOP
    IF to_regclass('public.' || v_t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || v_t || '_sin_truncate', v_t);
    END IF;
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT TRUNCATE ON TABLES TO anon, authenticated, service_role;

-- Sin RESTRICT/CASCADE explícito: si algún disparador ajeno la usara, el DROP falla y no se deshace nada a medias.
DROP FUNCTION IF EXISTS public.prohibir_truncate();

COMMIT;

SELECT t.n, t.comprobacion, t.valor
FROM (
  SELECT 1 AS n, 'tablas de public con TRUNCATE para alguno de los tres roles' AS comprobacion,
         (SELECT count(DISTINCT c.oid)::text FROM pg_class c CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) r
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'f')
             AND has_table_privilege(r, c.oid, 'TRUNCATE')) AS valor
  UNION ALL
  SELECT 2, 'disparadores trg_*_sin_truncate que quedan',
         (SELECT count(*)::text FROM pg_trigger WHERE tgname LIKE 'trg\_%\_sin\_truncate' AND NOT tgisinternal)
  UNION ALL
  SELECT 3, 'public.prohibir_truncate()', coalesce(to_regprocedure('public.prohibir_truncate()')::text, 'AUSENTE')
  UNION ALL
  SELECT 4, 'privilegios por omisión de postgres en public (tablas)',
         coalesce((SELECT d.defaclacl::text FROM pg_default_acl d
                    WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace AND d.defaclobjtype = 'r'), 'NINGUNO')
) t
ORDER BY t.n;
