-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda de diseño (punto 14 de Angel) — el correo de CONFIRMACIÓN
-- propio de Spinus queda registrado en cita_correos como los demás correos
-- de cita (tipo nuevo 'confirmacion')
-- Rama: feature/agenda-v2-g3 · Escrita: 2026-11-14
-- Riesgo estimado: BAJO (un CHECK que se ensancha —ninguna fila existente
-- puede violarlo— y CREATE OR REPLACE de una función con la misma firma,
-- los mismos permisos y el mismo cuerpo salvo dos condiciones; ninguna
-- policy, ningún permiso de tabla y ningún dato cambian).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-14
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres -v ON_ERROR_STOP=1 -f`
--   del archivo completo, dos pasadas seguidas (rejilla 6 × OK las dos; la
--   segunda, no-op: el pre-vuelo acepta el md5 de esta migración). Anotada a
--   mano en supabase_migrations.schema_migrations (versión 20261119140000).
--   Pruebas: supabase/pruebas-sql/g3_correo_confirmacion.sql (en rojo contra la
--   base SIN esta migración: «caso 1» da 22023; y con la ventana exigida
--   también a la confirmación: «caso 1 para» NULL); e4_correos_cita.sql sigue
--   en verde. Comprobación:
--     select pg_get_constraintdef(oid) from pg_constraint where conname = 'cita_correos_tipo_check';
--     → … 'comprobante', 'recordatorio', 'confirmacion' …
--     select md5(prosrc) from pg_proc where oid = 'public.cita_correo_tomar(uuid,uuid,text,uuid)'::regprocedure;
--     → 5d0ce8dbadf8e0533893dfd4b7b3c099
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de E4,
--   20261115140000_agenda_e4_correos_cita.sql; mejor en la MISMA ventana que
--   E4, con cita_correos aún casi vacía: el ADD CONSTRAINT recorre la tabla
--   bajo ACCESS EXCLUSIVE).
-- AUDITORÍA INDEPENDIENTE 2026-11-14 (otro modelo, las 18 dimensiones de
--   supabase/AUDITORIA-MIGRACIONES.md, con el catálogo local en vivo): APTA.
--   Dos observaciones de bajo peso, atendidas: (1) aplicar en la misma ventana
--   que E4 (anotado arriba); (2) el COMMENT ON TABLE dice ahora qué tipos
--   respetan la ventana del recordatorio.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 14 de la tanda de diseño (Angel, 2026-11-14): «Invitar por correo»
-- exige evento de Google, así que una clínica sin Google Calendar no podía
-- mandar ningún correo al agendar. Spinus manda ahora su propio correo de
-- confirmación (fecha, hora, médico, consultorio con su dirección y el
-- enlace de confirmar o cancelar de E2), por el transporte del proyecto,
-- con o sin Google, y «queda registrado igual que los demás correos de
-- cita»: un renglón de cita_correos con su candado de testigo, sus 3
-- intentos y su Idempotency-Key (`confirmacion/<envío>`), sin destinatario
-- ni contenido. El CHECK de `tipo` y la lista de cita_correo_tomar sólo
-- admitían 'comprobante' y 'recordatorio': de ahí esta migración.
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- cita_correos_tipo_check: admite además 'confirmacion' (DROP + ADD en la
--   misma transacción; el CHECK nuevo es más ancho, así que ninguna fila
--   existente lo viola y la validación no puede fallar).
-- cita_correo_tomar(uuid, uuid, text, uuid): CREATE OR REPLACE, misma firma
--   y mismo retorno (conserva dueño, permisos, INVOKER y search_path). Sólo
--   dos diferencias con el cuerpo de E4:
--   (1) acepta p_tipo = 'confirmacion';
--   (2) la ventana del recordatorio (inicio ≤ ahora + N h) se exige sólo al
--       'recordatorio' (antes: «salvo al comprobante»). Una confirmación,
--       como el comprobante, vale para cualquier cita futura.
--   La toma de una confirmación pasa las MISMAS puertas que las otras dos:
--   interruptor encendido y S3 (gcal_sync_clinica_habilitada), cita de ESA
--   clínica, agendada o confirmada, no de todo el día, futura, y el MISMO
--   destinatario (correo del paciente activo o, si no tiene, el de la
--   reserva; en una por ligar, el de la reserva).
-- LÍMITE: la llave (cita, tipo, inicio_cita) da UNA confirmación por hora de
--   inicio. Un reenvío de la misma cita sólo se toma si el anterior falló
--   (no por duplicado) o quedó colgado más de 10 min, y como mucho 3 veces;
--   reagendar la cita (inicio nuevo) permite otra. Es el «no reenviar en
--   ráfaga» de Angel, puesto en la base.
-- La confirmación NO toca al recordatorio: el recordatorio sólo se salta si
--   salió el COMPROBANTE (E4, lista A 4), como hoy. Un paciente avisado al
--   agendar sigue recibiendo su recordatorio N horas antes.
-- cita_correos_pendientes y cita_correo_marcar NO cambian.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere E4. PG ≥ 14.
-- Bloqueos (lock_timeout 5 s): ALTER TABLE … DROP/ADD CONSTRAINT CHECK toma
--   ACCESS EXCLUSIVE sobre cita_correos el instante del recorrido (tabla
--   pequeña: unos renglones por cita). Nadie lee cita_correos en el camino
--   de una cita salvo la tarea de recordatorios y el after() de la reserva,
--   que esperan ese instante. CREATE OR REPLACE FUNCTION no bloquea tablas.
-- Orden respecto al código: PRIMERO esta migración. Sin ella,
--   `POST /api/agenda/correo` recibe 22023 de cita_correo_tomar y contesta
--   503 «no disponible» sin mandar nada; la app no cambia en nada más.
--   Código viejo contra esquema nuevo: no llama con 'confirmacion'; nada
--   cambia para él.
-- Alcance de los roles: el alcance de los roles no cambia en ninguna de las
--   dos direcciones (mismas funciones, mismos EXECUTE —sólo service_role—,
--   mismos privilegios de tabla y la misma policy de SELECT).
-- Contrato con spinus-consola: ninguna columna cambia de nombre, tipo ni
--   significado; `tipo` admite un valor más.
-- ⚠️ Re-ejecutar E4 después de esta migración ABORTA en su pre-vuelo (la
--   huella de constraints ya no es la suya): es lo correcto, porque E4
--   reescribiría cita_correo_tomar sin 'confirmacion'.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   Respaldar antes:
--     CREATE TABLE respaldos.cita_correos_AAAAMMDD AS SELECT * FROM public.cita_correos;
--   Las filas 'confirmacion' impiden volver al CHECK viejo: borrarlas antes
--   (son registro de envíos ya hechos, no datos clínicos) y volver a aplicar
--   el CHECK y la función de E4 (secciones 2 y 3.2 de 20261115140000).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- md5(prosrc) de cita_correo_tomar tal como la deja E4 y tal como la deja
  -- esta migración (la segunda pasada es un no-op).
  c_md5_e4  CONSTANT text := 'd7c18c8e5ba999f3b280056b74539bf2';
  c_md5_g3  CONSTANT text := '5d0ce8dbadf8e0533893dfd4b7b3c099';
  v_md5     text;
  v_check   text;
BEGIN
  IF to_regclass('public.cita_correos') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.cita_correos (E4).';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.cita_correos'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.cita_correos.', current_user;
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc
   WHERE oid = to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)') AND NOT prosecdef;
  IF v_md5 IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta cita_correo_tomar(uuid, uuid, text, uuid) INVOKER (E4).';
  END IF;
  IF v_md5 NOT IN (c_md5_e4, c_md5_g3) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_correo_tomar no es la de E4 ni la de esta migración (md5 %); revisar antes de reemplazarla.', v_md5;
  END IF;
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'cita_correo_tomar') <> 1 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay más de una cita_correo_tomar (sobrecarga).';
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_check FROM pg_constraint
   WHERE conrelid = 'public.cita_correos'::regclass AND conname = 'cita_correos_tipo_check';
  IF v_check IS NULL OR v_check NOT LIKE '%''comprobante''%' OR v_check NOT LIKE '%''recordatorio''%' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_correos_tipo_check no es el de E4 (%).', coalesce(v_check, 'AUSENTE');
  END IF;
  IF EXISTS (SELECT 1 FROM public.cita_correos WHERE tipo NOT IN ('comprobante', 'recordatorio', 'confirmacion')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: cita_correos tiene filas de un tipo desconocido.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · El CHECK de tipo, con 'confirmacion'.
-- ---------------------------------------------------------------------
ALTER TABLE public.cita_correos DROP CONSTRAINT IF EXISTS cita_correos_tipo_check;
ALTER TABLE public.cita_correos ADD CONSTRAINT cita_correos_tipo_check
  CHECK (tipo IS NOT NULL AND tipo IN ('comprobante', 'recordatorio', 'confirmacion'));

-- ---------------------------------------------------------------------
-- 3 · cita_correo_tomar: el cuerpo de E4 con 'confirmacion' (ver cabecera).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_correo_tomar(p_clinica_id uuid, p_cita_id uuid, p_tipo text, p_testigo uuid)
RETURNS TABLE (r_envio_id uuid, r_para text, r_inicio timestamptz, r_fin timestamptz, r_zona text,
               r_estado text, r_medico jsonb, r_consultorio jsonb)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
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
         -- ⚠️ Destinatario: la MISMA expresión que cita_correos_pendientes.
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
            OR (k.estado = 'enviando' AND k.tomado_en > now() - interval '10 minutes'))) THEN
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
$fn$;

-- Permisos de funciones (CLAUDE.md): CREATE OR REPLACE los conserva; se
-- repiten explícitos. SOLO service_role, como en E4: es el camino del
-- servidor (la tarea programada, el after() de la reserva y la ruta de la
-- confirmación, que llama tras sus puertas de sesión con la clínica de la
-- sesión); ni la consola ni una sesión de la app deben tomar envíos.
REVOKE EXECUTE ON FUNCTION public.cita_correo_tomar(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_correo_tomar(uuid, uuid, text, uuid) TO service_role;

COMMENT ON TABLE public.cita_correos IS
  'Envíos de correo de cita (agenda E4 y G3): recordatorio, comprobante y confirmacion (el correo de confirmación que el personal manda desde la agenda, con o sin Google). Llave (cita, tipo, inicio_cita): mover la cita da un recordatorio y una confirmación nuevos; una sola confirmación por inicio (salvo fallo, hasta 3 intentos). SIN destinatario ni contenido. Sólo escriben cita_correo_tomar y cita_correo_marcar. CONVENIO (dimensión 16): la expresión del destinatario está en cita_correos_pendientes y en cita_correo_tomar (van juntas); el correo se compone determinista de la fila porque Resend exige el mismo cuerpo con la misma Idempotency-Key (<tipo>/<id>). fallido/duplicado no se reintenta; máximo 3 intentos. Un comprobante enviado, o enviando hace menos de 10 min, impide el recordatorio del mismo inicio; una confirmación, no. La ventana de agenda_ajustes.recordatorio_horas (y el margen de 1 h) sólo se exige al recordatorio; comprobante y confirmacion valen para cualquier cita futura.';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'CHECK de tipo con confirmacion' AS comprobacion,
         coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                    WHERE conrelid = 'public.cita_correos'::regclass AND conname = 'cita_correos_tipo_check'), 'AUSENTE') AS valor,
         'CHECK (((tipo IS NOT NULL) AND (tipo = ANY (ARRAY[''comprobante''::text, ''recordatorio''::text, ''confirmacion''::text]))))' AS esperado
  UNION ALL
  SELECT 2, 'cita_correo_tomar: cuerpo de esta migración (md5)',
         coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)')), 'AUSENTE'),
         '5d0ce8dbadf8e0533893dfd4b7b3c099'
  UNION ALL
  SELECT 3, 'cita_correo_tomar INVOKER con search_path vacío',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)')), 'AUSENTE'),
         'true / true'
  UNION ALL
  SELECT 4, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_correo_tomar(uuid, uuid, text, uuid)')), 'AUSENTE'),
         'false,false,true / false'
  UNION ALL
  SELECT 5, 'policies de cita_correos, intactas',
         coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cita_correos'), 'NINGUNA'),
         'cita_correos_select'
  UNION ALL
  SELECT 6, 'filas por tipo fuera de la lista',
         (SELECT count(*)::text FROM public.cita_correos WHERE tipo NOT IN ('comprobante', 'recordatorio', 'confirmacion')),
         '0'
) t
ORDER BY t.n;
