-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda I, punto 9 de Angel — candado sobre lo que el paciente
-- ELIGIÓ al reservar por enlace: médico, consultorio, día y hora
-- Rama: feature/agenda-v2-i2 · Escrita: 2026-11-17
-- Riesgo estimado: MEDIO (dos funciones nuevas y un disparador BEFORE UPDATE
-- OF … sobre appointments que sólo corre en citas por enlace, y con él un
-- camino nuevo de rechazo para la sincronización de Google; ninguna policy,
-- ningún permiso de tabla, ninguna restricción y ningún dato cambian).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA 2026-11-17 (base de Docker; ensayo con ROLLBACK, dos
--   pases con la rejilla en OK, registrada en schema_migrations).
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B1, D1, D3 y seg2;
--   con el conjunto de la agenda v2).
-- AUDITORÍA INDEPENDIENTE: 2026-11-17, subagente aparte (sonnet), sólo
--   lectura: APTA CON OBSERVACIONES, ninguna bloqueante. Atendidas: riesgo
--   subido a MEDIO; el convenio de abajo (empalmes y tope, en el servidor).
--   Anotadas: p_esperado NULL = sin comprobar (la ruta lo manda siempre que la
--   pantalla lo tiene); el rechazo de Google aborta ese RPC y la pasada lo
--   trata por evento (gcalSincronizacion.ts, `aplicarORechazar`); la rejilla
--   cuenta policies y disparadores por nombre; el pre-vuelo no exige seg2/H5.
-- CONVENIO: cita_reagendar_clinica NO mira empalmes (B7, sólo aviso) ni el
--   tope de duración de una cita: los comprueba
--   POST /api/appointments/[id]/reagendar antes de llamar, como el PUT. El
--   horario del consultorio no lo comprueba nadie en el servidor (tampoco el
--   PUT): es sólo un aviso de pantalla.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 9 de Angel (tanda I, 2026-11-17), literal: «En una cita reservada
-- por enlace: el MÉDICO no se puede cambiar. Si lo atenderá otro, se cancela
-- y reserva con el otro; el CONSULTORIO, el DÍA y la HORA solo se cambian con
-- "Reagendar", que pide confirmación explícita y le manda al paciente un
-- correo con los datos nuevos y su enlace para confirmar o cancelar. No se
-- pueden cambiar desde el formulario ni arrastrando; la DURACIÓN es libre: el
-- paciente llega a la misma hora. El candado sigue vigente después de ligar
-- la cita a un paciente, mientras la cita no haya pasado. Valídalo en el
-- servidor y en la base, no solo en pantalla.»
-- Hoy la RLS (appointments_update) deja a médico, administrador y
-- secretaria cambiar todo eso por PostgREST, y la API también.
--
-- ═══ QUÉ CREA ══════════════════════════════════════════════════════════
-- cita_proteger_eleccion() — función de disparador, INVOKER,
--   search_path = ''. Sólo lee OLD/NEW y la fila de agenda_ajustes de
--   OLD.clinica_id (con los permisos de quien escribe, como seg2 y H5);
--   NUNCA consulta appointments (sin autorreferencia). Si la cita es por
--   enlace (OLD.reserva_canal no nulo), no ha empezado (OLD.start_time >
--   now()) y la v2 está encendida → 42501 cuando:
--   · cambia medico_id — siempre (tampoco por «Reagendar»);
--   · cambia consultorio_id, start_time o all_day — salvo la vía de
--     «Reagendar» (abajo).
--   end_time SÍ cambia (la duración es libre: el inicio se queda).
--   Reescribir el MISMO valor pasa (IS DISTINCT FROM): el formulario manda
--   todos los campos y gcal_aplicar_evento reescribe los suyos.
-- trg_appointments_proteger_eleccion — BEFORE UPDATE OF medico_id,
--   consultorio_id, start_time, end_time, all_day, FOR EACH ROW, WHEN
--   (OLD.reserva_canal IS NOT NULL): sólo corre en citas por enlace y sólo si
--   la sentencia nombra esas columnas.
-- cita_reagendar_clinica(p_clinica_id, p_actor, p_cita_id, p_consultorio_id,
--   p_inicio, p_fin, p_esperado) → (r_resultado, r_updated_at). INVOKER, SÓLO
--   service_role. Es «Reagendar» de la clínica: la llama
--   POST /api/appointments/[id]/reagendar con createAdminClient(), la
--   clínica de la SESIÓN y el actor de la sesión, tras sus puertas (sesión,
--   interruptor, confirmación explícita), y después manda el correo al
--   paciente. Repite la regla de appointments_update con el actor (de esa
--   clínica; el médico de la cita, un médico administrador o la secretaria),
--   bloquea la cita (FOR UPDATE), exige cita por enlace, agendada o
--   confirmada, sin empezar, sin todo el día, hora nueva futura,
--   consultorio activo del MISMO médico y la versión que vio la pantalla
--   (p_esperado = updated_at; NULL = sin comprobar), y escribe consultorio
--   (con su instantánea: nombre, nombre corto, dirección, teléfono, zona),
--   inicio, fin y updated_at. La auditoría: la fila de log_cita_change
--   ('system', sin via: la lista blanca c_vias no se toca) y una propia
--   'cita_reagendada_clinica' a nombre del actor con los NOMBRES de los
--   campos que cambiaron (nunca valores).
--
-- ═══ LA VÍA DE «REAGENDAR», Y POR QUÉ ASÍ ════════════════════════════
-- El disparador deja cambiar consultorio/inicio sólo si current_user =
-- service_role Y el GUC transaccional spinus.reagendar_cita = id de ESA
-- cita. Lo pone sólo cita_reagendar_clinica, con set_config(…, true) justo
-- antes de su UPDATE, y lo vacía justo después (dura hasta el fin de la
-- TRANSACCIÓN, no de la función: la lección de E6). Una sesión no puede
-- ser service_role, así que no le basta con poner el GUC; y service_role
-- fuera de esta función (Google, la reserva, la confirmación) no lo pone.
-- Por qué no sirve la sesión: el correo al paciente y la confirmación son
-- del servidor; una RPC que la sesión pudiera llamar por PostgREST movería
-- la cita sin avisar a nadie.
--
-- ═══ QUIÉN QUEDA FUERA, Y POR QUÉ ═════════════════════════════════════
-- Aplica a authenticated y a service_role (como seg2 y H5). Caminos del
-- servidor comprobados (catálogo y src/):
--   · gcal_aplicar_evento (C2/D4): mueve citas por ligar y con paciente
--     desde Google. Con esto, un movimiento en Google de una cita por enlace
--     futura da 42501 → la pasada lo trata como cambio rechazado y vuelve a
--     escribir en Google lo de Spinus (C5), como C-e
--     (src/lib/gcalSincronizacion.ts, `ejecutar`). Reescribir sus mismas
--     puntas (vincular, etag) pasa.
--   · reservar_por_enlace / reagendar_por_enlace: INSERT y, en E6,
--     reserva_reagendados de la cita NUEVA; no nombran estas columnas.
--   · cita_confirmacion_responder, cita_rsvp_google, /api/consultas: sólo
--     status. WhatsApp manual: whatsapp_*. Ligar (D7): paciente_id y title;
--     el PUT manda inicio/fin/médico/consultorio iguales → pasa.
-- No aplica a postgres ni a supabase_admin (editor SQL, ayudantes de las
--   e2e, acciones referenciales), como B1/D1/seg2/H5.
-- Con la v2 APAGADA no aplica: apagada la app es la de antes y no tiene
--   «Reagendar»; cerrar el arrastre ahí quitaría una función sin
--   reemplazo (la tolerancia de CLAUDE.md, como el «mover» de H5).
-- Una cita que ya empezó (OLD.start_time <= now()) queda libre: el candado
--   protege la cita a la que el paciente va a llegar; corregir el registro
--   de una que ya pasó no le cambia nada.
--
-- ═══ CHOQUES CON LO QUE YA EXISTE (comprobados) ═══════════════════════
-- Orden de los BEFORE (alfabético): atendida < borrado < eleccion <
--   reserva. Ninguno cambia NEW. H5 (atendida) y éste pueden rechazar el
--   mismo movimiento con 42501: el resultado es el mismo.
-- log_cita_change (AFTER): lo rechazado no deja auditoría; lo de
--   cita_reagendar_clinica deja la suya ('system') y la propia del actor.
-- trg_appointments_reserva_incidencia (AFTER UPDATE OF status): otra columna.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B1 (agenda_ajustes), D1 (reserva_* en appointments) y seg2.
--   PG ≥ 14 (CREATE OR REPLACE TRIGGER).
-- Bloqueos (lock_timeout 5 s): CREATE TRIGGER toma SHARE ROW EXCLUSIVE
--   sobre appointments un instante (bloquea escrituras, no lecturas).
-- Orden respecto al código: la MIGRACIÓN PRIMERO. Sin ella, el código nuevo
--   veta en la API igual (409) y «Reagendar» contesta 503 (RPC ausente); con
--   ella y el código viejo, el formulario y el arrastre de una cita por
--   enlace futura reciben un 500 de la base (no se escribe nada).
-- Alcance de los roles:
--   pierde — authenticated y service_role: cambiar médico, consultorio,
--            día u hora de una cita por enlace futura con la v2 encendida
--            (salvo cita_reagendar_clinica). La API nueva ya no lo hacía.
--   gana   — service_role: cita_reagendar_clinica. anon y authenticated:
--            nada (sin EXECUTE).
-- Contrato con spinus-consola: ninguna columna cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TRIGGER IF EXISTS trg_appointments_proteger_eleccion ON public.appointments;
--   DROP FUNCTION IF EXISTS public.cita_proteger_eleccion();
--   DROP FUNCTION IF EXISTS public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz);
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
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no tiene BYPASSRLS (cita_reagendar_clinica es INVOKER).';
  END IF;
  -- Los cuerpos no se validan al crearse: las columnas que nombran, aquí.
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype), ('medico_id', 'uuid'::regtype),
                                    ('consultorio_id', 'uuid'::regtype), ('status', 'text'::regtype),
                                    ('start_time', 'timestamptz'::regtype), ('end_time', 'timestamptz'::regtype),
                                    ('all_day', 'bool'::regtype), ('reserva_canal', 'text'::regtype),
                                    ('updated_at', 'timestamptz'::regtype), ('consultorio_nombre', 'text'::regtype),
                                    ('consultorio_nombre_corto', 'text'::regtype), ('consultorio_direccion', 'text'::regtype),
                                    ('consultorio_telefono', 'text'::regtype), ('consultorio_timezone', 'text'::regtype))) <> 15 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments sin alguna de las 15 columnas que nombran las funciones (con su tipo).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.consultorios'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype), ('medico_id', 'uuid'::regtype),
                                    ('activo', 'bool'::regtype), ('nombre', 'text'::regtype), ('nombre_corto', 'text'::regtype),
                                    ('direccion', 'text'::regtype), ('telefono', 'text'::regtype), ('timezone', 'text'::regtype))) <> 9
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype), ('role', 'text'::regtype),
                                    ('es_admin_de_clinica', 'bool'::regtype))) <> 4
     OR (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('clinica_id', 'uuid'::regtype), ('agenda_v2_encendida', 'bool'::regtype))) <> 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan columnas de consultorios, profiles o agenda_ajustes que nombran las funciones.';
  END IF;
  -- La regla de quién puede (appointments_update) que cita_reagendar_clinica repite con el actor.
  IF (SELECT pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polrelid = 'public.appointments'::regclass AND polname = 'appointments_update')
     IS DISTINCT FROM '(((medico_id = auth.uid()) OR soy_admin_de_clinica() OR (get_my_role() = ''secretaria''::text)) AND (clinica_id = get_clinica_id()))' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments_update cambió; cita_reagendar_clinica repite su regla y habría que revisarla.';
  END IF;
  IF NOT (has_table_privilege('authenticated', 'public.agenda_ajustes', 'SELECT')
          AND has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: authenticated o service_role sin SELECT en agenda_ajustes (el disparador fallaría siempre).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid IN (to_regprocedure('public.cita_proteger_eleccion()'),
                                                  to_regprocedure('public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz)'))
              AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una de las dos funciones existe como SECURITY DEFINER; tienen que ser invoker.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass AND tgname = 'trg_appointments_proteger_eleccion'
              AND tgfoid <> coalesce(to_regprocedure('public.cita_proteger_eleccion()'), 0)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: trg_appointments_proteger_eleccion existe con otra función.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · El disparador.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_proteger_eleccion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') OR OLD.reserva_canal IS NULL OR OLD.start_time <= now()
     OR (NEW.medico_id, NEW.consultorio_id, NEW.start_time, NEW.all_day)
        IS NOT DISTINCT FROM (OLD.medico_id, OLD.consultorio_id, OLD.start_time, OLD.all_day)
     OR NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j
                     WHERE j.clinica_id = OLD.clinica_id AND j.agenda_v2_encendida IS TRUE) THEN
    RETURN NEW;  -- la duración (end_time) es libre
  END IF;
  IF NEW.medico_id IS DISTINCT FROM OLD.medico_id THEN
    RAISE EXCEPTION 'El médico de una cita reservada por enlace no se cambia'
      USING ERRCODE = '42501', HINT = 'Si la atenderá otro médico, cancélala y reserva con él';
  END IF;
  -- coalesce: una GUC que la sesión nunca puso vale NULL, y NOT (true AND NULL)
  -- es NULL, que el IF toma como falso: sin él, service_role pasaría sin ella.
  IF NOT (current_user = 'service_role' AND coalesce(current_setting('spinus.reagendar_cita', true), '') = OLD.id::text) THEN
    RAISE EXCEPTION 'El consultorio, el día y la hora de una cita reservada por enlace sólo cambian con «Reagendar»'
      USING ERRCODE = '42501', HINT = 'Reagendar avisa al paciente con los datos nuevos';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.cita_proteger_eleccion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_eleccion() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.cita_proteger_eleccion() IS
  'Agenda (tanda I, punto 9): en una cita reservada por enlace (reserva_canal) que no ha empezado y con agenda_v2_encendida, el médico no cambia nunca y el consultorio, el inicio y todo el día sólo cambian por cita_reagendar_clinica (service_role + GUC spinus.reagendar_cita = id de la cita); el fin (la duración) es libre. 42501. Vale también después de ligar la cita a un paciente. Lee OLD/NEW y agenda_ajustes; nunca appointments. postgres y supabase_admin quedan fuera; service_role, no (Google rechaza y restablece, C5).';

