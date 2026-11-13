-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · corrección de seguridad (punto 4 de Angel) — las columnas
-- reserva_* de appointments sólo las escribe el servidor
-- Rama: feature/agenda-v2-seg2 · Escrita: 2026-11-12
-- Riesgo estimado: BAJO (una función de disparador nueva y un disparador
-- BEFORE INSERT OR UPDATE sobre appointments; ninguna policy, ningún permiso
-- de tabla y ningún dato cambian).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres -v ON_ERROR_STOP=1 -f`
--   del archivo completo, dos pasadas seguidas (rejilla 5 × OK las dos; la segunda sin
--   cambios). Antes, en seco con ROLLBACK. Anotada a mano en
--   supabase_migrations.schema_migrations (sin statements). Pruebas: supabase/pruebas-sql/seg_columnas_reserva.sql y e2e/seguridad-postgrest.e2e.ts
--   (cada caso en rojo con su mutación, mejora_agendaV2.md §9). Comprobación:
--     select tgname from pg_trigger where tgrelid = 'public.appointments'::regclass
--       and tgname = 'trg_appointments_proteger_reserva';  → 1 fila.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de D1 y E6).
-- AUDITORÍA INDEPENDIENTE 2026-11-12 (otro modelo, las 18 dimensiones de
--   supabase/AUDITORIA-MIGRACIONES.md, con pruebas en vivo rol por rol en local): APTA.
--   Único hallazgo: esta línea de ESTADO · LOCAL sin rellenar (rellenada).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- mejora_agendaV2.md §6-bis, «Correcciones de seguridad en la base tras la
-- revisión independiente», punto 4. La RLS de appointments es por fila:
-- médico, administrador y secretaria pueden INSERT/UPDATE de cualquier
-- columna de una cita de su clínica por PostgREST. Las columnas reserva_*
-- son la constancia de la reserva por enlace (aceptación del aviso y su
-- versión, los seudónimos HMAC del candado, el historial al reservar, los
-- reagendados) y sólo las escribe el servidor: reservar_por_enlace (D3) y
-- reagendar_por_enlace (E6), con service_role. Con la sesión se podía
-- falsear una aceptación del aviso, mover una cita fuera del candado
-- (cambiando el hmac) o fabricar una cita «por ligar» (la nota de D6, (b)).
--
-- ═══ QUÉ CREA ══════════════════════════════════════════════════════════
-- cita_proteger_reserva() — función de disparador, INVOKER,
--   search_path = ''. Para todo rol que no sea postgres, supabase_admin o
--   service_role:
--   · INSERT: toda columna reserva_* tiene que venir NULL, salvo
--     reserva_reagendados, que tiene que valer 0 (su DEFAULT).
--   · UPDATE: ninguna columna reserva_* puede cambiar, SALVO poner
--     reserva_telefono o reserva_correo en NULL (supresión de datos a
--     petición del titular; los *_hmac se quedan para el candado, como dice
--     el COMMENT de esas columnas desde D1).
--   Rechaza con 42501 nombrando la columna. No consulta ninguna tabla.
-- trg_appointments_proteger_reserva — BEFORE INSERT OR UPDATE, FOR EACH ROW.
--
-- ═══ POR QUÉ UN DISPARADOR Y NO PRIVILEGIOS POR COLUMNA ═════════════════
-- (b) REVOKE INSERT/UPDATE de tabla + GRANT por columna obligaría a listar
--   las ~40 columnas permitidas y a recordar cada columna futura (una
--   olvidada rompe la app de golpe); toca los privilegios de la tabla con
--   datos clínicos que lee spinus-consola; y no puede expresar «sólo hacia
--   NULL». (a) el disparador lista las columnas desde la FILA (to_jsonb,
--   prefijo reserva_), así que una columna reserva_* futura queda cerrada
--   sin tocarlo. CONVENIO QUE LA BASE NO PUEDE IMPONER (dimensión 16): una
--   columna nueva con el prefijo reserva_ es del servidor; si alguna vez
--   tiene que escribirla la sesión, no puede llevar ese prefijo o hay que
--   cambiar esta función. Va en el COMMENT de la función.
--
-- ═══ QUIÉN QUEDA FUERA, Y POR QUÉ ═════════════════════════════════════
-- service_role (las RPC de reserva y reagendado, la sincronización de
--   Google, la semilla), postgres y supabase_admin (editor SQL, funciones
--   SECURITY DEFINER suyas, acciones referenciales). Ningún camino de la app
--   escribe reserva_* con la sesión: el alta y el PUT de
--   /api/appointments construyen el objeto campo a campo sin reserva_*;
--   ligar (D7) sólo manda paciente_id y title; cambiar el estado, WhatsApp
--   (E) y /api/consultas tocan status, whatsapp_* y updated_at.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere D1 (y E6, que no añade columnas reserva_* pero las escribe).
-- PG ≥ 14. Bloqueos (lock_timeout 5 s): CREATE TRIGGER toma SHARE ROW
--   EXCLUSIVE sobre appointments un instante.
-- Costo: to_jsonb de la fila en cada escritura de la sesión (dos en un
--   UPDATE). Las escrituras de citas son de una en una; el AFTER UPDATE de
--   B0 ya hace lo mismo.
-- Orden respecto al código: cualquiera (el código no cambia).
-- Alcance de los roles:
--   pierde — authenticated y anon: escribir reserva_* (salvo vaciar
--            teléfono y correo). Nada que hicieran a diario.
--   gana   — nadie.
-- Contrato con spinus-consola: ninguna columna ni permiso cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TRIGGER IF EXISTS trg_appointments_proteger_reserva ON public.appointments;
--   DROP FUNCTION IF EXISTS public.cita_proteger_reserva();
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.appointments.', current_user;
  END IF;
  -- Las tres columnas que la función nombra por su nombre.
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('reserva_telefono', 'text'::regtype), ('reserva_correo', 'text'::regtype),
                                    ('reserva_reagendados', 'int2'::regtype))) <> 3 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments sin reserva_telefono, reserva_correo o reserva_reagendados (D1).';
  END IF;
  -- Si reserva_reagendados dejara de nacer en 0, el INSERT de la sesión fallaría siempre.
  IF coalesce((SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attrdef d JOIN pg_attribute a
                 ON a.attrelid = d.adrelid AND a.attnum = d.adnum
                WHERE d.adrelid = 'public.appointments'::regclass AND a.attname = 'reserva_reagendados'), '') <> '0' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments.reserva_reagendados no tiene DEFAULT 0.';
  END IF;
  -- Ninguna otra reserva_* con DEFAULT: el INSERT de la sesión las exige NULL.
  IF EXISTS (SELECT 1 FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
              WHERE d.adrelid = 'public.appointments'::regclass AND a.attname LIKE 'reserva\_%'
                AND a.attname <> 'reserva_reagendados' AND NOT a.attisdropped) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay una columna reserva_* con DEFAULT además de reserva_reagendados.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_reserva()') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_proteger_reserva() existe como SECURITY DEFINER; tiene que ser invoker.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La función y el disparador.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_proteger_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_columna text;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT n.key INTO v_columna FROM jsonb_each(to_jsonb(NEW)) n
     WHERE n.key LIKE 'reserva\_%'
       AND n.value IS DISTINCT FROM (CASE WHEN n.key = 'reserva_reagendados' THEN '0' ELSE 'null' END)::jsonb
     ORDER BY n.key LIMIT 1;
  ELSE
    SELECT n.key INTO v_columna FROM jsonb_each(to_jsonb(NEW)) n
      JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
     WHERE n.key LIKE 'reserva\_%'
       AND n.value IS DISTINCT FROM o.value
       AND NOT (n.key IN ('reserva_telefono', 'reserva_correo') AND n.value = 'null'::jsonb)
     ORDER BY n.key LIMIT 1;
  END IF;
  IF v_columna IS NOT NULL THEN
    RAISE EXCEPTION 'La columna % de la cita sólo la escribe el servidor', v_columna
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.cita_proteger_reserva() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_reserva() TO anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trg_appointments_proteger_reserva
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.cita_proteger_reserva();

COMMENT ON FUNCTION public.cita_proteger_reserva() IS
  'Agenda v2 (corrección de seguridad, punto 4): las columnas reserva_* de appointments sólo las escribe el servidor (service_role: reservar_por_enlace, reagendar_por_enlace; o postgres/supabase_admin). La sesión no las pone al crear (todas NULL, reserva_reagendados 0) ni las cambia al editar, salvo vaciar reserva_telefono/reserva_correo (supresión a petición del titular). CONVENIO: toda columna nueva con prefijo reserva_ queda cerrada sola (se listan desde la fila).';

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'disparador BEFORE INSERT OR UPDATE en appointments' AS comprobacion,
         coalesce((SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                    AND tgname = 'trg_appointments_proteger_reserva' AND tgenabled = 'O'), 'AUSENTE') AS valor,
         'CREATE TRIGGER trg_appointments_proteger_reserva BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION cita_proteger_reserva()' AS esperado
  UNION ALL
  SELECT 2, 'función INVOKER con search_path vacío',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_reserva()')), 'AUSENTE'),
         'true / true'
  UNION ALL
  SELECT 3, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_proteger_reserva()')), 'AUSENTE'),
         'true,true,true / false'
  UNION ALL
  SELECT 4, 'columnas reserva_* que cubre (desde el catálogo)',
         (SELECT string_agg(attname, ',' ORDER BY attname) FROM pg_attribute
           WHERE attrelid = 'public.appointments'::regclass AND attname LIKE 'reserva\_%' AND NOT attisdropped),
         'reserva_aceptado_en,reserva_aviso_version,reserva_canal,reserva_correo,reserva_correo_hmac,reserva_enlace_id,reserva_historial_previo,reserva_nombre,reserva_reagendados,reserva_tel_hmac,reserva_telefono'
  UNION ALL
  SELECT 5, 'las 5 policies de appointments, intactas',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
) t
ORDER BY t.n;
