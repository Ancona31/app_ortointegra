-- ═══════════════════════════════════════════════════════════════════════════
-- Agenda · R1 — el recordatorio sale aunque haya salido el comprobante de la
-- reserva, salvo que el comprobante saliera ya dentro de la ventana
-- Rama: feature/recordatorio-reserva · Escrita: 2026-11-26
-- Guion: docs/spec/recordatorio-reserva/ENSAYO.md
-- ───────────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-26, stack local de Supabase (CLI 2.117.0) con las 20
--   migraciones de main: aplicada, deshecha con su reversa y vuelta a aplicar;
--   prueba r1_recordatorio_tras_comprobante.sql en verde.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DE ENSAYO SOBRE EL CLON
--   DE ESTRUCTURA Y DE AUDITORÍA INDEPENDIENTE (supabase/AUDITORIA-MIGRACIONES.md).
--
-- EL DEFECTO (confirmado en producción, 2026-11-26): una cita reservada por
--   enlace con MÁS antelación que la ventana del recordatorio no recibía nunca
--   el recordatorio. cita_correo_tomar (tipo 'recordatorio') y
--   cita_recordatorios_pendientes (F4, 20261201160000) lo saltaban si existía un
--   comprobante 'enviado' para ese inicio, SIN mirar cuándo salió. La intención
--   escrita (src/lib/reserva/comprobanteReserva.ts) era otra: «una reserva hecha
--   DENTRO de la ventana recibe UNO».
--
-- QUÉ HACE: reescribe esas dos funciones con el cuerpo de F4 más UNA condición,
--   la misma en las dos: el comprobante sólo quita el recordatorio si salió (o
--   se está mandando) ya dentro de la ventana del recordatorio de esa cita:
--     coalesce(k.enviado_en, k.tomado_en) >= inicio − recordatorio_horas
--   Nada más cambia: firma, INVOKER, search_path, dueño, permisos (sólo
--   service_role), destinatario, puertas, candado 1792 y reintentos.
--
-- CASOS (recordatorio a 2 h):
--   · reserva a 15 h de la cita  → comprobante al reservar Y recordatorio a 2 h;
--   · reserva a 1 h 30 de la cita → sólo el comprobante (ya está dentro);
--   · cita movida: la llave lleva inicio_cita; el comprobante del inicio viejo
--     no cuenta para el nuevo (como antes de esta migración);
--   · recordatorio_horas cambiado entre el comprobante y el recordatorio: se
--     juzga con el valor VIGENTE cuando corre la tarea. Si se amplió y el
--     comprobante queda dentro de la ventana nueva, no sale recordatorio; si se
--     acortó, sale.
--   · comprobante que sale minutos ANTES de que empiece la ventana (reserva a
--     2 h 05 con ventana de 2 h): recibe los dos, con minutos de diferencia. Es
--     lo que dice la regla; no se le ha puesto margen.
-- AL APLICAR: la tarea /api/cron/recordatorios (cada 15 min) manda en su
--   siguiente pasada el recordatorio de las citas que YA están dentro de su
--   ventana, faltan más de 1 h y tenían el comprobante de antes de la ventana.
--   A las que falta menos de 1 h ya no les llega (regla de F4, sin cambio).
--
-- Depende de: F4 (20261201160000). Exige el cuerpo de F4 de las dos funciones
--   (huella md5 de prosrc); si alguien las cambió, aborta sin tocar nada.
-- Bloqueos: sólo catálogo (CREATE OR REPLACE de dos funciones). No toca filas.
-- Ventana de despliegue: no depende del código; puede ir antes o después.
-- Riesgo: MEDIO. Reescribe dos funciones del envío de correos; el efecto es
--   mandar correos que hoy no salen.
-- No re-ejecutable: una segunda pasada ABORTA en el pre-vuelo sin cambiar nada.
-- Vuelta atrás: supabase/reversas/20261207120000_recordatorio_tras_comprobante_reversa.sql
--   (los recordatorios ya mandados no se deshacen).
-- Prueba: supabase/pruebas-sql/r1_recordatorio_tras_comprobante.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP TABLE IF EXISTS pg_temp._r1_antes;
CREATE TEMP TABLE _r1_antes (recuperables bigint NOT NULL);