CREATE OR REPLACE TRIGGER trg_appointments_proteger_eleccion
  BEFORE UPDATE OF medico_id, consultorio_id, start_time, end_time, all_day ON public.appointments
  FOR EACH ROW WHEN (OLD.reserva_canal IS NOT NULL)
  EXECUTE FUNCTION public.cita_proteger_eleccion();

-- ---------------------------------------------------------------------
-- 3 · «Reagendar» de la clínica.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_reagendar_clinica(
  p_clinica_id uuid, p_actor uuid, p_cita_id uuid, p_consultorio_id uuid,
  p_inicio timestamptz, p_fin timestamptz, p_esperado timestamptz)
RETURNS TABLE (r_resultado text, r_updated_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_rol   record;
  v_a     record;
  v_con   record;
  v_campos text[];
BEGIN
  IF p_clinica_id IS NULL OR p_actor IS NULL OR p_cita_id IS NULL OR p_consultorio_id IS NULL
     OR p_inicio IS NULL OR p_fin IS NULL OR p_fin <= p_inicio THEN
    RAISE EXCEPTION 'cita_reagendar_clinica: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida IS TRUE) THEN
    r_resultado := 'apagado'; RETURN NEXT; RETURN;
  END IF;
  SELECT p.role, p.es_admin_de_clinica INTO v_rol FROM public.profiles p
   WHERE p.id = p_actor AND p.clinica_id = p_clinica_id;
  IF NOT FOUND THEN
    r_resultado := 'sin_permiso'; RETURN NEXT; RETURN;
  END IF;
  SELECT a.id, a.medico_id, a.consultorio_id, a.start_time, a.end_time, a.status, a.all_day, a.reserva_canal, a.updated_at
    INTO v_a FROM public.appointments a
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR v_a.reserva_canal IS NULL THEN
    r_resultado := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  -- La regla de appointments_update, con el actor en vez de auth.uid().
  IF NOT (v_a.medico_id = p_actor OR (v_rol.role = 'medico' AND v_rol.es_admin_de_clinica IS TRUE) OR v_rol.role = 'secretaria') THEN
    r_resultado := 'sin_permiso'; RETURN NEXT; RETURN;
  END IF;
  IF v_a.status NOT IN ('scheduled', 'confirmed') OR v_a.all_day THEN
    r_resultado := 'estado_no_admite'; RETURN NEXT; RETURN;
  END IF;
  IF v_a.start_time <= now() THEN
    r_resultado := 'pasada'; RETURN NEXT; RETURN;
  END IF;
  IF p_esperado IS NOT NULL AND v_a.updated_at IS DISTINCT FROM p_esperado THEN
    r_resultado := 'modificada'; RETURN NEXT; RETURN;
  END IF;
  IF p_inicio <= now() THEN
    r_resultado := 'hora_pasada'; RETURN NEXT; RETURN;
  END IF;
  SELECT c.id, c.nombre, c.nombre_corto, c.direccion, c.telefono, c.timezone INTO v_con
    FROM public.consultorios c
   WHERE c.id = p_consultorio_id AND c.clinica_id = p_clinica_id AND c.medico_id = v_a.medico_id AND c.activo;
  IF NOT FOUND THEN
    r_resultado := 'consultorio_invalido'; RETURN NEXT; RETURN;
  END IF;
  v_campos := array_remove(ARRAY[
    CASE WHEN p_consultorio_id IS DISTINCT FROM v_a.consultorio_id THEN 'consultorio_id' END,
    CASE WHEN p_inicio IS DISTINCT FROM v_a.start_time THEN 'start_time' END,
    CASE WHEN p_fin IS DISTINCT FROM v_a.end_time THEN 'end_time' END], NULL);
  IF cardinality(v_campos) = 0 THEN
    r_resultado := 'sin_cambio'; r_updated_at := v_a.updated_at; RETURN NEXT; RETURN;
  END IF;

  -- La vía que el disparador reconoce: sólo para ESTA cita y sólo este UPDATE.
  PERFORM set_config('spinus.reagendar_cita', p_cita_id::text, true);
  UPDATE public.appointments
     SET consultorio_id = v_con.id, consultorio_nombre = v_con.nombre, consultorio_nombre_corto = v_con.nombre_corto,
         consultorio_direccion = v_con.direccion, consultorio_telefono = v_con.telefono, consultorio_timezone = v_con.timezone,
         start_time = p_inicio, end_time = p_fin, updated_at = now()
   WHERE id = p_cita_id AND clinica_id = p_clinica_id
  RETURNING updated_at INTO r_updated_at;
  -- set_config(…, true) dura hasta el fin de la TRANSACCIÓN (E6): se vacía ya.
  PERFORM set_config('spinus.reagendar_cita', '', true);

  -- Además de cita_editada ('system') de log_cita_change: quién reagendó y qué campos. Nunca valores.
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  VALUES (p_actor::text, 'cita_reagendada_clinica', 'appointments', p_cita_id,
          jsonb_build_object('clinica_id', p_clinica_id, 'campos', to_jsonb(v_campos))::text);

  r_resultado := 'ok'; RETURN NEXT;
END
$fn$;

-- Cierre justificado (CLAUDE.md, «Permisos de funciones»): sólo service_role.
-- Es el paso del servidor que ADEMÁS manda el correo al paciente; con EXECUTE,
-- una sesión podría mover la cita por PostgREST sin avisar a nadie.
REVOKE EXECUTE ON FUNCTION public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz) IS
  'Agenda (tanda I, punto 9): «Reagendar» de la clínica para una cita reservada por enlace. Sólo service_role (POST /api/appointments/[id]/reagendar, que después avisa al paciente). Repite la regla de appointments_update con p_actor (de p_clinica_id: médico de la cita, médico administrador o secretaria). Cita por enlace, agendada o confirmada, sin empezar y sin todo el día; hora nueva futura; consultorio activo del MISMO médico (nunca cambia el médico); p_esperado = updated_at que vio la pantalla (NULL = sin comprobar). Escribe consultorio con su instantánea, inicio, fin y updated_at con el GUC spinus.reagendar_cita (lo reconoce cita_proteger_eleccion) y lo vacía. Audita cita_reagendada_clinica a nombre del actor con los nombres de los campos. Resultados: ok, sin_cambio, apagado, sin_permiso, no_aplica, estado_no_admite, pasada, modificada, hora_pasada, consultorio_invalido.';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'disparador BEFORE UPDATE OF … en appointments, sólo citas por enlace' AS comprobacion,
         coalesce((SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                    AND tgname = 'trg_appointments_proteger_eleccion' AND tgenabled = 'O'), 'AUSENTE') AS valor,
         'CREATE TRIGGER trg_appointments_proteger_eleccion BEFORE UPDATE OF medico_id, consultorio_id, start_time, end_time, all_day ON public.appointments FOR EACH ROW WHEN ((old.reserva_canal IS NOT NULL)) EXECUTE FUNCTION cita_proteger_eleccion()' AS esperado
  UNION ALL
  SELECT 2, 'las dos funciones: INVOKER con search_path vacío',
         (SELECT string_agg(p.proname || '=' || (NOT p.prosecdef)::text || '/' || (p.proconfig @> ARRAY['search_path=""'])::text, ' ; ' ORDER BY p.proname)
            FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.cita_proteger_eleccion()'),
                                           to_regprocedure('public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz)'))),
         'cita_proteger_eleccion=true/true ; cita_reagendar_clinica=true/true'
  UNION ALL
  SELECT 3, 'EXECUTE anon,authenticated,service_role,PUBLIC',
         (SELECT string_agg(p.proname || '=' || has_function_privilege('anon', p.oid, 'EXECUTE')::text || ','
                            || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                            || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ','
                            || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                                        WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text, ' ; ' ORDER BY p.proname)
            FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.cita_proteger_eleccion()'),
                                           to_regprocedure('public.cita_reagendar_clinica(uuid, uuid, uuid, uuid, timestamptz, timestamptz, timestamptz)'))),
         'cita_proteger_eleccion=true,true,true,false ; cita_reagendar_clinica=false,false,true,false'
  UNION ALL
  SELECT 4, 'el disparador no nombra appointments (sin autorreferencia)',
         coalesce((SELECT (prosrc !~* 'appointments')::text FROM pg_proc WHERE oid = to_regprocedure('public.cita_proteger_eleccion()')), 'AUSENTE'),
         'true'
  UNION ALL
  SELECT 5, 'las 5 policies de appointments, intactas (nombres)',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         'appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 6, 'los disparadores de seg2 y H5 siguen (borrado, reserva, atendida)',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass AND tgenabled = 'O'
            AND tgname IN ('trg_appointments_proteger_borrado', 'trg_appointments_proteger_reserva', 'trg_appointments_proteger_atendida')),
         '3'
) t
ORDER BY t.n;
