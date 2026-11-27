-- ═══════════════════════════════════════════════════════════════════════════
-- REVERSA de R2 (20261208120000_recordatorio_piso_30_min.sql)
-- NO es una migración: vive fuera de supabase/migrations/. Se corre a mano y
-- SÓLO si Angel lo pide.
-- ═══════════════════════════════════════════════════════════════════════════
-- QUÉ HACE: devuelve cita_correo_tomar y cita_recordatorios_pendientes al cuerpo
--   de R1, byte a byte (los dos bloques de abajo están COPIADOS de
--   20261207120000_recordatorio_tras_comprobante.sql; sus huellas son las que
--   exige el pre-vuelo de R2 y las que comprueba el post-vuelo de aquí), y quita
--   el comentario de cita_correo_tomar (no lo tenía) y devuelve el de
--   cita_recordatorios_pendientes al de F4.
-- QUÉ VUELVE: el piso de 1 hora; con el recordatorio a 1 hora no sale ninguno.
-- QUÉ NO VUELVE: los recordatorios ya mandados.
-- ORDEN EN LA CADENA: antes que la de R1.
-- GUARDA DE DATOS: no tiene; no toca filas y nunca se niega por datos.
-- SEGUNDA PASADA: no hace nada distinto y sale bien (CREATE OR REPLACE).
-- Bloqueos: sólo catálogo.
-- Ensayo: stack local, 2026-11-27: ida, reversa, ida otra vez.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)') IS NULL OR to_regprocedure('public.cita_recordatorios_pendientes(integer)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no están las funciones de F4 (ya deshecha): esta reversa no tiene nada que devolver.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cita_correo_tomar(p_clinica_id uuid, p_cita_id uuid, p_tipo text, p_testigo uuid)
 RETURNS TABLE(r_envio_id uuid, r_para text, r_inicio timestamp with time zone, r_fin timestamp with time zone, r_zona text, r_estado text, r_medico jsonb, r_consultorio jsonb)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_a     record;
  v_horas integer;
  v_id    uuid;
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_testigo IS NULL
     OR p_tipo IS NULL OR p_tipo NOT IN ('comprobante', 'recordatorio', 'confirmacion') THEN
    RAISE EXCEPTION 'cita_correo_tomar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT j.recordatorio_horas INTO v_horas FROM public.agenda_ajustes j
   WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND OR NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN;
  END IF;
  -- Serializa las tomas de ESTA cita (dos tipos o dos ejecuciones a la vez).
  PERFORM pg_advisory_xact_lock(1792, hashtext(p_cita_id::text));
  SELECT a.id, a.start_time, a.end_time, a.status, a.medico_id, a.consultorio_timezone,
         a.consultorio_nombre, a.consultorio_direccion, a.consultorio_telefono,
         -- ⚠️ Destinatario: la MISMA expresión que cita_recordatorios_pendientes.
         CASE WHEN a.paciente_id IS NOT NULL
              THEN CASE WHEN p.activo IS NOT FALSE THEN coalesce(nullif(btrim(p.email), ''), nullif(btrim(a.reserva_correo), '')) END
              ELSE CASE WHEN a.reserva_canal IS NOT NULL THEN nullif(btrim(a.reserva_correo), '') END END AS para
    INTO v_a
    FROM public.appointments a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = p_clinica_id
   WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
     AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
     AND a.start_time > now() + CASE WHEN p_tipo = 'recordatorio' THEN interval '1 hour' ELSE interval '0' END
     AND (p_tipo <> 'recordatorio' OR a.start_time <= now() + make_interval(hours => v_horas));
  IF NOT FOUND OR v_a.para IS NULL THEN
    RETURN;
  END IF;
  IF p_tipo = 'recordatorio' AND EXISTS (
       SELECT 1 FROM public.cita_correos k
        WHERE k.appointment_id = p_cita_id AND k.clinica_id = p_clinica_id AND k.tipo = 'comprobante'
          AND k.inicio_cita = v_a.start_time
          AND (k.estado = 'enviado'
            OR (k.estado = 'enviando' AND k.tomado_en > now() - interval '10 minutes'))
          -- ⚠️ R1 · Sólo si ese comprobante salió YA DENTRO de la ventana del recordatorio de esta
          -- cita. La MISMA condición que cita_recordatorios_pendientes: van juntas.
          AND coalesce(k.enviado_en, k.tomado_en) >= v_a.start_time - make_interval(hours => v_horas)) THEN
    RETURN;
  END IF;
  INSERT INTO public.cita_correos AS k (clinica_id, appointment_id, tipo, inicio_cita, estado, intentos, testigo, tomado_en)
  VALUES (p_clinica_id, p_cita_id, p_tipo, v_a.start_time, 'enviando', 1, p_testigo, now())
  ON CONFLICT (appointment_id, tipo, inicio_cita) DO UPDATE
     SET estado = 'enviando', intentos = k.intentos + 1, testigo = p_testigo, tomado_en = now(),
         motivo = NULL, updated_at = now()
   WHERE k.clinica_id = p_clinica_id
     AND k.intentos < 3
     AND ((k.estado = 'fallido' AND k.motivo IS DISTINCT FROM 'duplicado')
       OR (k.estado = 'enviando' AND k.tomado_en <= now() - interval '10 minutes'))
  RETURNING k.id INTO v_id;
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT v_id, v_a.para, v_a.start_time, v_a.end_time, v_a.consultorio_timezone, v_a.status,
    (SELECT jsonb_build_object('titulo', pr.titulo, 'nombres', pr.nombres, 'apellido_paterno', pr.apellido_paterno,
                               'apellido_materno', pr.apellido_materno)
       FROM public.profiles pr WHERE pr.id = v_a.medico_id AND pr.clinica_id = p_clinica_id),
    jsonb_build_object('nombre', v_a.consultorio_nombre, 'direccion', v_a.consultorio_direccion,
                       'telefono', v_a.consultorio_telefono);
