-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda H, punto 22 de Angel — la BASE no deja mover ni cambiar de
-- estado (ni borrar) una cita ATENDIDA con nota clínica ligada
-- Rama: feature/agenda-v2-h5 · Escrita: 2026-11-15
-- Riesgo estimado: BAJO (dos funciones nuevas y un disparador BEFORE UPDATE
-- OR DELETE sobre appointments; ninguna policy, ningún permiso de tabla y
-- ningún dato cambian).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-15
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres -v ON_ERROR_STOP=1 -f`
--   del archivo completo, dos pasadas seguidas (rejilla 8 × OK las dos; la segunda sin
--   cambios). Antes, en seco con ROLLBACK. Anotada a mano en
--   supabase_migrations.schema_migrations (sin statements). Prueba:
--   supabase/pruebas-sql/h5_atendida_con_nota.sql (en rojo sin la migración y con sus dos
--   mutaciones). Comprobación:
--     select tgname from pg_trigger where tgrelid = 'public.appointments'::regclass
--       and tgname = 'trg_appointments_proteger_atendida';  → 1 fila.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B1; con o sin el
--   resto de la agenda v2, porque el estado y el borrado se cierran también
--   con el interruptor apagado).
-- AUDITORÍA INDEPENDIENTE 2026-11-15 (otro modelo, las 18 dimensiones de
--   supabase/AUDITORIA-MIGRACIONES.md, con lectura del catálogo y la prueba en vivo en
--   local): APTA CON CAMBIOS. Único cambio: la línea de ESTADO · LOCAL, que decía
--   PENDIENTE estando aplicada (rellenada). Hallazgo sin cambio de código:
--   cita_tiene_nota_ligada() deja pasar el filtro de clínica con auth.uid() NULL; es
--   para service_role (su JWT no lleva sub y ya lee consultas sin RLS), y un JWT
--   «authenticated» sin sub exigiría el secreto de firma del proyecto (el mismo acceso
--   que la llave de service_role). Se deja así, anotado.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 22 de Angel (2026-11-15): «Cierra en la base, no solo en la app, que
-- una cita atendida con nota no se pueda mover ni cambiar de estado entrando
-- directo por PostgREST, igual que ya se cerró el borrado.» AG-DT-61.
-- Hoy lo cierra SÓLO la API (`PUT`/`DELETE /api/appointments/[id]`):
--   · `vetoPorNotaLigada` (G3, decisión 3 de Angel): una atendida con fila en
--     consultas.appointment_id no pasa a NINGÚN otro estado y no se borra,
--     con la v2 encendida o apagada (la nota es expediente, NOM-004);
--   · `vetoPorEstado` (G3, 17.3): con la v2 encendida, una atendida no se
--     mueve de fecha ni de hora (ni de/a todo el día).
-- La RLS (`appointments_update`/`appointments_delete`) deja a médico,
-- administrador y secretaria hacer las dos cosas por PostgREST, sin la API;
-- y `cita_proteger_borrado` (seg2) sólo cierra el borrado con la v2
-- encendida, así que con la v2 apagada la nota se quedaba sin cita (la FK de
-- consultas.appointment_id es SET NULL).
--
-- ═══ QUÉ CREA ══════════════════════════════════════════════════════════
-- cita_tiene_nota_ligada(p_cita uuid, p_clinica uuid) → boolean.
--   SECURITY DEFINER, STABLE, search_path = ''. SÓLO dice si existe una nota
--   (consultas) con appointment_id = p_cita de un paciente de p_clinica: el
--   mismo criterio que `tieneNotaLigada` (notaLigadaServidor.ts). Devuelve un
--   booleano y nada más: ni ids, ni contenido, ni conteo.
--   POR QUÉ DEFINER: la RLS de consultas (`consultas_select`) sólo enseña sus
--   notas al médico que las escribió y al administrador; con la sesión de la
--   secretaria o de otro médico la nota «no existiría» y la regla dejaría de
--   valer para ellos (el mismo motivo por el que la API usa el cliente de
--   servicio). La función es DEFINER, no el disparador: el disparador tiene
--   que seguir viendo QUIÉN escribe (current_user) para dejar fuera a
--   postgres/supabase_admin, y dentro de una DEFINER current_user es el dueño.
--   Lo que puede leer quien la llame por RPC: con sesión (auth.uid() no
--   nulo), sólo de SU clínica (p_clinica = get_clinica_id(); otra clínica →
--   false) y sólo si una cita suya tiene nota, que la API ya le dice con el
--   409 `nota_ligada` (AG-DT-63, decisión de Angel). Sin sesión: anon NO
--   tiene EXECUTE; service_role sí (ya lee consultas por BYPASSRLS: no gana
--   nada).
-- cita_proteger_atendida() — función de disparador, INVOKER,
--   search_path = ''. Sólo lee OLD/NEW, la fila de agenda_ajustes de
--   OLD.clinica_id (con los permisos de quien escribe, como seg2) y la
--   función de arriba. NUNCA consulta appointments (sin autorreferencia).
--   Con OLD.status = 'attended' y nota ligada → 42501:
--   · UPDATE que cambia status (a lo que sea) — con la v2 encendida O apagada,
--     como `vetoPorNotaLigada`;
--   · UPDATE que cambia start_time, end_time o all_day — SÓLO con la v2
--     encendida, como `vetoPorEstado` (apagada, la app deja mover una
--     atendida, y la tolerancia exige que siga igual);
--   · DELETE — con la v2 encendida O apagada, como la API.
--   Lo demás de una atendida con nota sigue editable: notas, consultorio,
--   médico, título, paciente, Google (`gcal_*`), WhatsApp, `reserva_*` (esas,
--   con su propio disparador).
-- trg_appointments_proteger_atendida — BEFORE UPDATE OF status, start_time,
--   end_time, all_day OR DELETE, FOR EACH ROW, WHEN (OLD.status =
--   'attended'): la función sólo corre para las atendidas y sólo si la
--   sentencia nombra esas columnas.
--
-- ═══ QUÉ COLUMNAS QUEDAN CONGELADAS, Y POR QUÉ ESAS ═══════════════════
-- Estado y fecha/hora, lo que pidió Angel; all_day con ellas porque pasar a
-- (o salir de) todo el día mueve la cita (la API lo trata igual:
-- `cambiaDia` de vetoPorEstado). Médico y consultorio NO: la API deja
-- corregir el consultorio de una atendida (17.3) y ninguna regla de hoy
-- cierra el médico; congelarlos cambiaría más de lo pedido.
--
-- ═══ QUIÉN QUEDA FUERA, Y POR QUÉ ═════════════════════════════════════
-- Aplica a authenticated (las tres funciones de la clínica) y a service_role.
--   service_role también: ningún camino del servidor cambia el estado o la
--   hora de una atendida ni la borra (comprobado en el catálogo y en src/):
--   gcal_aplicar_evento escribe start/end/status sólo si la cita está
--   scheduled/confirmed (a una atendida le reescribe los MISMOS valores, y el
--   disparador compara con IS DISTINCT FROM); cita_confirmacion_responder
--   devuelve «cerrada» a una atendida antes de escribir; cita_rsvp_google
--   sólo pasa scheduled → confirmed; reagendar_por_enlace sólo parte de una
--   cancelada; POST /api/consultas marca attended desde scheduled/confirmed;
--   las escrituras de gcal_* (sync, reparación) no nombran esas columnas.
-- No aplica a postgres ni a supabase_admin (el patrón de B1, D1 y seg2):
--   editor SQL, ayudantes de las e2e (sqlLocal), y las acciones referenciales
--   (un CASCADE desde clinicas llega como dueño de la tabla). No son
--   alcanzables por PostgREST.
-- anon: no tiene policy de UPDATE ni de DELETE en appointments, así que la
--   RLS no le deja ninguna fila y el disparador no llega a correr; si
--   corriera, no tiene EXECUTE de la función DEFINER: error, falla cerrado.
--
-- ═══ CHOQUES CON LO QUE YA EXISTE (comprobados) ═══════════════════════
-- trg_appointments_proteger_borrado (seg2): con la v2 encendida los dos
--   rechazan el DELETE de una atendida con nota y paciente; el orden de los
--   BEFORE es alfabético (atendida < borrado < reserva) y los dos dan 42501:
--   la API ya traduce el 42501 del DELETE a 409 (no llega: veta antes).
-- trg_appointments_proteger_reserva (seg2): mira otras columnas; ninguno de
--   los dos cambia NEW.
-- log_cita_change (B0): AFTER; una escritura rechazada no deja auditoría
--   (no hubo cambio).
-- La semilla: `exigirSinExpediente` se niega a borrar si hay notas sobre
--   pacientes sembrados, así que nunca borra una atendida con nota. Las e2e
--   que crean una nota (`agenda-g3-tarjeta`) la borran como postgres antes
--   de borrar la cita, y borran las citas como postgres.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B1 (agenda_ajustes). PG ≥ 14 (CREATE OR REPLACE TRIGGER).
-- Bloqueos (lock_timeout 5 s): CREATE TRIGGER toma SHARE ROW EXCLUSIVE
--   sobre appointments un instante (bloquea escrituras, no lecturas).
-- Orden respecto al código: cualquiera. Ningún código cambia: la API ya
--   veta antes (409); el disparador sólo actúa por PostgREST directo o en
--   una carrera entre la comprobación de la API y su UPDATE.
-- Alcance de los roles:
--   pierde — authenticated y service_role: cambiar el estado o borrar una
--            atendida con nota (siempre), y moverla (con la v2 encendida).
--            La API ya no lo hacía en ningún caso.
--   gana   — authenticated: EXECUTE de cita_tiene_nota_ligada, sólo sobre
--            su clínica (lo que ya le dice la API). service_role: nada que
--            no pudiera leer. anon: nada.
-- Contrato con spinus-consola: ninguna columna cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TRIGGER IF EXISTS trg_appointments_proteger_atendida ON public.appointments;
--   DROP FUNCTION IF EXISTS public.cita_proteger_atendida();
--   DROP FUNCTION IF EXISTS public.cita_tiene_nota_ligada(uuid, uuid);
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
  -- La función DEFINER tiene que ver TODAS las notas: su dueño (quien aplica) se salta la RLS.
  IF NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no tiene BYPASSRLS; la función vería sólo parte de las notas.', current_user;
  END IF;
  -- Los cuerpos no se validan al crearse: las columnas que nombran, aquí.
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype), ('status', 'text'::regtype),
                                    ('start_time', 'timestamptz'::regtype), ('end_time', 'timestamptz'::regtype),
                                    ('all_day', 'bool'::regtype))) <> 6 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments sin id, clinica_id, status, start_time, end_time o all_day con su tipo.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.consultas'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('appointment_id', 'uuid'::regtype), ('paciente_id', 'uuid'::regtype))) <> 2
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.pacientes'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype))) <> 2
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('clinica_id', 'uuid'::regtype), ('agenda_v2_encendida', 'bool'::regtype))) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta consultas.appointment_id/paciente_id, pacientes.id/clinica_id o agenda_ajustes.clinica_id/agenda_v2_encendida.';
  END IF;
  IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'appointments_status_check'
                            AND conrelid = 'public.appointments'::regclass)) !~ '''attended''' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el CHECK de appointments.status no tiene ''attended''.';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('public.get_clinica_id()') IS NULL
     OR (SELECT prorettype FROM pg_proc WHERE oid = to_regprocedure('public.get_clinica_id()')) <> 'uuid'::regtype THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta auth.uid() o public.get_clinica_id() → uuid.';
  END IF;
  -- Sin estos permisos el disparador fallaría al mover cualquier atendida, no sólo las prohibidas.
  IF NOT (has_table_privilege('authenticated', 'public.agenda_ajustes', 'SELECT')
          AND has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: authenticated o service_role sin SELECT en agenda_ajustes.';
  END IF;
  -- Re-ejecución: si ya existen con otra forma de seguridad, no se reemplazan en silencio.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_atendida()') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_proteger_atendida() existe como SECURITY DEFINER; tiene que ser invoker.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.cita_tiene_nota_ligada(uuid, uuid)')
              AND (NOT prosecdef OR prorettype <> 'bool'::regtype)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_tiene_nota_ligada(uuid, uuid) existe con otra forma (invoker u otro tipo).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La comprobación (sólo un booleano) y el disparador.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_tiene_nota_ligada(p_cita uuid, p_clinica uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT coalesce(
           (auth.uid() IS NULL OR p_clinica = public.get_clinica_id())
           AND EXISTS (SELECT 1 FROM public.consultas c
                         JOIN public.pacientes p ON p.id = c.paciente_id
                        WHERE c.appointment_id = p_cita AND p.clinica_id = p_clinica),
           false)
$fn$;

REVOKE EXECUTE ON FUNCTION public.cita_tiene_nota_ligada(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cita_tiene_nota_ligada(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.cita_tiene_nota_ligada(uuid, uuid) IS
  'Agenda (tanda H, punto 22): ¿tiene la cita p_cita una nota clínica (consultas.appointment_id) de un paciente de p_clinica? SECURITY DEFINER porque la RLS de consultas oculta las notas a la secretaria y a otros médicos; devuelve SÓLO un booleano. Con sesión, sólo responde de la clínica de quien llama (otra → false). La usa cita_proteger_atendida(); sin EXECUTE para anon ni PUBLIC.';

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
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    -- Sin cambio de estado: sólo cuenta si se mueve, y mover sólo se cierra con la v2 (vetoPorEstado).
    IF (NEW.start_time, NEW.end_time, NEW.all_day) IS NOT DISTINCT FROM (OLD.start_time, OLD.end_time, OLD.all_day)
       OR NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j
                       WHERE j.clinica_id = OLD.clinica_id AND j.agenda_v2_encendida IS TRUE) THEN
      RETURN NEW;
    END IF;
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

REVOKE EXECUTE ON FUNCTION public.cita_proteger_atendida() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_atendida() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.cita_proteger_atendida() IS
  'Agenda (tanda H, punto 22): una cita atendida con nota clínica ligada no cambia de estado ni se borra (siempre) y no se mueve de fecha, hora o todo el día (con agenda_v2_encendida), como vetoPorNotaLigada y vetoPorEstado de la API. 42501. Lee OLD/NEW, agenda_ajustes y cita_tiene_nota_ligada(); nunca appointments. postgres y supabase_admin quedan fuera (editor SQL, acciones referenciales); service_role, no.';

CREATE OR REPLACE TRIGGER trg_appointments_proteger_atendida
  BEFORE UPDATE OF status, start_time, end_time, all_day OR DELETE ON public.appointments
  FOR EACH ROW WHEN (OLD.status = 'attended')
  EXECUTE FUNCTION public.cita_proteger_atendida();

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'disparador BEFORE UPDATE OF … OR DELETE en appointments' AS comprobacion,
         coalesce((SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                    AND tgname = 'trg_appointments_proteger_atendida' AND tgenabled = 'O'), 'AUSENTE') AS valor,
         'CREATE TRIGGER trg_appointments_proteger_atendida BEFORE DELETE OR UPDATE OF status, start_time, end_time, all_day ON public.appointments FOR EACH ROW WHEN ((old.status = ''attended''::text)) EXECUTE FUNCTION cita_proteger_atendida()' AS esperado
  UNION ALL
  SELECT 2, 'disparador: INVOKER con search_path vacío',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_atendida()')), 'AUSENTE'),
         'true / true'
  UNION ALL
  SELECT 3, 'comprobación: DEFINER, search_path vacío, boolean, dueño con BYPASSRLS',
         coalesce((SELECT prosecdef::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text || ' / '
                          || prorettype::regtype::text || ' / ' || r.rolbypassrls::text
                    FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
                   WHERE p.oid = to_regprocedure('public.cita_tiene_nota_ligada(uuid, uuid)')), 'AUSENTE'),
         'true / true / boolean / true'
  UNION ALL
  SELECT 4, 'EXECUTE del disparador anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_proteger_atendida()')), 'AUSENTE'),
         'true,true,true / false'
  UNION ALL
  SELECT 5, 'EXECUTE de la comprobación anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_tiene_nota_ligada(uuid, uuid)')), 'AUSENTE'),
         'false,true,true / false'
  UNION ALL
  SELECT 6, 'ninguna de las dos nombra appointments (sin autorreferencia)',
         coalesce((SELECT bool_and(prosrc !~* 'appointments')::text || ' (' || count(*) || ')' FROM pg_proc
                    WHERE oid IN (to_regprocedure('public.cita_proteger_atendida()'), to_regprocedure('public.cita_tiene_nota_ligada(uuid, uuid)'))), 'AUSENTE'),
         'true (2)'
  UNION ALL
  SELECT 7, 'las 5 policies de appointments y las 4 de consultas, intactas (nombres)',
         (SELECT string_agg(tablename || '.' || policyname, ',' ORDER BY tablename, policyname) FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('appointments', 'consultas')),
         'appointments.appointments_delete,appointments.appointments_gates_insert,appointments.appointments_insert,appointments.appointments_select,appointments.appointments_update,consultas.consultas_gates_insert,consultas.consultas_insert,consultas.consultas_select,consultas.consultas_update'
  UNION ALL
  SELECT 8, 'los disparadores de seg2 siguen (borrado y reserva)',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass AND tgenabled = 'O'
            AND tgname IN ('trg_appointments_proteger_borrado', 'trg_appointments_proteger_reserva')),
         '2'
) t
ORDER BY t.n;
