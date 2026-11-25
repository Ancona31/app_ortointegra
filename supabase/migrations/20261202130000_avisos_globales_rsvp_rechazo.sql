-- ═══════════════════════════════════════════════════════════════════════
-- Avisos globales · M2 — el «No» del paciente a la invitación de Google
-- Rama: feature/avisos-globales · Escrita: 2026-11-24
-- Plan: docs/spec/avisos-globales/PLAN.md (§4)
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-25 (versión corregida tras las decisiones de Angel), stack local de Supabase (CLI 2.117.0) con las 14
--   migraciones anteriores y M1: aplicada, deshecha con su reversa y vuelta a
--   aplicar; prueba av2_rsvp_rechazo.sql en verde.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DE ENSAYO SOBRE EL CLON
--   DE ESTRUCTURA Y DE AUDITORÍA INDEPENDIENTE (supabase/AUDITORIA-MIGRACIONES.md).
--
-- QUÉ HACE: crea UNA función, public.cita_rsvp_google_rechazo. Nada más: ni
--   tablas, ni columnas, ni disparadores, ni policies. NO reemplaza
--   cita_rsvp_google (el «Sí»), que queda intacta.
--   Decisión de Angel (2026-11-24): cuando el paciente responde «No» a la
--   invitación de Google:
--     · con MÁS de 1 hora de anticipación, la cita se CANCELA, se avisa a la
--       clínica y se le manda un correo. La función cancela y devuelve lo que
--       el servidor necesita para el correo ('cancelada'); el aviso lo deja el
--       disparador de M1 (aviso_clinica_de_cambio_cita, spinus.via = 'google_rsvp');
--     · en la ÚLTIMA HORA, NO se cancela: deja el aviso «indicó que no
--       asistirá» (paciente_no_asistira, por aviso_clinica_registrar, una sola
--       vez por cita) y devuelve 'no_asistira'. El personal decide.
--   ⚠️ EL UMBRAL ES EL DEL ENLACE DE CONFIRMACIÓN, con su misma expresión:
--     start_time - interval '1 hour' <= ahora  (cita_confirmacion_responder, F4:
--     «Hasta 1 hora antes. A T-1h exacto ya no»). SQL no deja compartir el
--     literal sin reescribir aquella función; la prueba av2 (caso 8) falla si
--     las dos dejan de decir lo mismo. Si cambia una, cambia la otra (y
--     PLAZO_CANCELAR de src/lib/correo/plantillaCita.ts).
--   Condiciones, calcadas de cita_rsvp_google: v2 encendida; el evento y el
--   calendario son los de ESA cita y de la conexión activa de la clínica; la
--   cita tiene paciente o está por ligar, tiene hora y es FUTURA (hora real
--   tras el candado); está agendada o confirmada (una atendida, una cancelada
--   o una inasistencia no cambian); y un correo que rechazó es pacientes.email
--   o reserva_correo de ESA cita. Si algo no se cumple: 'sin_cambio', sin más.
--   Sólo la cancelación cuenta para el candado, audita y manda correo.
--   · Cuenta para el candado de reservas igual que la cancelación por enlace,
--     sin tocar nada: trg_appointments_reserva_incidencia (F3) registra la
--     incidencia en cualquier paso a cancelada de una cita reservada por enlace.
--   · Auditoría: log_cita_change con via = 'google_rsvp', que YA está en su
--     lista blanca (F1). No hace falta un literal nuevo.
--   · Idempotente: la transición ocurre una vez (FOR UPDATE); la pasada
--     siguiente ve la cita cancelada y devuelve 'sin_cambio' (ni otro correo ni
--     otro aviso). Si después el paciente dice «Sí», cita_rsvp_google no la
--     reabre: sólo confirma lo agendado.
-- Depende de: F2 (cita_rsvp_google, clinica_conexiones_google), F1
--   (log_cita_change con google_rsvp, agenda_v2_encendida) y M1 (el aviso).
-- Bloqueos: ninguno de tabla; sólo catálogo.
-- Ventana de despliegue: cualquiera de los dos órdenes es seguro. Sin el
--   código, nadie la llama; el código sin la función recibe PGRST202 y no hace
--   nada, como hoy. Sigue detrás de AGENDA_RSVP_GOOGLE=encendido.
-- Riesgo: BAJO en la migración. La función cancela citas: lo que pesa es su
--   prueba (av2_rsvp_rechazo.sql) y la prueba de Angel con Google real.
-- No re-ejecutable: una segunda pasada ABORTA en el pre-vuelo sin cambiar nada.
-- Vuelta atrás: supabase/reversas/20261202130000_avisos_globales_rsvp_rechazo_reversa.sql
-- Prueba: supabase/pruebas-sql/av2_rsvp_rechazo.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regprocedure('public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.cita_rsvp_google_rechazo ya existe: esta migración ya está aplicada. No se repite.';
  END IF;
  IF to_regprocedure('public.cita_rsvp_google(uuid, uuid, text, text, text[])') IS NULL
     OR to_regprocedure('public.agenda_v2_encendida(uuid)') IS NULL
     OR to_regclass('public.clinica_conexiones_google') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta cita_rsvp_google, agenda_v2_encendida o clinica_conexiones_google: aplica antes las migraciones de la agenda.';
  END IF;
  -- La auditoría tiene que reconocer la vía que marca esta función.
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.log_cita_change()')
                    AND position('''google_rsvp''' IN prosrc) > 0) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: log_cita_change() no tiene google_rsvp en su lista de vías.';
  END IF;
  -- Sin M1 la cita se cancelaría SIN avisar a la clínica.
  IF to_regprocedure('public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)') IS NULL
     OR to_regprocedure('public.aviso_clinica_de_cambio_cita()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.appointments'::regclass
                       AND tgname = 'trg_appointments_aviso_cambio' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta M1 (20261202120000_avisos_globales_modelo): sin ella el «No» cancelaría sin avisar a la clínica.';
  END IF;
END $$;

CREATE FUNCTION public.cita_rsvp_google_rechazo(p_clinica_id uuid, p_cita_id uuid, p_calendar_id text, p_google_event_id text, p_rechazaron text[])
 RETURNS TABLE(r_resultado text, r_para text, r_nombre text, r_inicio timestamp with time zone, r_fin timestamp with time zone,
               r_zona text, r_medico jsonb, r_consultorio jsonb, r_gcal_etag text)
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  v_a       record;
  v_correos text[];
  v_ahora   timestamptz;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_calendar_id IS NULL OR p_google_event_id IS NULL
     OR p_rechazaron IS NULL OR cardinality(p_rechazaron) > 50
     OR EXISTS (SELECT 1 FROM unnest(p_rechazaron) c WHERE c IS NULL OR length(c) > 254) THEN
    RAISE EXCEPTION 'cita_rsvp_google_rechazo: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  r_resultado := 'sin_cambio';
  SELECT coalesce(array_agg(DISTINCT lower(btrim(c))) FILTER (WHERE btrim(c) <> ''), ARRAY[]::text[])
    INTO v_correos FROM unnest(p_rechazaron) c;
  IF cardinality(v_correos) = 0
     OR NOT public.agenda_v2_encendida(p_clinica_id)
     OR NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                     WHERE g.clinica_id = p_clinica_id AND g.rol = 'clinica' AND g.estado = 'activa'
                       AND g.calendar_id = p_calendar_id) THEN
    RETURN NEXT; RETURN;
  END IF;
  SELECT a.id, a.updated_at, a.end_time, a.medico_id, a.gcal_etag, a.consultorio_timezone,
         a.consultorio_nombre, a.consultorio_direccion, a.consultorio_telefono,
         -- A quién se le escribe: al correo que rechazó. A un paciente dado de baja, a nadie.
         CASE WHEN p.id IS NOT NULL AND p.activo IS FALSE THEN NULL
              WHEN lower(btrim(p.email)) = ANY (v_correos) THEN btrim(p.email)
              ELSE btrim(a.reserva_correo) END AS para,
         coalesce(nullif(btrim(p.nombre), ''), nullif(btrim(a.reserva_nombre), '')) AS nombre
    INTO v_a
    FROM public.appointments a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = p_clinica_id
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
     AND a.google_event_id = p_google_event_id
     AND (a.gcal_calendar_id IS NULL OR a.gcal_calendar_id = p_calendar_id)
     AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
     AND (a.paciente_id IS NOT NULL OR a.reserva_canal IS NOT NULL)
     AND (lower(btrim(p.email)) = ANY (v_correos) OR lower(btrim(a.reserva_correo)) = ANY (v_correos))
   FOR UPDATE OF a;
  IF NOT FOUND THEN
    RETURN NEXT; RETURN;
  END IF;
  -- Hora REAL tras el candado: la cita tiene que seguir siendo futura.
  v_ahora := clock_timestamp();
  SELECT a.start_time INTO r_inicio FROM public.appointments a WHERE a.id = v_a.id AND a.start_time > v_ahora;
  IF NOT FOUND THEN
    RETURN NEXT; RETURN;
  END IF;
  r_nombre := v_a.nombre;
  -- Hasta 1 hora antes. A T-1h exacto ya no: la MISMA expresión que cita_confirmacion_responder.
  IF r_inicio - interval '1 hour' <= v_ahora THEN
    -- Última hora: no se cancela. Aviso «indicó que no asistirá», una vez por cita; decide el personal.
    IF public.aviso_clinica_registrar(p_clinica_id, 'paciente_no_asistira', v_a.id, NULL, NULL, NULL) THEN
      r_resultado := 'no_asistira';
    END IF;
    RETURN NEXT; RETURN;
  END IF;
  PERFORM set_config('spinus.via', 'google_rsvp', true);
  UPDATE public.appointments
     SET status = 'cancelled', updated_at = greatest(coalesce(v_a.updated_at, v_ahora), v_ahora)
   WHERE id = v_a.id AND clinica_id = p_clinica_id AND status IN ('scheduled', 'confirmed');
  r_resultado := 'cancelada';
  r_para := v_a.para;
  r_fin := v_a.end_time;
  r_zona := v_a.consultorio_timezone;
  r_gcal_etag := v_a.gcal_etag;
  r_medico := (SELECT jsonb_build_object('titulo', pr.titulo, 'nombres', pr.nombres, 'apellido_paterno', pr.apellido_paterno,
                                         'apellido_materno', pr.apellido_materno)
                 FROM public.profiles pr WHERE pr.id = v_a.medico_id AND pr.clinica_id = p_clinica_id);
  r_consultorio := jsonb_build_object('nombre', v_a.consultorio_nombre, 'direccion', v_a.consultorio_direccion,
                                      'telefono', v_a.consultorio_telefono);
  RETURN NEXT;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[]) TO service_role;
