-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda I, punto 3 de Angel — marca «horario revisado por una
-- persona» en cada consultorio, y «Restablecer» la vuelve a quitar
-- Rama: feature/agenda-v2-i4 · Escrita: 2026-11-17
-- Riesgo estimado: BAJO (una columna NULLABLE sin DEFAULT en consultorios
-- —sólo catálogo, no reescribe filas— y el CREATE OR REPLACE de
-- agenda_restablecer_configuracion() con una asignación más; ninguna policy,
-- permiso de tabla ni dato existente cambia).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-17
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres -v ON_ERROR_STOP=1 -f`
--   del archivo completo: un ensayo con ROLLBACK y luego dos pasadas seguidas (rejilla
--   6 × OK las dos; la segunda sin cambios, sólo NOTICEs). Registrada en
--   supabase_migrations.schema_migrations. Pruebas: supabase/pruebas-sql/i4_*.sql.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de 20261120121000).
-- AUDITORÍA INDEPENDIENTE 2026-11-17 (otro modelo, las dimensiones de
--   supabase/AUDITORIA-MIGRACIONES.md, con lectura del catálogo local): APTA
--   CON CAMBIOS (menores). Aplicado: la VUELTA ATRÁS respalda la columna antes
--   de borrarla. Anotado sin cambio de código (notas de I4): un consultorio
--   creado por POST nace «por revisar» aunque una persona tecleara su horario
--   (sólo el PATCH con la v2 pone la marca); todas las filas existentes nacen
--   en NULL (deliberado); el respaldo de «Restablecer» en audit_log no guarda
--   el valor previo de la marca (añadirlo cambiaría el md5: no se hizo).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 3 de Angel (2026-11-17): «El horario tras "Restablecer" se queda como
-- lo dejaste. Pero ese primer paso debe mostrarse como "por revisar", no como
-- hecho, hasta que el médico entre y lo confirme. Lo mismo para los
-- consultorios que heredaron el horario de la clínica y nadie ha revisado.»
-- «Primeros pasos» calcula sus pasos de los datos (no guarda estado), y hoy
-- ningún dato distingue un horario que una PERSONA eligió de uno copiado por
-- una migración (G4, 20261119130000) o por «Restablecer» (H2,
-- 20261120121000): los dos quedan con horario_propio = true y días abiertos.
--
-- ═══ QUÉ CREA / CAMBIA ═════════════════════════════════════════════════
-- consultorios.horario_revisado_en timestamptz NULL (sin DEFAULT): cuándo una
--   persona confirmó o guardó el horario de ESE consultorio desde la
--   configuración de la agenda v2 (PATCH /api/consultorios/[id], con la v2,
--   sólo el dueño: la RLS de UPDATE de siempre). NULL = nadie lo ha revisado.
--   La migración deja TODAS las filas en NULL (la opción más segura: la
--   auditoría no distingue con certeza quién tocó qué después de G4; un
--   «por revisar» de más se resuelve con un clic, uno de menos esconde un
--   horario que nadie eligió). No es dato de pacientes.
-- agenda_restablecer_configuracion(uuid, uuid): idéntica a 20261120121000
--   salvo que el UPDATE de consultorios pone además horario_revisado_en =
--   NULL (el horario de partida vuelve a estar «por revisar»). Mismos
--   permisos (sólo service_role), INVOKER, search_path = ''.
--
-- ═══ CHOQUES CON LO QUE YA EXISTE (comprobados) ═══════════════════════
-- audit_consultorios (log_tabla_change, AFTER INSERT/UPDATE/DELETE): la
--   columna nueva entra en la auditoría de la tabla como cualquier otra.
-- trg_consultorios_cap_10 / _default_* / _updated_at: no miran la columna.
-- consultorios_update (RLS): sin cambio; el dueño ya puede escribir toda la
--   fila (la marca la pone el servidor con su sesión; que el dueño la ponga
--   por PostgREST es lo mismo que pulsar «Confirmar horario»).
-- spinus-consola: columna NUEVA; ninguna existente cambia de nombre ni tipo.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere 20261120121000 (cuerpo por md5) y B5 (horario_propio). PG ≥ 11
--   (ADD COLUMN sin DEFAULT no reescribe la tabla).
-- Bloqueos (lock_timeout 5 s): ALTER TABLE … ADD COLUMN toma ACCESS EXCLUSIVE
--   sobre consultorios un instante (sólo catálogo).
-- Orden respecto al código: PRIMERO esta migración si la v2 está encendida
--   en alguna clínica (el PATCH con la v2 escribe la columna; sin ella, 500
--   al guardar un horario). Con la v2 apagada el código no la nombra.
-- Alcance de los roles: nadie gana ni pierde privilegios (columna nueva con
--   los privilegios de tabla de siempre; la función, como estaba).
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   Respaldar antes (las confirmaciones hechas por personas se pierden con la
--   columna; requiere el esquema respaldos):
--     CREATE TABLE respaldos.consultorios_revisado_AAAAMMDD AS
--       SELECT id, horario_revisado_en FROM public.consultorios WHERE horario_revisado_en IS NOT NULL;
--   Volver a ejecutar la sección 2 de 20261120121000 (función de antes) y
--   ALTER TABLE public.consultorios DROP COLUMN IF EXISTS horario_revisado_en;
--   (antes, ajustar la vista de spinus-consola si la nombrara).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  c_md5_h2 CONSTANT text := '6c99e553177ba42d0f3723468b39f241';  -- 20261120121000
  c_md5_i4 CONSTANT text := '1c3906443dc060471fce5067344b0157';                          -- esta migración (re-ejecución)
  v_md5    text;
BEGIN
  IF to_regclass('public.consultorios') IS NULL OR NOT EXISTS (SELECT 1 FROM pg_attribute
       WHERE attrelid = 'public.consultorios'::regclass AND attname = 'horario_propio' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta consultorios.horario_propio (B5).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.consultorios'::regclass AND attname = 'horario_revisado_en'
              AND NOT attisdropped AND atttypid <> 'timestamptz'::regtype) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: consultorios.horario_revisado_en ya existe con otro tipo.';
  END IF;
  SELECT md5(prosrc) INTO v_md5 FROM pg_proc WHERE oid = to_regprocedure('public.agenda_restablecer_configuracion(uuid, uuid)');
  IF v_md5 IS NULL OR v_md5 NOT IN (c_md5_h2, c_md5_i4) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: agenda_restablecer_configuracion no es la de 20261120121000 (md5 %).', coalesce(v_md5, 'AUSENTE');
  END IF;
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'agenda_restablecer_configuracion') > 1 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: hay más de una agenda_restablecer_configuracion (sobrecarga).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La columna (todas las filas en NULL: nadie ha revisado nada todavía).
-- ---------------------------------------------------------------------
ALTER TABLE public.consultorios ADD COLUMN IF NOT EXISTS horario_revisado_en timestamptz;

COMMENT ON COLUMN public.consultorios.horario_revisado_en IS
  'Agenda v2 (tanda I, punto 3): cuándo una persona confirmó o guardó el horario de este consultorio desde la configuración de la agenda. NULL = por revisar (lo heredó de la clínica en 20261119130000, lo dejó «Restablecer» o nadie lo ha confirmado). La escribe PATCH /api/consultorios/[id] con la v2; agenda_restablecer_configuracion la vuelve a NULL.';

-- ---------------------------------------------------------------------
-- 3 · «Restablecer» vuelve a dejar el horario por revisar. Cuerpo de
--     20261120121000 con UNA asignación más en el UPDATE de consultorios.
--     ⚠️ INVOKER: no la hagas SECURITY DEFINER (se saltaría los disparadores
--     de ajustes y enlaces).
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

  -- El horario de partida de la v2: el de la clínica COPIADO y propio, la
  -- herencia de G4 (20261119130000). La única fuente sigue siendo el consultorio.
  -- Tanda I (punto 3): queda POR REVISAR hasta que su médico lo confirme.
  UPDATE public.consultorios c SET horario = cl.horario_consulta, horario_propio = true, horario_revisado_en = NULL
    FROM public.clinicas cl
   WHERE cl.id = c.clinica_id AND c.clinica_id = p_clinica_id;
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

-- Permisos de funciones (CLAUDE.md), repetidos explícitos: MÁS CERRADA que la
-- regla general, sólo service_role (la justificación de 20261120121000: reescribe
-- la configuración de una clínica entera con los parámetros que le pasen; la
-- puerta es la ruta del servidor).
REVOKE EXECUTE ON FUNCTION public.agenda_restablecer_configuracion(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.agenda_restablecer_configuracion(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.agenda_restablecer_configuracion(uuid, uuid) IS
  'Restablece la configuración de la agenda v2 de UNA clínica (tanda H, punto 10): consultorios al horario de partida de la v2 (el de la clínica copiado como horario propio, la herencia de G4) y POR REVISAR (horario_revisado_en NULL, tanda I punto 3), tipos de cita archivados, enlaces de reserva vigentes revocados, plazos de fábrica y recordatorio apagado; una fila en audit_log. No toca citas, pacientes, auditoría ni contactos bloqueados. Sólo service_role; la llama POST /api/agenda/restablecer tras comprobar que p_actor es el administrador de p_clinica_id (y la función lo vuelve a comprobar).';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'consultorios.horario_revisado_en: timestamptz, NULL, sin DEFAULT' AS comprobacion,
         coalesce((SELECT format_type(a.atttypid, a.atttypmod) || ' / ' || (NOT a.attnotnull)::text || ' / ' || (NOT a.atthasdef)::text
                    FROM pg_attribute a WHERE a.attrelid = 'public.consultorios'::regclass AND a.attname = 'horario_revisado_en' AND NOT a.attisdropped), 'AUSENTE') AS valor,
         'timestamp with time zone / true / true' AS esperado
  UNION ALL
  SELECT 2, 'agenda_restablecer_configuracion: cuerpo de esta migración (md5)',
         coalesce((SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.agenda_restablecer_configuracion(uuid, uuid)')), 'AUSENTE'),
         '1c3906443dc060471fce5067344b0157'
  UNION ALL
  SELECT 3, 'INVOKER / search_path vacío / VOLATILE',
         coalesce((SELECT (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text || ' / ' || provolatile::text
                    FROM pg_proc WHERE oid = to_regprocedure('public.agenda_restablecer_configuracion(uuid, uuid)')), 'AUSENTE'),
         'true / true / v'
  UNION ALL
  SELECT 4, 'EXECUTE anon,authenticated,service_role / PUBLIC',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || ' / '
                    || EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')::text
                    FROM pg_proc p WHERE p.oid = to_regprocedure('public.agenda_restablecer_configuracion(uuid, uuid)')), 'AUSENTE'),
         'false,false,true / false'
  UNION ALL
  SELECT 5, 'policies de consultorios, intactas (nombres)',
         (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consultorios'),
         'consultorios_gates_insert,consultorios_insert,consultorios_select,consultorios_update'
  UNION ALL
  SELECT 6, 'la auditoría de consultorios sigue (audit_consultorios)',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.consultorios'::regclass AND tgname = 'audit_consultorios' AND tgenabled = 'O'),
         '1'
) t
ORDER BY t.n;
