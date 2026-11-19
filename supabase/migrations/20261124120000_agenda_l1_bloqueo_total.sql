-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda L, agente L1 (punto 6 de Angel) — el BLOQUEO DE HORARIO
-- pasa a ser TOTAL: en un periodo bloqueado no se agenda ni se mueve nada,
-- también por PostgREST directo o con el cliente de servicio.
-- Rama: feature/agenda-v2-l1 · Escrita: 2026-11-18
-- Riesgo estimado: MEDIO (un disparador BEFORE nuevo sobre appointments, la
-- tabla de las citas. Ninguna policy, columna, función ni fila existente
-- cambia; no se crea ninguna policy).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de la cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR, después de
--   20261123120000_agenda_k1_bloqueos (la tabla agenda_bloqueos).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Angel (tanda L, punto 6): «El bloqueo pasa a ser TOTAL. En un periodo
-- bloqueado no se puede agendar ni mover nada: ni citas con paciente ni
-- eventos sin paciente, tampoco desde Spinus ni con "Reagendar". Desaparece
-- la pregunta "¿Agendar de todos modos?". […] Validado en el servidor, no
-- solo en pantalla. […] Lo que entra de Google entra como hoy, porque no se
-- puede rechazar.» Las rutas (POST/PUT /api/appointments, POST …/reagendar)
-- lo comprueban antes de escribir y responden 409 `horario_bloqueado`; esto
-- es la barrera de la BASE: cierra PostgREST directo con la sesión y lo que
-- escribe el servidor con service_role (`cita_reagendar_clinica`).
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- public.cita_proteger_bloqueo() (NUEVA, función de disparador, INVOKER,
--   search_path = ''): rechaza con 42501 y HINT 'agenda_horario_bloqueado'
--   el ALTA de una fila de appointments, o el cambio de su inicio, fin o
--   médico, cuando el tramo nuevo [start_time, end_time) se solapa
--   (inicio < fin AND fin > inicio, el de K1) con un bloqueo del MISMO
--   médico de la misma clínica, y la agenda v2 está encendida en ella.
--   Mensaje: «Este horario está bloqueado. Quita el bloqueo para agendar
--   aquí.» (el literal de Angel; la API lo traduce a 409 con ese texto).
--   Vale para citas y para eventos sin paciente, de horas o de todo el día
--   (sus puntas son instantes reales: medianoches del consultorio).
--   Deja pasar, sin leer nada:
--     · un UPDATE que no cambia inicio, fin ni médico (K punto 5: la cita
--       que ya estaba dentro «se queda como está»: se cancela, se confirma,
--       se liga, se marca, se le cambian notas, consultorio, tipo…);
--     · una fila sin médico (ningún bloqueo es suyo);
--     · postgres y supabase_admin (editor SQL, semilla, acciones
--       referenciales; el patrón de cita_proteger_atendida y _borrado);
--     · service_role con spinus.via = 'google' (gcal_importar_evento,
--       gcal_aplicar_evento: lo de Google entra como hoy, C2/D4);
--     · el ALTA de service_role con reserva_canal (reservar_por_enlace, y
--       por ella reagendar_por_enlace): ya rechaza los bloqueos con su propio
--       EXISTS tras el candado 1790, y lo que se compruebe después de su
--       contador de intentos no puede lanzar (regla de CLAUDE.md, J2).
--   Lee agenda_bloqueos y agenda_ajustes como quien escribe: la RLS de
--   SELECT de agenda_bloqueos es el MISMO predicado que appointments_insert
--   y _update (médico dueño, administrador o secretaria, de su clínica), así
--   que quien puede escribir la cita de un médico ve los bloqueos de ese
--   médico; service_role los ve todos. NO es SECURITY DEFINER (perdería
--   current_user, y las excepciones de arriba dependen de él).
-- trg_appointments_horario_bloqueado (NUEVO): BEFORE INSERT OR UPDATE OF
--   start_time, end_time, medico_id ON public.appointments FOR EACH ROW.
--
-- ═══ CHOQUES CON LO QUE YA EXISTE (comprobados) ═══════════════════════
-- Quién escribe start_time, end_time o medico_id de appointments:
--   · POST /api/appointments y PUT /api/appointments/[id] (sesión): vetan
--     antes con 409; esto sólo salta en una carrera (bloqueo creado entre el
--     veto y la escritura) y la ruta lo traduce igual.
--   · cita_reagendar_clinica (service_role, sin via): queda cubierta; la ruta
--     …/reagendar veta antes y traduce el 42501 de esta función.
--   · reservar_por_enlace / reagendar_por_enlace: exentas (arriba).
--   · gcal_importar_evento / gcal_aplicar_evento: exentas (via google).
--   · cita_confirmacion_responder, cita_rsvp_google, reagendar_por_enlace
--     (su UPDATE): sólo estado o contadores; el disparador no se dispara o
--     sale en la primera comparación.
--   · Ninguna escritura del navegador va directa a appointments (src/:
--     todas las del cliente pasan por las rutas).
-- Disparadores BEFORE de appointments: se ejecutan por nombre; éste lee
--   sólo NEW/OLD y las dos tablas, no cambia NEW. cita_proteger_reserva
--   (que fuerza reserva_* a NULL para la sesión) puede ir antes o después:
--   la excepción de la reserva exige además current_user = service_role.
-- Carrera bloqueo-contra-cita: sin candado. Si un bloqueo y una cita del
--   mismo médico entran a la vez, la cita puede quedar dentro del bloqueo;
--   es el estado que K punto 5 ya admite («se queda como está»). No se toma
--   el candado 1790 para no serializar cada escritura de citas del médico.
-- log_cita_change: AFTER; lo rechazado no deja auditoría.
-- Con la v2 APAGADA (o sin fila en agenda_ajustes) no se rechaza nada: los
--   bloqueos no se pintan y no deben impedir lo que no se ve.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere 20261123120000 (agenda_bloqueos con su RLS de SELECT) y B1
--   (agenda_ajustes). PG ≥ 14.
-- Bloqueos (lock_timeout 5 s): CREATE TRIGGER toma SHARE ROW EXCLUSIVE sobre
--   appointments un instante (bloquea escrituras de citas, no lecturas).
-- Orden respecto al código: cualquiera. El código nuevo veta en las rutas
--   (y sin la tabla responde como si no hubiera bloqueos); esta migración
--   sola deja la base rechazando y la API vieja devolvería 500 en ese caso
--   (sólo dentro de un bloqueo, que la pantalla vieja ya pregunta).
-- Alcance de los roles:
--   pierde — authenticated y service_role: crear o mover a un periodo
--            bloqueado una fila de appointments con la v2 encendida.
--   gana   — nadie.
-- Contrato con spinus-consola: ninguna columna ni vista cambia; la consola
--   no escribe en appointments.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TRIGGER IF EXISTS trg_appointments_horario_bloqueado ON public.appointments;
--   DROP FUNCTION IF EXISTS public.cita_proteger_bloqueo();
--
-- ═══ AUDITORÍA ═════════════════════════════════════════════════════════
-- Independiente (sonnet, 2026-11-18, sólo lectura contra la base local):
-- APTA CON OBSERVACIONES, sin bloqueantes. Comprobó que las 7 funciones que
-- escriben appointments son INVOKER (ninguna llega como postgres), que la
-- exención de Google exige service_role (una sesión con spinus.via = 'google'
-- no pasa: caso 5 de la prueba), la paridad de predicados entre
-- appointments_insert/_update y agenda_bloqueos_select, y que ningún BEFORE de
-- appointments reescribe start_time/end_time/medico_id/reserva_canal. Sus dos
-- «importantes»: (1) traducir el 42501 en las rutas — hecho en el mismo
-- commit que el código (POST/PUT /api/appointments y …/reagendar, por el
-- HINT); (2) asignar a un médico un evento de Google con medico_id NULL que
-- ya esté dentro de un bloqueo se rechazaría — en la práctica no existe: las
-- filas de Google nacen con médico (gcal_importar_evento lo exige; 0 de 6 en
-- local con NULL). Menores, asumidos: la carrera sin candado (arriba) y que
-- gcal_* no limpian spinus.via (una RPC = una transacción).
--
-- ═══ APLICACIÓN LOCAL ══════════════════════════════════════════════════
-- 2026-11-18, contenedor local (nunca producción): ensayo en BEGIN…ROLLBACK
-- (md5 d084da26524c8edd79243c3d258c156f), luego aplicada DOS veces seguidas
-- con el veredicto en OK las dos (idempotente) y anotada en
-- supabase_migrations.schema_migrations. Prueba: supabase/pruebas-sql/
-- l1_bloqueo_total.sql en verde; vista en rojo con 8 mutaciones del cuerpo
-- (notas_l1.md).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  c_md5 CONSTANT text := 'd084da26524c8edd79243c3d258c156f';  -- esta migración (re-ejecución)
  v_md5 text;