END
$function$;

CREATE OR REPLACE FUNCTION public.cita_recordatorios_pendientes(p_limite integer)
 RETURNS TABLE(r_clinica_id uuid, r_cita_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT x.clinica_id, x.id
    FROM public.agenda_ajustes j
   CROSS JOIN LATERAL (
     SELECT a.clinica_id, a.id, a.start_time
       FROM public.appointments a
       LEFT JOIN public.pacientes p ON p.id = a.paciente_id AND p.clinica_id = a.clinica_id
      WHERE a.clinica_id = j.clinica_id
        AND a.start_time >  now() + interval '1 hour'
        AND a.start_time <= now() + make_interval(hours => j.recordatorio_horas)
        AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
        -- ⚠️ Destinatario: la MISMA expresión que cita_correo_tomar.
        AND (CASE WHEN a.paciente_id IS NOT NULL
                  THEN CASE WHEN p.activo IS NOT FALSE THEN coalesce(nullif(btrim(p.email), ''), nullif(btrim(a.reserva_correo), '')) END
                  ELSE CASE WHEN a.reserva_canal IS NOT NULL THEN nullif(btrim(a.reserva_correo), '') END END) IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.cita_correos k
                         WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id AND k.inicio_cita = a.start_time
                           AND ((k.tipo = 'comprobante'
                                 AND (k.estado = 'enviado'
                                   OR (k.estado = 'enviando' AND k.tomado_en > now() - interval '10 minutes'))
                                 -- ⚠️ R1 · Sólo si ese comprobante salió YA DENTRO de la ventana del recordatorio
                                 -- de esta cita. La MISMA condición que cita_correo_tomar: van juntas.
                                 AND coalesce(k.enviado_en, k.tomado_en) >= a.start_time - make_interval(hours => j.recordatorio_horas))
                             OR (k.tipo = 'recordatorio'
                                 AND (k.estado IN ('enviado', 'omitido')
                                   OR (k.estado = 'fallido' AND (k.intentos >= 3 OR k.motivo = 'duplicado'))
                                   OR (k.estado = 'enviando' AND (k.tomado_en > now() - interval '10 minutes' OR k.intentos >= 3))))))
      ORDER BY a.start_time
      LIMIT least(greatest(coalesce(p_limite, 0), 0), 500)
   ) x
   WHERE j.agenda_v2_encendida
     AND public.gcal_sync_clinica_habilitada(j.clinica_id)
     AND j.recordatorio_encendido
   ORDER BY x.start_time
   LIMIT least(greatest(coalesce(p_limite, 0), 0), 500);
$function$;

COMMENT ON FUNCTION public.cita_correo_tomar(uuid, uuid, text, uuid) IS NULL;
COMMENT ON FUNCTION public.cita_recordatorios_pendientes(integer) IS
  'Listado ENTRE CLÍNICAS de recordatorios por mandar (sólo ids), para /api/cron/recordatorios. Sólo clínicas con la agenda v2 encendida, la puerta S3 (gcal_sync_clinica_habilitada) y el interruptor agenda_ajustes.recordatorio_encendido. CONVENIO: la expresión del destinatario va junta con la de cita_correo_tomar.';

DO $$
BEGIN
  IF (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)')) <> '0339111d435e4592acb45261bd412f84'
     OR (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc WHERE oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)')) <> 'dee6e983be793c1145b8c56bcb89937f' THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: las funciones no quedaron con el cuerpo de R1.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS resultado
FROM (
  SELECT 1 AS n, 'las dos funciones, con el cuerpo de R1' AS comprobacion,
         (SELECT count(*)::text FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'), to_regprocedure('public.cita_recordatorios_pendientes(integer)'))
             AND md5(replace(p.prosrc, E'\r\n', E'\n')) IN ('0339111d435e4592acb45261bd412f84', 'dee6e983be793c1145b8c56bcb89937f')) AS valor, '2' AS esperado
  UNION ALL
  SELECT 2, 'siguen siendo sólo de service_role (anon/authenticated/service_role, las dos)',
         (SELECT string_agg(has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                            || '/' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text, ' ; ' ORDER BY p.proname)
            FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'), to_regprocedure('public.cita_recordatorios_pendientes(integer)'))),
         'false/false/true ; false/false/true'
) t
ORDER BY t.n;
