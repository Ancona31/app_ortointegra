-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda H (punto 10 de Angel) — «Restablecer configuración de la
-- agenda»: UNA función transaccional, sólo para service_role
-- Rama: feature/agenda-v2-h2 · Escrita: 2026-11-15
-- Riesgo estimado: BAJO al aplicar (sólo crea una función; ninguna tabla,
-- policy, permiso ni dato cambia). La FUNCIÓN, al llamarse, sí reescribe la
-- configuración de UNA clínica (ver «Qué hace»): la llama sólo
-- `POST /api/agenda/restablecer` tras comprobar en el servidor que quien la
-- pide es el administrador de esa clínica.
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-15
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres -v ON_ERROR_STOP=1 -f`
--   del archivo completo, dos pasadas seguidas (rejilla 5 × OK las dos; la
--   segunda, no-op: el pre-vuelo acepta el md5 de esta migración). Anotada a
--   mano en supabase_migrations.schema_migrations (versión 20261120121000).
--   Pruebas: supabase/pruebas-sql/h2_restablecer_configuracion.sql.
--   Comprobación:
--     select md5(prosrc) from pg_proc where oid = 'public.agenda_restablecer_configuracion(uuid,uuid)'::regprocedure;
--     → 5f2facc1f452bd81dafe6b823855dc04
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de
--   20261120120000_agenda_h2_recordatorio_interruptor.sql).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 10 de la tanda H (Angel, 2026-11-15): un botón «Restablecer
-- configuración de la agenda», sólo para el administrador, que la deja
-- «como si nunca se hubiera configurado». NO toca las citas, ni sus
-- pacientes, ni la auditoría, ni los contactos bloqueados; lo que tenga
-- citas ligadas se archiva o revoca, no se borra; queda en audit_log; se
-- valida en el servidor. No hace falta ninguna policy nueva ni cambiar una:
-- la función corre como service_role (BYPASSRLS) y pasa por los mismos
-- disparadores que cualquier escritura del servidor.
--
-- ═══ QUÉ HACE agenda_restablecer_configuracion(p_clinica_id, p_actor) ═══
-- Todo en la transacción de la llamada; si algo falla, no cambia nada.
-- 0. Si p_actor no es médico administrador de ESA clínica → 'sin_permiso'
--    sin tocar nada (la ruta ya lo comprobó; esto es la segunda barrera, y va
--    PRIMERO para que nadie sondee el interruptor de otra clínica). Después
--    bloquea la fila de agenda_ajustes (FOR UPDATE: dos restablecimientos o un
--    guardado de plazos a la vez van en fila). Sin fila o con la v2 apagada →
--    'apagado' sin tocar nada.
-- 0b. RESPALDO: antes de pisarlo, el horario y horario_propio de cada
--    consultorio quedan en audit_log ('agenda_horario_restablecido', una
--    fila por consultorio, descripcion = jsonb de los dos valores). Así el
--    reinicio se puede deshacer a mano (hallazgo 1 de la auditoría).
-- 1. Consultorios de la clínica (activos y archivados): `horario` y
--    `horario_propio` a su DEFAULT de columna (todos los días cerrados y
--    false). Es el estado con el que NACE un consultorio: con
--    horario_propio = false manda el horario de la clínica
--    (horarioEfectivo), así que la agenda no se queda en gris; y «Primeros
--    pasos» lo reconoce como «horario sin configurar» (paso 1 pendiente).
--    `clinicas.horario_consulta` no se toca (spinus-consola).
-- 2. tipos_cita de la clínica: TODOS los activos se archivan (activo =
--    false). Nada se borra (tampoco hay DELETE en tipos_cita): un tipo con
--    citas sigue apuntado por ellas con su instantánea.
-- 3. reserva_enlaces VIGENTES de la clínica (sin revocar, sin usar, sin
--    caducar): revocados con el mismo UPDATE que «Revocar» (revocado_en,
--    revocado_por = p_actor); `proteger_reserva_enlaces()` lo deja y fija
--    la hora. Los usados, caducados o ya revocados no se tocan.
-- 4. agenda_ajustes: los cuatro plazos a su DEFAULT (24 h, 2 h, 60 d, 7 d)
--    y recordatorio_encendido a su DEFAULT (false). El interruptor de la v2
--    y el candado NO se tocan (y `proteger_agenda_ajustes()` impediría a
--    service_role tocarlos).
-- 5. Una fila en audit_log a nombre de p_actor
--    ('agenda_configuracion_restablecida', con los conteos), además de las
--    de respaldo del paso 0b. Además, los
--    disparadores log_tabla_change dejan su fila por cada fila tocada
--    (usuario 'system', como toda escritura de service_role).
-- NO TOCA: appointments, pacientes, audit_log (salvo añadir), reserva_
--    contactos / bloqueos, reserva_verificaciones, cita_confirmaciones,
--    cita_correos, la conexión con Google, clinicas, profiles.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B1, B5, B6, D1, la de seguridad 20261117122000 y
--   20261120120000 (la columna recordatorio_encendido). PG ≥ 14.
-- Bloqueos al aplicar: ninguno sobre tablas (CREATE FUNCTION). Al LLAMARLA:
--   FOR UPDATE de una fila de agenda_ajustes y UPDATE de las filas de UNA
--   clínica en consultorios, tipos_cita y reserva_enlaces (row locks).
-- Orden respecto al código: PRIMERO esta migración. Sin ella la ruta recibe
--   PGRST202 y responde 503 «no disponible» sin tocar nada; el botón avisa.
--   Código viejo contra esquema nuevo: no la llama.
-- Alcance de los roles:
--   gana — service_role: EXECUTE de la función nueva.
--   pierde — nada. anon y authenticated no la pueden ejecutar (comprobado
--          en la rejilla y en la prueba SQL).
-- Contrato con spinus-consola: ninguna columna cambia; la función escribe
--   sólo columnas de agenda v2 y `consultorios.horario/horario_propio`.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP FUNCTION IF EXISTS public.agenda_restablecer_configuracion(uuid, uuid);
--   Un restablecimiento YA HECHO no se deshace solo: los tipos archivados se
--   reactivan desde la configuración; los enlaces revocados no vuelven (se
--   emiten otros); el horario de cada consultorio se repone desde su fila
--   'agenda_horario_restablecido' de audit_log:
--     UPDATE public.consultorios c
--        SET horario = (l.descripcion::jsonb -> 'horario'),
--            horario_propio = (l.descripcion::jsonb ->> 'horario_propio')::boolean
--       FROM public.audit_log l
--      WHERE l.accion = 'agenda_horario_restablecido' AND l.registro_id = c.id
--        AND l.created_at = '<instante del reinicio>';
--
-- ═══ AUDITORÍA ═════════════════════════════════════════════════════════
-- AUDITORÍA INDEPENDIENTE 2026-11-15 (otro modelo —sonnet—, las 18
--   dimensiones de supabase/AUDITORIA-MIGRACIONES.md, con el catálogo local en
--   vivo): APTA CON CAMBIOS. Atendidos los dos hallazgos: (1) el horario de
--   cada consultorio se pisaba sin respaldo → ahora queda antes en audit_log
--   (paso 0b; la ruta y su confirmación fuerte ya existen); (2) la comprobación
--   de administrador iba después del interruptor → ahora va primero. Verificado
--   por el auditor: el «valor de fábrica» (DEFAULT de columna) es el de
--   nacimiento de un consultorio; los disparadores de consultorios, de
--   agenda_ajustes y de reserva_enlaces no impiden el reinicio; la
--   concurrencia con la reserva, la emisión y el PUT de plazos no deja ciclos.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  c_md5_h2 CONSTANT text := '5f2facc1f452bd81dafe6b823855dc04';
  v_md5    text;
BEGIN
  IF to_regclass('public.agenda_ajustes') IS NULL OR to_regclass('public.tipos_cita') IS NULL
     OR to_regclass('public.reserva_enlaces') IS NULL OR to_regclass('public.consultorios') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_ajustes, tipos_cita, reserva_enlaces o consultorios.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass
                  AND attname = 'recordatorio_encendido' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_ajustes.recordatorio_encendido (20261120120000).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.consultorios'::regclass
                  AND attname = 'horario_propio' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta consultorios.horario_propio (B5).';
  END IF;
  -- Los DEFAULT que la función usa como «valor de fábrica» tienen que existir.
  IF (SELECT count(*) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
       WHERE (d.adrelid = 'public.agenda_ajustes'::regclass AND a.attname IN
               ('recordatorio_horas', 'anticipacion_min_horas', 'horizonte_dias', 'vigencia_enlace_unico_dias', 'recordatorio_encendido'))
          OR (d.adrelid = 'public.consultorios'::regclass AND a.attname IN ('horario', 'horario_propio'))) <> 7 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta el DEFAULT de algún ajuste o de consultorios.horario/horario_propio.';
  END IF;
  -- El revocado lo hace el disparador de la corrección de seguridad (fija la hora y deja a service_role).
  IF to_regprocedure('public.proteger_reserva_enlaces()') IS NULL
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.proteger_reserva_enlaces()')) NOT LIKE 'acd4128b%' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: proteger_reserva_enlaces() no es la de 20261117122000.';
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = to_regprocedure('public.agenda_restablecer_configuracion(uuid, uuid)');
  IF v_md5 IS NOT NULL AND v_md5 <> c_md5_h2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: agenda_restablecer_configuracion ya existe con otro cuerpo (md5 %).', v_md5;
  END IF;
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'agenda_restablecer_configuracion') > 1 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay más de una agenda_restablecer_configuracion (sobrecarga).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La función. INVOKER: corre como quien la llama (service_role) y
--     pasa por todos los disparadores. ⚠️ No la hagas SECURITY DEFINER: de
--     postgres, se saltaría proteger_agenda_ajustes() y
--     proteger_reserva_enlaces().
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agenda_restablecer_configuracion(p_clinica_id uuid, p_actor uuid)
RETURNS TABLE (r_resultado text, r_consultorios integer, r_tipos integer, r_enlaces integer)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_ajustes uuid;
  v_cons    integer;
  v_tipos   integer;
  v_enlaces integer;
BEGIN
  IF p_clinica_id IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION 'agenda_restablecer_configuracion: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- Primero QUIÉN (aunque la clínica esté apagada): nadie que no la administre
  -- aprende nada de ella por esta función.
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr
                  WHERE pr.id = p_actor AND pr.clinica_id = p_clinica_id
                    AND pr.role = 'medico' AND pr.es_admin_de_clinica IS TRUE) THEN
    RETURN QUERY SELECT 'sin_permiso'::text, 0, 0, 0;
    RETURN;
  END IF;
  SELECT j.id INTO v_ajustes FROM public.agenda_ajustes j
   WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'apagado'::text, 0, 0, 0;
    RETURN;
  END IF;

  -- Respaldo del horario que se va a pisar: UNA fila de audit_log por
  -- consultorio con su horario y horario_propio de antes (no son datos de
  -- pacientes). Es lo único del reinicio que no se recupera desde la pantalla.
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  SELECT p_actor::text, 'agenda_horario_restablecido', 'consultorios', c.id,
         jsonb_build_object('horario_propio', c.horario_propio, 'horario', c.horario)::text
    FROM public.consultorios c
   WHERE c.clinica_id = p_clinica_id;

  UPDATE public.consultorios c SET horario = DEFAULT, horario_propio = DEFAULT
   WHERE c.clinica_id = p_clinica_id;
  GET DIAGNOSTICS v_cons = ROW_COUNT;

  UPDATE public.tipos_cita t SET activo = false
   WHERE t.clinica_id = p_clinica_id AND t.activo;
  GET DIAGNOSTICS v_tipos = ROW_COUNT;

  UPDATE public.reserva_enlaces e SET revocado_en = now(), revocado_por = p_actor
   WHERE e.clinica_id = p_clinica_id AND e.revocado_en IS NULL AND e.usado_en IS NULL
     AND (e.caduca_en IS NULL OR e.caduca_en > now());
  GET DIAGNOSTICS v_enlaces = ROW_COUNT;

  UPDATE public.agenda_ajustes j
     SET recordatorio_horas = DEFAULT, anticipacion_min_horas = DEFAULT, horizonte_dias = DEFAULT,
         vigencia_enlace_unico_dias = DEFAULT, recordatorio_encendido = DEFAULT
   WHERE j.id = v_ajustes;

  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  VALUES (p_actor::text, 'agenda_configuracion_restablecida', 'agenda_ajustes', v_ajustes,
          format('consultorios: %s; tipos archivados: %s; enlaces revocados: %s', v_cons, v_tipos, v_enlaces));

  RETURN QUERY SELECT 'ok'::text, v_cons, v_tipos, v_enlaces;
END
$fn$;

-- Permisos de funciones (CLAUDE.md): MÁS CERRADA que la regla general, sólo
-- service_role. Justificación: reescribe la configuración de una clínica
-- entera con el p_clinica_id y el p_actor que le pasen; la única puerta que
-- decide quién puede es la ruta del servidor (sesión → administrador de esa
-- clínica → interruptor). Ni anon, ni authenticated, ni la consola.
REVOKE EXECUTE ON FUNCTION public.agenda_restablecer_configuracion(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.agenda_restablecer_configuracion(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.agenda_restablecer_configuracion(uuid, uuid) IS
  'Restablece la configuración de la agenda v2 de UNA clínica (tanda H, punto 10): consultorios al horario de fábrica (DEFAULT, sin horario propio), tipos de cita archivados, enlaces de reserva vigentes revocados, plazos de fábrica y recordatorio apagado; una fila en audit_log. No toca citas, pacientes, auditoría ni contactos bloqueados. Sólo service_role; la llama POST /api/agenda/restablecer tras comprobar que p_actor es el administrador de p_clinica_id (y la función lo vuelve a comprobar).';

COMMIT;

-- ---------------------------------------------------------------------
-- 3 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'agenda_restablecer_configuracion: cuerpo de esta migración (md5)' AS comprobacion,
         coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.agenda_restablecer_configuracion(uuid, uuid)')), 'AUSENTE') AS valor,
         '5f2facc1f452bd81dafe6b823855dc04' AS esperado
  UNION ALL
  SELECT 2, 'INVOKER / search_path vacío / VOLATILE',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text || ' / ' || provolatile::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.agenda_restablecer_configuracion(uuid, uuid)')), 'AUSENTE'),
         'true / true / v'
  UNION ALL
  SELECT 3, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.agenda_restablecer_configuracion(uuid, uuid)')), 'AUSENTE'),
         'false,false,true / false'
  UNION ALL
  SELECT 4, 'policies de agenda_ajustes, consultorios, reserva_enlaces y tipos_cita, intactas',
         coalesce((SELECT string_agg(tablename || '.' || policyname, ',' ORDER BY tablename, policyname) FROM pg_policies
                    WHERE schemaname = 'public' AND tablename IN ('agenda_ajustes', 'tipos_cita', 'reserva_enlaces', 'consultorios')), 'NINGUNA'),
         'agenda_ajustes.agenda_ajustes_insert,agenda_ajustes.agenda_ajustes_select,agenda_ajustes.agenda_ajustes_update,consultorios.consultorios_gates_insert,consultorios.consultorios_insert,consultorios.consultorios_select,consultorios.consultorios_update,reserva_enlaces.reserva_enlaces_insert,reserva_enlaces.reserva_enlaces_select,reserva_enlaces.reserva_enlaces_update,tipos_cita.tipos_cita_insert,tipos_cita.tipos_cita_select,tipos_cita.tipos_cita_update'
  UNION ALL
  SELECT 5, 'ninguna SECURITY DEFINER nueva escribe agenda_ajustes',
         (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
           AND p.prosrc ~* '(insert\s+into|update)\s+public\.agenda_ajustes'), '0'
) t
ORDER BY t.n;
