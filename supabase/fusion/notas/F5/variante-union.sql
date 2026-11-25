-- F5 · VARIANTE DE ENSAYO (NO es la migración): los BEFORE de F5 unidos.
-- Se aplica sólo a un clon de ref-originales para medir y comparar casos.
--   · B2 (horario_bloqueado) + B3-UPDATE (atendida) + B5 (cierre) + B6 (elección)
--     → UN disparador BEFORE INSERT OR UPDATE OF <la unión de sus columnas>,
--       trg_appointments_proteger_cambios: entre asignacion_google (B1, el único
--       que escribe en NEW, sigue primero) y proteger_reserva (B7, sigue último).
--       Pregunta en el MISMO orden en que hoy disparan (alfabético): bloqueo,
--       atendida, cierre, elección; cada rama con su condición y su WHEN.
--   · B3-DELETE (atendida) + B4 (borrado) → trg_appointments_proteger_borrado,
--     preguntando primero lo de la atendida (B3 < B4 por nombre).
-- Usa public.agenda_v2_encendida(uuid) (F1): créala antes si el clon no la tiene.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.cita_proteger_cambios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  -- 1 · bloqueo (era trg_appointments_horario_bloqueado).
  IF NEW.medico_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR (NEW.start_time, NEW.end_time, NEW.medico_id)
                              IS DISTINCT FROM (OLD.start_time, OLD.end_time, OLD.medico_id))
     -- IS NOT TRUE y no NOT: una GUC que nunca se puso vale NULL, y NOT NULL no exime nada.
     AND (current_user = 'service_role'
          AND (current_setting('spinus.via', true) = 'google'
               OR (TG_OP = 'INSERT' AND NEW.reserva_canal IS NOT NULL))) IS NOT TRUE
     AND EXISTS (SELECT 1 FROM public.agenda_bloqueos b
                  WHERE b.clinica_id = NEW.clinica_id AND b.medico_id = NEW.medico_id
                    AND b.inicio < NEW.end_time AND b.fin > NEW.start_time)
     AND public.agenda_v2_encendida(NEW.clinica_id) THEN
    RAISE EXCEPTION 'Este horario está bloqueado. Quita el bloqueo para agendar aquí.'
      USING ERRCODE = '42501', HINT = 'agenda_horario_bloqueado';
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- 3 · cierre, alta (era trg_appointments_proteger_cierre).
    IF NEW.cerrada_en IS NOT NULL OR NEW.sustituida_por IS NOT NULL THEN
      RAISE EXCEPTION 'Una cita no nace cerrada' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  -- 2 · atendida (era trg_appointments_proteger_atendida, WHEN old.status = 'attended').
  IF OLD.status = 'attended'
     AND (NEW.status, NEW.start_time, NEW.end_time, NEW.all_day)
         IS DISTINCT FROM (OLD.status, OLD.start_time, OLD.end_time, OLD.all_day)
     AND public.cita_tiene_nota_ligada(OLD.id, OLD.clinica_id) THEN
    RAISE EXCEPTION 'Una cita atendida con nota clínica no cambia de estado ni de fecha u hora'
      USING ERRCODE = '42501', HINT = 'La nota es expediente: la cita se queda como atendida';
  END IF;
  -- 3 · cierre, edición.
  IF OLD.cerrada_en IS NOT NULL THEN
    IF (NEW.status, NEW.cerrada_en, NEW.sustituida_por) IS DISTINCT FROM (OLD.status, OLD.cerrada_en, OLD.sustituida_por) THEN
      RAISE EXCEPTION 'Una cita cancelada que ya se cerró no se reabre'
        USING ERRCODE = '42501', HINT = 'Se sustituyó por otra cita o se quitó de la agenda; se conserva como cancelada';
    END IF;
  ELSIF (NEW.cerrada_en, NEW.sustituida_por) IS DISTINCT FROM (OLD.cerrada_en, OLD.sustituida_por) THEN
    IF current_user <> 'service_role' OR OLD.status IS DISTINCT FROM 'cancelled' OR NEW.status IS DISTINCT FROM 'cancelled'
       OR NEW.cerrada_en IS NULL
       OR (NEW.sustituida_por IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM public.appointments s
                            WHERE s.id = NEW.sustituida_por AND s.id <> NEW.id AND s.clinica_id = NEW.clinica_id
                              AND s.status IS DISTINCT FROM 'cancelled' AND s.cerrada_en IS NULL)) THEN
      RAISE EXCEPTION 'Sólo el servidor cierra una cita cancelada, sin sustituta o con una sustituta viva de la misma clínica'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  -- 4 · elección (era trg_appointments_proteger_eleccion, WHEN old.reserva_canal IS NOT NULL).
  IF OLD.reserva_canal IS NOT NULL AND OLD.start_time > now()
     AND (NEW.medico_id, NEW.consultorio_id, NEW.start_time, NEW.all_day)
         IS DISTINCT FROM (OLD.medico_id, OLD.consultorio_id, OLD.start_time, OLD.all_day)
     AND public.agenda_v2_encendida(OLD.clinica_id) THEN
    IF NEW.medico_id IS DISTINCT FROM OLD.medico_id THEN
      RAISE EXCEPTION 'El médico de una cita reservada por enlace no se cambia'
        USING ERRCODE = '42501', HINT = 'Si la atenderá otro médico, cancélala y reserva con él';
    END IF;
    IF NOT (current_user = 'service_role' AND coalesce(current_setting('spinus.reagendar_cita', true), '') = OLD.id::text) THEN
      RAISE EXCEPTION 'El consultorio, el día y la hora de una cita reservada por enlace sólo cambian con «Reagendar»'
        USING ERRCODE = '42501', HINT = 'Reagendar avisa al paciente con los datos nuevos';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.cita_proteger_cambios() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cita_proteger_cambios() TO anon, authenticated, service_role;

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
  -- Primero la atendida con nota (era trg_appointments_proteger_atendida, que va antes por nombre).
  IF OLD.status = 'attended' AND public.cita_tiene_nota_ligada(OLD.id, OLD.clinica_id) THEN
    RAISE EXCEPTION 'Una cita atendida con nota clínica no se borra'
      USING ERRCODE = '42501', HINT = 'La nota es expediente: la cita se queda como atendida';
  END IF;
  IF OLD.paciente_id IS NULL AND OLD.reserva_canal IS NULL THEN
    RETURN OLD;
  END IF;
  IF public.agenda_v2_encendida(OLD.clinica_id) THEN
    RAISE EXCEPTION 'Una cita con paciente o por ligar no se borra: se cancela'
      USING ERRCODE = '42501', HINT = 'Cancélala (status cancelled) en vez de borrarla';
  END IF;
  RETURN OLD;
END
$fn$;

DROP TRIGGER trg_appointments_horario_bloqueado ON public.appointments;
DROP TRIGGER trg_appointments_proteger_atendida ON public.appointments;
DROP TRIGGER trg_appointments_proteger_cierre ON public.appointments;
DROP TRIGGER trg_appointments_proteger_eleccion ON public.appointments;
CREATE TRIGGER trg_appointments_proteger_cambios
  BEFORE INSERT OR UPDATE OF start_time, end_time, medico_id, consultorio_id, status, all_day, cerrada_en, sustituida_por
  ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.cita_proteger_cambios();
COMMIT;