COMMENT ON FUNCTION public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[]) IS
  'Avisos globales: RSVP «declined» de Google. Con más de 1 hora de anticipación (el umbral del enlace de confirmación) cancela la cita (scheduled o confirmed → cancelled); en la última hora NO cancela: deja el aviso paciente_no_asistira (una vez por cita) y devuelve no_asistira. En los dos casos, sólo si la cita es futura, con hora, con paciente o por ligar, ligada a ese evento y calendario de la conexión activa de la clínica, y sólo si un correo que rechazó es pacientes.email o reserva_correo de ESA cita. Audita via google_rsvp; el aviso cancelacion_paciente lo deja aviso_clinica_de_cambio_cita; la incidencia del candado, trg_appointments_reserva_incidencia. Devuelve cancelada con lo que el servidor necesita para el correo al paciente (nada clínico), no_asistira, o sin_cambio. No reabre nada: el «Sí» posterior no cambia una cancelada. Sólo service_role; el código la llama sólo con AGENDA_RSVP_GOOGLE=encendido.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p
                  WHERE p.oid = to_regprocedure('public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])')
                    AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'])
     OR has_function_privilege('anon', 'public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: cita_rsvp_google_rechazo no quedó INVOKER, con search_path vacío y sólo para service_role.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'cita_rsvp_google_rechazo: INVOKER y search_path vacío' AS comprobacion,
         (SELECT (NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'])::text FROM pg_proc p
           WHERE p.oid = to_regprocedure('public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])')) AS valor,
         'true' AS esperado
  UNION ALL
  SELECT 2, 'quién la ejecuta (anon/authenticated/service_role)',
         (SELECT string_agg(has_function_privilege(r, 'public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])', 'EXECUTE')::text, '/')
            FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) WITH ORDINALITY AS x(r, o)),
         'false/false/true'
  UNION ALL
  SELECT 3, 'cita_rsvp_google (el «Sí») sigue', (to_regprocedure('public.cita_rsvp_google(uuid, uuid, text, text, text[])') IS NOT NULL)::text, 'true'
) t
ORDER BY t.n;