BEGIN
  IF to_regclass('public.agenda_bloqueos') IS NULL OR to_regclass('public.agenda_ajustes') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan agenda_bloqueos (20261123120000) o agenda_ajustes (B1).';
  END IF;
  -- La RLS de SELECT de agenda_bloqueos es la que hace que la sesión vea los bloqueos
  -- de los médicos para los que agenda (el disparador lee como quien escribe).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agenda_bloqueos'
                  AND policyname = 'agenda_bloqueos_select' AND cmd = 'SELECT') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta la policy agenda_bloqueos_select (20261123120000).';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.agenda_bloqueos', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.agenda_bloqueos', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.agenda_ajustes', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: authenticated o service_role no leen agenda_bloqueos o agenda_ajustes.';
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_bloqueo()');
  IF v_md5 IS NOT NULL AND v_md5 <> c_md5 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.cita_proteger_bloqueo() ya existe con otro cuerpo (md5 %).', v_md5;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
              AND tgname = 'trg_appointments_horario_bloqueado'
              AND tgfoid <> coalesce(to_regprocedure('public.cita_proteger_bloqueo()'), 0)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: trg_appointments_horario_bloqueado ya existe con otra función.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La función del disparador.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_proteger_bloqueo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.medico_id IS NULL OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  -- K punto 5: lo que ya estaba dentro se queda; sólo cuenta entrar (alta, o mover inicio, fin o médico).
  IF TG_OP = 'UPDATE' AND (NEW.start_time, NEW.end_time, NEW.medico_id)
                          IS NOT DISTINCT FROM (OLD.start_time, OLD.end_time, OLD.medico_id) THEN
    RETURN NEW;
  END IF;
  -- Lo de Google entra como hoy (C2/D4), y la reserva por enlace ya rechaza los bloqueos ella misma.
  IF current_user = 'service_role'
     AND (current_setting('spinus.via', true) = 'google'
          OR (TG_OP = 'INSERT' AND NEW.reserva_canal IS NOT NULL)) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.agenda_bloqueos b
              WHERE b.clinica_id = NEW.clinica_id AND b.medico_id = NEW.medico_id
                AND b.inicio < NEW.end_time AND b.fin > NEW.start_time)
     AND EXISTS (SELECT 1 FROM public.agenda_ajustes j
                  WHERE j.clinica_id = NEW.clinica_id AND j.agenda_v2_encendida) THEN
    RAISE EXCEPTION 'Este horario está bloqueado. Quita el bloqueo para agendar aquí.'
      USING ERRCODE = '42501', HINT = 'agenda_horario_bloqueado';
  END IF;
  RETURN NEW;
