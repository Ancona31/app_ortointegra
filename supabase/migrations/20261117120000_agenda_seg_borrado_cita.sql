-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · corrección de seguridad (punto 3 de Angel) — con la agenda v2
-- encendida, la BASE no deja borrar una cita con paciente o por ligar
-- Rama: feature/agenda-v2-seg2 · Escrita: 2026-11-12
-- Riesgo estimado: BAJO (una función de disparador nueva y un disparador
-- BEFORE DELETE sobre appointments; ninguna policy, ningún permiso de tabla
-- y ningún dato cambian).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres -v ON_ERROR_STOP=1 -f`
--   del archivo completo, dos pasadas seguidas (rejilla 5 × OK las dos; la segunda sin
--   cambios). Antes, en seco con ROLLBACK. Anotada a mano en
--   supabase_migrations.schema_migrations (sin statements). Pruebas: supabase/pruebas-sql/seg_borrado_cita.sql y e2e/seguridad-postgrest.e2e.ts
--   (cada caso en rojo con su mutación, mejora_agendaV2.md §9). Comprobación:
--     select tgname from pg_trigger where tgrelid = 'public.appointments'::regclass
--       and tgname = 'trg_appointments_proteger_borrado';  → 1 fila.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B1 y D1).
-- AUDITORÍA INDEPENDIENTE 2026-11-12 (otro modelo, las 18 dimensiones de
--   supabase/AUDITORIA-MIGRACIONES.md, con pruebas en vivo rol por rol en local): APTA.
--   Único hallazgo: esta línea de ESTADO · LOCAL sin rellenar (rellenada).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- mejora_agendaV2.md §6-bis, «Correcciones de seguridad en la base tras la
-- revisión independiente», punto 3. Con v2 encendida, `DELETE
-- /api/appointments/[id]` contesta 409 `cita_con_paciente` a una cita con
-- paciente (B3) o por ligar (D6): se cancela, no se borra. Pero la RLS
-- (`appointments_delete`) deja a médico, administrador y secretaria borrar
-- cualquier cita de su clínica, así que el mismo DELETE por PostgREST, sin
-- pasar por la API, sí borraba. Las FK RESTRICT de D1/D2/E1/E4/E6 sólo lo
-- paraban en citas con historial de agenda (enlace gastado, incidencia,
-- confirmación, correo, reagendado): la auditoría del conjunto (H1) decía
-- «sin perder datos» y eso sólo era cierto para esas.
--
-- ═══ QUÉ CREA ══════════════════════════════════════════════════════════
-- cita_proteger_borrado() — función de disparador, INVOKER,
--   search_path = ''. Sólo lee OLD y la fila de agenda_ajustes de
--   OLD.clinica_id; NUNCA consulta appointments (sin autorreferencia: la
--   lección de la recursión de 2026-05-04 de CLAUDE.md no aplica a un
--   disparador, pero tampoco se le da ocasión). Rechaza (42501) si
--   agenda_v2_encendida es true y la cita tiene paciente o está por ligar
--   (reserva_canal no nulo). Con v2 apagada, sin fila de ajustes o una cita
--   sin paciente ni reserva, deja borrar como hoy.
-- trg_appointments_proteger_borrado — BEFORE DELETE, FOR EACH ROW.
--
-- ═══ QUIÉN QUEDA FUERA, Y POR QUÉ ═════════════════════════════════════
-- Aplica a authenticated, anon y service_role. service_role también: la
--   API no borra con él, y ningún camino legítimo del servidor borra una
--   cita con paciente con v2 encendida (comprobado: la única baja de la app
--   es la API de sesión; Google no borra filas, cancela —C2/C-e—; la
--   semilla, que borra con service_role, borra ahora agenda_ajustes ANTES
--   que las citas, scripts/agenda-semilla.ts).
-- No aplica a postgres ni a supabase_admin (el editor SQL, los ayudantes
--   de las e2e y las acciones referenciales —CASCADE desde clinicas, que
--   Postgres ejecuta como dueño de la tabla—), el mismo patrón por
--   current_user de B1 y D1. No son alcanzables por PostgREST.
-- La lectura de agenda_ajustes es con los permisos de quien borra: la RLS
--   (`agenda_ajustes_select`, clinica_id = get_clinica_id()) le deja ver la
--   de su clínica, que es la de la cita (la RLS de DELETE ya lo exige).
--   service_role la ve por BYPASSRLS. anon no tiene SELECT: error, no
--   borra (falla cerrado; tampoco tiene policy de DELETE).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B1 y D1. PG ≥ 14 (CREATE OR REPLACE TRIGGER).
-- Bloqueos (lock_timeout 5 s): CREATE TRIGGER toma SHARE ROW EXCLUSIVE
--   sobre appointments un instante (bloquea escrituras, no lecturas).
-- Orden respecto al código: cualquiera. El código de esta corrección
--   (traducir el 42501 del DELETE a 409) tolera la base sin el disparador.
-- Alcance de los roles:
--   pierde — authenticated y service_role: borrar una cita con paciente o
--            por ligar en una clínica con v2 encendida (la API ya no lo
--            hacía). anon: nada (no tenía policy).
--   gana   — nadie.
-- Contrato con spinus-consola: ninguna columna cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TRIGGER IF EXISTS trg_appointments_proteger_borrado ON public.appointments;
--   DROP FUNCTION IF EXISTS public.cita_proteger_borrado();
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.agenda_ajustes') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.agenda_ajustes (B1).';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.appointments.', current_user;
  END IF;
  -- El cuerpo plpgsql no se valida al crearse: las columnas que nombra, aquí.
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('clinica_id', 'uuid'::regtype), ('agenda_v2_encendida', 'bool'::regtype))) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: agenda_ajustes sin clinica_id uuid o agenda_v2_encendida boolean (B1).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('clinica_id', 'uuid'::regtype), ('paciente_id', 'uuid'::regtype),
                                    ('reserva_canal', 'text'::regtype))) <> 3 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments sin clinica_id, paciente_id o reserva_canal (D1).';
  END IF;
  -- Sin estos permisos, el disparador fallaría en cada baja y no sólo en las prohibidas.
  IF NOT (has_table_privilege('authenticated', 'public.agenda_ajustes', 'SELECT')
          AND has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: authenticated o service_role sin SELECT en agenda_ajustes.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_borrado()') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_proteger_borrado() existe como SECURITY DEFINER; tiene que ser invoker.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La función y el disparador.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_proteger_borrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN OLD;
  END IF;
  IF OLD.paciente_id IS NULL AND OLD.reserva_canal IS NULL THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM public.agenda_ajustes j
              WHERE j.clinica_id = OLD.clinica_id AND j.agenda_v2_encendida IS TRUE) THEN
    RAISE EXCEPTION 'Una cita con paciente o por ligar no se borra: se cancela'
      USING ERRCODE = '42501', HINT = 'Cancélala (status cancelled) en vez de borrarla';
  END IF;
  RETURN OLD;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.cita_proteger_borrado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_borrado() TO anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trg_appointments_proteger_borrado
  BEFORE DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.cita_proteger_borrado();

COMMENT ON FUNCTION public.cita_proteger_borrado() IS
  'Agenda v2 (corrección de seguridad, punto 3): con agenda_ajustes.agenda_v2_encendida, una cita con paciente o por ligar (reserva_canal no nulo) no se borra: se cancela (B3/D6). Lee sólo OLD y agenda_ajustes, nunca appointments. postgres y supabase_admin quedan fuera (editor SQL, acciones referenciales); service_role, no.';

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'disparador BEFORE DELETE en appointments' AS comprobacion,
         coalesce((SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                    AND tgname = 'trg_appointments_proteger_borrado' AND tgenabled = 'O'), 'AUSENTE') AS valor,
         'CREATE TRIGGER trg_appointments_proteger_borrado BEFORE DELETE ON public.appointments FOR EACH ROW EXECUTE FUNCTION cita_proteger_borrado()' AS esperado
  UNION ALL
  SELECT 2, 'función INVOKER con search_path vacío',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_borrado()')), 'AUSENTE'),
         'true / true'
  UNION ALL
  SELECT 3, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_proteger_borrado()')), 'AUSENTE'),
         'true,true,true / false'
  UNION ALL
  SELECT 4, 'la función no nombra appointments (sin autorreferencia)',
         coalesce((SELECT (prosrc !~* 'appointments')::text FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_borrado()')), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 5, 'las 5 policies de appointments, intactas',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
) t
ORDER BY t.n;