DO $$
DECLARE
  v_f regprocedure;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay que aplicarla como postgres (current_user es %).', current_user;
  END IF;
  IF to_regclass('public.cita_correos') IS NULL OR to_regclass('public.agenda_ajustes') IS NULL
     OR to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)') IS NULL
     OR to_regprocedure('public.cita_recordatorios_pendientes(integer)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan los objetos de F4 (20261201160000).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.cita_correos'::regclass AND NOT attisdropped
         AND attname IN ('appointment_id', 'clinica_id', 'tipo', 'inicio_cita', 'estado', 'tomado_en', 'enviado_en')) <> 7 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.cita_correos no tiene las columnas que nombra esta migración.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p
              WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'),
                              to_regprocedure('public.cita_recordatorios_pendientes(integer)'))
                AND position('R1 · Sólo si ese comprobante salió' IN p.prosrc) > 0) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: esta migración ya está aplicada. No se repite.';
  END IF;
  -- Las dos funciones, con el cuerpo de F4 (fines de línea normalizados), INVOKER y search_path vacío.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)')
                    AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                    AND md5(replace(p.prosrc, E'\r\n', E'\n')) = '292eec972d66bd6ab312c4797c8c65fc') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.cita_correo_tomar no es la de F4 (INVOKER, search_path vacío y su cuerpo): alguien la cambió. No se reescribe a ciegas.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)')
                    AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                    AND md5(replace(p.prosrc, E'\r\n', E'\n')) = 'be18fa7735f7bf072bdc8178125694d0') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.cita_recordatorios_pendientes no es la de F4 (INVOKER, search_path vacío y su cuerpo): alguien la cambió. No se reescribe a ciegas.';
  END IF;
  FOREACH v_f IN ARRAY ARRAY[to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'),
                             to_regprocedure('public.cita_recordatorios_pendientes(integer)')] LOOP
    IF NOT pg_has_role(current_user, (SELECT proowner FROM pg_proc WHERE oid = v_f), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de %.', current_user, v_f;
    END IF;
    IF has_function_privilege('anon', v_f, 'EXECUTE') OR has_function_privilege('authenticated', v_f, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_f, 'EXECUTE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es sólo de service_role.', v_f;
    END IF;
  END LOOP;
  -- INFO para la rejilla: citas que hoy el listado NO da por un comprobante de antes de su ventana.
  INSERT INTO pg_temp._r1_antes
  SELECT count(*)
    FROM public.agenda_ajustes j
    JOIN public.appointments a ON a.clinica_id = j.clinica_id
   WHERE j.agenda_v2_encendida AND j.recordatorio_encendido
     AND a.start_time > now() + interval '1 hour' AND a.status IN ('scheduled', 'confirmed') AND NOT a.all_day
     AND EXISTS (SELECT 1 FROM public.cita_correos k
                  WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id AND k.inicio_cita = a.start_time
                    AND k.tipo = 'comprobante' AND k.estado = 'enviado'
                    AND coalesce(k.enviado_en, k.tomado_en) < a.start_time - make_interval(hours => j.recordatorio_horas))
     AND NOT EXISTS (SELECT 1 FROM public.cita_correos k
                      WHERE k.appointment_id = a.id AND k.clinica_id = a.clinica_id AND k.inicio_cita = a.start_time
                        AND k.tipo = 'recordatorio');
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

-- Post-vuelo: lo que tiene que haber quedado, o se deshace todo.
DO $$
DECLARE
  v_f regprocedure;
BEGIN
  FOREACH v_f IN ARRAY ARRAY[to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'),
                             to_regprocedure('public.cita_recordatorios_pendientes(integer)')] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = v_f AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                      AND position('coalesce(k.enviado_en, k.tomado_en) >= ' IN p.prosrc) > 0
                      AND md5(replace(p.prosrc, E'\r\n', E'\n')) NOT IN ('292eec972d66bd6ab312c4797c8c65fc', 'be18fa7735f7bf072bdc8178125694d0')) THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: % no quedó con la condición nueva (o dejó de ser INVOKER con search_path vacío).', v_f;
    END IF;
    IF has_function_privilege('anon', v_f, 'EXECUTE') OR has_function_privilege('authenticated', v_f, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_f, 'EXECUTE')
       OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) x WHERE p.oid = v_f AND x.grantee = 0) THEN
      RAISE EXCEPTION 'POST-VUELO FALLÓ: los permisos de % cambiaron.', v_f;
    END IF;
  END LOOP;
  IF (SELECT provolatile FROM pg_proc WHERE oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)')) <> 's' THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: cita_recordatorios_pendientes dejó de ser STABLE.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS resultado
FROM (
  SELECT 1 AS n, 'cita_correo_tomar: INVOKER, search_path vacío, con la condición nueva; anon/authenticated/service_role' AS comprobacion,
         (SELECT (NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                  AND position('coalesce(k.enviado_en, k.tomado_en) >= v_a.start_time - make_interval(hours => v_horas)' IN p.prosrc) > 0)::text || ' ; '
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)')) AS valor,
         'true ; false/false/true' AS esperado
  UNION ALL
  SELECT 2, 'cita_recordatorios_pendientes: INVOKER, STABLE, search_path vacío, con la condición nueva; anon/authenticated/service_role',
         (SELECT (NOT p.prosecdef AND p.provolatile = 's' AND p.proconfig = ARRAY['search_path=""']
                  AND position('coalesce(k.enviado_en, k.tomado_en) >= a.start_time - make_interval(hours => j.recordatorio_horas)' IN p.prosrc) > 0)::text || ' ; '
                 || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_recordatorios_pendientes(integer)')),
         'true ; false/false/true'
  UNION ALL
  SELECT 3, 'ninguna de las dos conserva el cuerpo de F4',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'),
                           to_regprocedure('public.cita_recordatorios_pendientes(integer)'))
             AND md5(replace(p.prosrc, E'\r\n', E'\n')) IN ('292eec972d66bd6ab312c4797c8c65fc', 'be18fa7735f7bf072bdc8178125694d0')),
         '0'
  UNION ALL
  SELECT 4, 'dueño de las dos (el de antes: postgres)',
         (SELECT string_agg(DISTINCT pg_get_userbyid(p.proowner), ',') FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)'),
                           to_regprocedure('public.cita_recordatorios_pendientes(integer)'))),
         'postgres'
  UNION ALL
  SELECT 5, 'ANTES: citas futuras (a más de 1 h) con comprobante de antes de su ventana y sin recordatorio, en clínicas con el recordatorio encendido',
         (SELECT recuperables::text FROM pg_temp._r1_antes LIMIT 1), NULL
  UNION ALL
  SELECT 6, 'de ésas, las que la tarea tomará en su siguiente pasada (ya están dentro de su ventana)',
         (SELECT count(*)::text FROM public.cita_recordatorios_pendientes(500) x
           WHERE EXISTS (SELECT 1 FROM public.cita_correos k WHERE k.appointment_id = x.r_cita_id AND k.tipo = 'comprobante' AND k.estado = 'enviado')), NULL
) t
ORDER BY t.n;