END
$fn$;

-- Permisos de funciones (CLAUDE.md): la ejecuta el disparador como quien escribe.
REVOKE EXECUTE ON FUNCTION public.cita_proteger_bloqueo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_bloqueo() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.cita_proteger_bloqueo() IS
  'Agenda (tanda L, punto 6): con la v2 encendida, ninguna fila de appointments entra ni se mueve (inicio, fin o médico) a un periodo que se solape con un bloqueo de su médico (agenda_bloqueos). 42501, HINT agenda_horario_bloqueado, mensaje literal de Angel. Fuera: postgres/supabase_admin, service_role con spinus.via = google (lo de Google entra como hoy) y el alta de service_role con reserva_canal (reservar_por_enlace ya lo rechaza). Lo que ya estaba dentro se queda (K punto 5). INVOKER: lee agenda_bloqueos con la RLS de quien escribe.';

DROP TRIGGER IF EXISTS trg_appointments_horario_bloqueado ON public.appointments;
CREATE TRIGGER trg_appointments_horario_bloqueado
  BEFORE INSERT OR UPDATE OF start_time, end_time, medico_id ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.cita_proteger_bloqueo();

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'cita_proteger_bloqueo: cuerpo de esta migración (md5)' AS comprobacion,
         coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_bloqueo()')), 'AUSENTE') AS valor,
         'd084da26524c8edd79243c3d258c156f' AS esperado
  UNION ALL
  SELECT 2, 'INVOKER, search_path vacío, devuelve trigger',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text || ' / ' || (prorettype = 'trigger'::regtype)::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_bloqueo()')), 'AUSENTE'),
         'true / true / true'
  UNION ALL
  SELECT 3, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_proteger_bloqueo()')), 'AUSENTE'),
         'true,true,true / false'
  UNION ALL
  SELECT 4, 'el disparador, activo',
         coalesce((SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                    AND tgname = 'trg_appointments_horario_bloqueado' AND tgenabled = 'O'), 'AUSENTE'),
         'CREATE TRIGGER trg_appointments_horario_bloqueado BEFORE INSERT OR UPDATE OF start_time, end_time, medico_id ON public.appointments FOR EACH ROW EXECUTE FUNCTION cita_proteger_bloqueo()'
  UNION ALL
  SELECT 5, 'las 5 policies de appointments, intactas (nombres)',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 6, 'las 4 policies de agenda_bloqueos, intactas (nombres)',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agenda_bloqueos'),
         'agenda_bloqueos_delete,agenda_bloqueos_insert,agenda_bloqueos_select,agenda_bloqueos_update'
) t
ORDER BY t.n;
