-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda I, punto 1 de Angel — una cita ATENDIDA con nota clínica
-- tampoco se MUEVE con la agenda v2 apagada (la base, siempre)
-- Rama: feature/agenda-v2-i4 · Escrita: 2026-11-17
-- Riesgo estimado: BAJO (sólo CREATE OR REPLACE del cuerpo de
-- cita_proteger_atendida(); el disparador, la otra función, las policies, los
-- permisos de tabla y los datos no cambian).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-17
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres -v ON_ERROR_STOP=1 -f`
--   del archivo completo: un ensayo con ROLLBACK y luego dos pasadas seguidas (rejilla
--   6 × OK las dos; la segunda sin cambios, sólo NOTICEs). Registrada en
--   supabase_migrations.schema_migrations. Pruebas: supabase/pruebas-sql/i4_*.sql.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de 20261120130000; es
--   independiente del interruptor: aplica con la v2 encendida y apagada).
-- AUDITORÍA INDEPENDIENTE 2026-11-17 (otro modelo, las dimensiones de
--   supabase/AUDITORIA-MIGRACIONES.md, con lectura del catálogo local): APTA.
--   Sin hallazgos bloqueantes ni menores; notas: el bypass de postgres y
--   supabase_admin es el patrón vigente (H5, seg2), y el alcance de roles
--   coincide con la cabecera.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 1 de Angel (2026-11-17): «cierra también con la v2 apagada que una
-- cita atendida con nota se pueda mover de fecha u hora. Siempre, en
-- cualquier clínica.» Era la decisión pendiente (1) de la tanda H
-- (mejora_agendaV2.md §7): 20261120130000 cerraba el ESTADO y el BORRADO
-- siempre, pero MOVER sólo con agenda_v2_encendida, porque la app (v2
-- apagada) dejaba arrastrarla. Ahora la ruta también lo rechaza siempre
-- (`vetoPorNotaLigada`, 409 `nota_ligada`) y la base lo cierra igual.
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- cita_proteger_atendida() — mismo nombre, misma firma, INVOKER,
--   search_path = ''. La ÚNICA diferencia con 20261120130000: mover
--   (start_time, end_time o all_day) una atendida con nota da 42501 SIEMPRE;
--   ya no se lee agenda_ajustes. Estado y borrado, como estaban (siempre).
--   Sin nota, todo como antes (se mueve, se corrige el estado, se borra).
--   Reescribir los MISMOS valores pasa (IS NOT DISTINCT FROM).
-- trg_appointments_proteger_atendida — NO se toca (BEFORE UPDATE OF status,
--   start_time, end_time, all_day OR DELETE, WHEN OLD.status = 'attended').
-- cita_tiene_nota_ligada(uuid, uuid) — NO se toca.
--
-- ═══ CHOQUES CON LO QUE YA EXISTE (comprobados) ═══════════════════════
-- Con la v2 apagada, ¿qué escribe start/end de una atendida? En src/: el
--   arrastre y el formulario (PUT /api/appointments/[id]), que ahora vetan
--   antes con 409 `nota_ligada`; Google con la v2 apagada no se lee de vuelta
--   (C10: gcal_aplicar_evento sólo corre en la sincronización de la v2 y sólo
--   escribe agendadas/confirmadas). En la base: ninguna función de public
--   escribe start_time/end_time de una atendida (las mismas comprobadas en
--   20261120130000). La semilla y las e2e escriben como postgres (fuera).
-- trg_appointments_proteger_borrado y _reserva: sin cambio (otras columnas).
-- log_cita_change: AFTER; lo rechazado no deja auditoría.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere 20261120130000 (con su cuerpo, por md5). PG ≥ 14.
-- Bloqueos: CREATE OR REPLACE FUNCTION sólo toca el catálogo.
-- Orden respecto al código: cualquiera. El código nuevo veta antes (409);
--   sin esta migración, con la v2 apagada la base aún dejaría mover por
--   PostgREST directo (la API no).
-- Alcance de los roles:
--   pierde — authenticated y service_role: mover una atendida con nota con
--            la v2 apagada (la API ya no lo hace).
--   gana   — nadie.
-- Contrato con spinus-consola: ninguna columna cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   Volver a ejecutar la sección 2 de 20261120130000 (el CREATE OR REPLACE
--   de cita_proteger_atendida() y sus dos líneas de permisos).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  c_md5_h5 CONSTANT text := '74dde456021053f4a15a0c1c5325c4f2';  -- 20261120130000
  c_md5_i4 CONSTANT text := 'cfc4fcd74f849868e18f6d27ca8f2969';                          -- esta migración (re-ejecución)
  v_md5    text;
BEGIN
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_atendida()');
  IF v_md5 IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.cita_proteger_atendida() (20261120130000).';
  END IF;
  IF v_md5 NOT IN (c_md5_h5, c_md5_i4) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_proteger_atendida() tiene otro cuerpo (md5 %).', v_md5;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_atendida()') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_proteger_atendida() es SECURITY DEFINER; tiene que ser invoker.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.cita_tiene_nota_ligada(uuid, uuid)')
                  AND prosecdef AND prorettype = 'bool'::regtype) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta cita_tiene_nota_ligada(uuid, uuid) DEFINER → boolean (20261120130000).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                  AND tgname = 'trg_appointments_proteger_atendida' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta el disparador trg_appointments_proteger_atendida (20261120130000).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · El cuerpo nuevo: mover una atendida con nota se cierra siempre.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_proteger_atendida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') OR OLD.status IS DISTINCT FROM 'attended' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  -- Tanda I (punto 1): ni estado, ni fecha u hora, ni todo el día; con la v2 encendida o apagada.
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND (NEW.start_time, NEW.end_time, NEW.all_day) IS NOT DISTINCT FROM (OLD.start_time, OLD.end_time, OLD.all_day) THEN
    RETURN NEW;
  END IF;
  IF public.cita_tiene_nota_ligada(OLD.id, OLD.clinica_id) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Una cita atendida con nota clínica no se borra'
        USING ERRCODE = '42501', HINT = 'La nota es expediente: la cita se queda como atendida';
    END IF;
    RAISE EXCEPTION 'Una cita atendida con nota clínica no cambia de estado ni de fecha u hora'
      USING ERRCODE = '42501', HINT = 'La nota es expediente: la cita se queda como atendida';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$fn$;

-- Permisos de funciones (CLAUDE.md): CREATE OR REPLACE los conserva; se repiten explícitos.
REVOKE EXECUTE ON FUNCTION public.cita_proteger_atendida() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_atendida() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.cita_proteger_atendida() IS
  'Agenda (tanda H punto 22; tanda I punto 1): una cita atendida con nota clínica ligada no cambia de estado, no se mueve de fecha, hora o todo el día y no se borra, con la agenda v2 encendida o apagada, como vetoPorNotaLigada de la API. 42501. Lee OLD/NEW y cita_tiene_nota_ligada(); nunca appointments. postgres y supabase_admin quedan fuera (editor SQL, acciones referenciales); service_role, no.';

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'cita_proteger_atendida: cuerpo de esta migración (md5)' AS comprobacion,
         coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_atendida()')), 'AUSENTE') AS valor,
         'cfc4fcd74f849868e18f6d27ca8f2969' AS esperado
  UNION ALL
  SELECT 2, 'INVOKER con search_path vacío; ya no lee agenda_ajustes ni appointments',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text || ' / '
                          || (prosrc !~* 'agenda_ajustes')::text || ' / ' || (prosrc !~* 'appointments')::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_atendida()')), 'AUSENTE'),
         'true / true / true / true'
  UNION ALL
  SELECT 3, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_proteger_atendida()')), 'AUSENTE'),
         'true,true,true / false'
  UNION ALL
  SELECT 4, 'el disparador sigue igual',
         coalesce((SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                    AND tgname = 'trg_appointments_proteger_atendida' AND tgenabled = 'O'), 'AUSENTE'),
         'CREATE TRIGGER trg_appointments_proteger_atendida BEFORE DELETE OR UPDATE OF status, start_time, end_time, all_day ON public.appointments FOR EACH ROW WHEN ((old.status = ''attended''::text)) EXECUTE FUNCTION cita_proteger_atendida()'
  UNION ALL
  SELECT 5, 'cita_tiene_nota_ligada sin cambio (md5)',
         coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.cita_tiene_nota_ligada(uuid, uuid)')), 'AUSENTE'),
         '39f40c71d0fa9287e3caa522f6fa80fe'
  UNION ALL
  SELECT 6, 'las 5 policies de appointments, intactas (nombres)',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
) t
ORDER BY t.n;
