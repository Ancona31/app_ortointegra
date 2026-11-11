-- ═══════════════════════════════════════════════════════════════════════
-- Agenda B0 — auditoría de citas: alta, edición, cancelación y borrado (AG-DT-10)
-- Rama: feature/agenda-v2 · Escrita: 2026-11-11
-- Riesgo estimado: MEDIO (disparador nuevo en la tabla más escrita de la
-- agenda; si la función falla, falla la escritura de la cita, igual que en
-- las otras siete tablas clínicas con log_tabla_change(). Decisión P10 del
-- plan del bloque B: auditoría estricta).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-11
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 5 × OK), y una
--   segunda pasada igual: misma rejilla y no-op comprobado comparando antes y
--   después pg_get_functiondef, proacl y COMMENT de la función, las
--   definiciones de los disparadores y de las 5 policies de appointments, y
--   count(*) de audit_log (sin diferencias). Anotada a mano en
--   supabase_migrations.schema_migrations (versión 20261112120000, 11
--   sentencias partidas como las parte la CLI): la CLI 2.117.0 se niega desde
--   este árbol porque la base local tiene las tres 20261014* de
--   feature/limites-ajustables, que aquí no están (ver A1.8).
--   Pruebas: supabase/pruebas-sql/b0_auditoria_citas.sql
--   (bash scripts/pruebas-sql.sh) y e2e/agenda-arrastre.e2e.ts (un arrastre
--   deja exactamente 1 cita_editada con campos [end_time, start_time]).
--   Comprobación:
--     select tgname, tgfoid::regproc, tgenabled from pg_trigger
--      where tgrelid = 'public.appointments'::regclass and not tgisinternal;
--   → audit_appointments y audit_appointments_update, log_cita_change, O.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR.
-- AUDITORÍA INDEPENDIENTE 2026-11-12: APTA (supabase/AUDITORIA-MIGRACIONES.md),
-- sin cambios en ninguna sentencia. Notas:
--   · Requiere PostgreSQL 14 o superior (CREATE OR REPLACE TRIGGER).
--     supabase/config.toml indica 17; confirmar con `select version()` en
--     producción antes de aplicar.
--   · El WHEN y la función serializan la fila dos veces (to_jsonb). Irrelevante
--     con el volumen actual.
--   · El Security Advisor de Supabase puede marcar log_cita_change como
--     «invocable por RPC»: falso positivo, una función de disparador no se
--     puede invocar (lo prueba el caso 9 de b0_auditoria_citas.sql).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- public.appointments es la única tabla clínica sin disparador de auditoría
-- (DEUDA_TECNICA.md AG-DT-10): quién movió, canceló o borró una cita no queda
-- en audit_log. CLAUDE.md: «Todo cambio en datos sensibles DEBE registrarse».
-- VA SIEMPRE ENCENDIDA: no depende del interruptor de la agenda v2.
--
-- Función propia y no log_tabla_change(): ésa escribe sólo TG_OP, y una
-- cancelación (UPDATE de status) sería indistinguible de mover la hora.
--   accion ∈ cita_alta | cita_editada | cita_cancelada | cita_reactivada | cita_eliminada
--   tabla 'appointments' · registro_id = id · user_id = auth.uid() o 'system'
--   descripcion (JSON): clinica_id, con_paciente, origen y, en UPDATE, los
--   NOMBRES de las columnas cambiadas y el estado de→a.
-- ⚠️ NUNCA VALORES (ni título, ni notas, ni horas, ni paciente_id): audit_log
-- es inmutable por trigger y no admite cancelación ARCO. status, origen y
-- clinica_id no son datos personales; con_paciente es un booleano.
--
-- Lo que NO se registra: los UPDATE que sólo tocan columnas técnicas
-- (updated_at, client_id, gcal_sync_status, gcal_etag, gcal_calendar_id,
-- google_event_id), que son los del after() de Google y de desvincularCitas.
-- Los descarta el WHEN, antes de llamar a la función (no convertir audit_log
-- en un log de red). Si un UPDATE toca una técnica Y otra que no lo es, se
-- registra, y en `campos` sólo aparecen las que no son técnicas.
-- ⚠️ ESA LISTA ESTÁ DOS VECES: en el WHEN y en c_tecnicas. Van juntas.
-- Las columnas que se añadan a appointments en el futuro quedan auditadas
-- solas (lista de EXCLUSIÓN, no de inclusión): si la nueva es técnica, hay
-- que añadirla en los dos sitios.
--
-- Caminos que cubre, porque es un disparador y no código de la app: las
-- rutas de /api/appointments, /api/consultas (cita atendida), PostgREST
-- directo, el rol de servicio (user_id = 'system') y los efectos de FK: el
-- SET NULL de pacientes y profiles llega como UPDATE (cita_editada con
-- campos = [paciente_id] o [medico_id]/[created_by]) y el CASCADE de clinicas
-- como DELETE (cita_eliminada).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Bloqueos: CREATE TRIGGER toma SHARE ROW EXCLUSIVE sobre appointments hasta
-- el COMMIT: no bloquea lecturas, sí escrituras, durante un instante. El
-- lock_timeout de 5 s existe por la cola de bloqueos: si alguien tuviera una
-- transacción larga abierta sobre la tabla, mejor fallar y repetir que dejar
-- encoladas detrás todas las escrituras de la agenda.
-- Orden respecto al código: indiferente; ningún código depende de esto.
-- Alcance de los roles: no cambia en ninguna de las dos direcciones sobre
-- appointments ni sobre audit_log (ni policies ni grants de tabla se tocan).
-- La función es SECURITY DEFINER sólo para poder insertar en audit_log, que
-- no tiene policy de INSERT (igual que log_tabla_change). Sus EXECUTE a anon,
-- authenticated y service_role son la regla de CLAUDE.md («Permisos de
-- funciones») y no abren nada: una función RETURNS trigger no se puede llamar
-- como RPC («trigger functions can only be called as triggers»), y al
-- dispararse no se comprueba EXECUTE.
-- Volumen: una fila de audit_log por alta, edición real o borrado de cita.
-- scripts/agenda-semilla.ts --volumen N dejará N filas inmutables en local.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TRIGGER IF EXISTS audit_appointments_update ON public.appointments;
--   DROP TRIGGER IF EXISTS audit_appointments ON public.appointments;
--   DROP FUNCTION IF EXISTS public.log_cita_change();
-- Las filas ya escritas en audit_log se quedan (inmutables), que es lo correcto.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_fn oid := to_regprocedure('public.log_cita_change()');
BEGIN
  IF to_regclass('public.appointments') IS NULL OR to_regclass('public.audit_log') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.appointments o public.audit_log.';
  END IF;

  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no existe auth.uid().';
  END IF;

  IF (SELECT count(*) FROM pg_attribute
       WHERE attrelid = 'public.appointments'::regclass
         AND attname IN ('id', 'clinica_id', 'status', 'paciente_id', 'origen')
         AND attnum > 0 AND NOT attisdropped) <> 5 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: a public.appointments le falta id, clinica_id, status, paciente_id u origen.';
  END IF;

  -- registro_id es uuid y descripcion es text: la función escribe esos tipos.
  IF (SELECT count(*) FROM pg_attribute
       WHERE attrelid = 'public.audit_log'::regclass AND attnum > 0 AND NOT attisdropped
         AND (attname, atttypid) IN (('user_id', 'text'::regtype), ('accion', 'text'::regtype),
                                     ('tabla', 'text'::regtype), ('registro_id', 'uuid'::regtype),
                                     ('descripcion', 'text'::regtype))) <> 5 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.audit_log no tiene la forma esperada (user_id, accion, tabla, descripcion text; registro_id uuid).';
  END IF;

  IF NOT pg_has_role(current_user,
                     (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.appointments (lo es %); CREATE TRIGGER fallaría.',
      current_user, pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass));
  END IF;

  -- Otro disparador de auditoría en appointments duplicaría cada fila.
  IF EXISTS (SELECT 1 FROM pg_trigger t
              WHERE t.tgrelid = 'public.appointments'::regclass AND NOT t.tgisinternal
                AND t.tgfoid = to_regprocedure('public.log_tabla_change()')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments ya tiene un disparador con log_tabla_change(); revisar antes.';
  END IF;

  -- En un replay, los nombres tienen que ser ESTOS disparadores.
  IF EXISTS (SELECT 1 FROM pg_trigger t
              WHERE t.tgrelid = 'public.appointments'::regclass
                AND t.tgname IN ('audit_appointments', 'audit_appointments_update')
                AND (v_fn IS NULL OR t.tgfoid <> v_fn)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: existe un audit_appointments* que no apunta a public.log_cita_change().';
  END IF;

  -- CREATE OR REPLACE no cambia el dueño ni deja pasar un cambio de tipo de
  -- retorno: si ya existe, tiene que ser la de este archivo en lo esencial.
  IF v_fn IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM pg_proc p
        WHERE p.oid = v_fn AND p.prosecdef AND p.prorettype = 'trigger'::regtype
          AND pg_has_role(current_user, p.proowner, 'USAGE')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.log_cita_change() existe y no es un trigger SECURITY DEFINER de este rol.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La función.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_cita_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  -- ⚠️ La misma lista que el WHEN de audit_appointments_update. Van juntas.
  c_tecnicas CONSTANT text[] := ARRAY['updated_at', 'client_id', 'gcal_sync_status',
                                      'gcal_etag', 'gcal_calendar_id', 'google_event_id'];
  v_fila   record;
  v_campos text[];
  v_accion text;
  v_desc   jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN v_fila := OLD; ELSE v_fila := NEW; END IF;
  v_desc := jsonb_build_object('clinica_id', v_fila.clinica_id,
                               'con_paciente', v_fila.paciente_id IS NOT NULL,
                               'origen', v_fila.origen);
  IF TG_OP = 'INSERT' THEN
    v_accion := 'cita_alta';
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'cita_eliminada';
  ELSE
    -- Sólo NOMBRES de columna: n.value se compara, nunca se escribe.
    SELECT coalesce(array_agg(n.key ORDER BY n.key), ARRAY[]::text[]) INTO v_campos
      FROM jsonb_each(to_jsonb(NEW)) AS n
     WHERE n.key <> ALL (c_tecnicas)
       AND (to_jsonb(OLD) -> n.key) IS DISTINCT FROM n.value;
    -- El WHEN ya lo garantiza; esto sólo evita una fila vacía si divergieran.
    IF cardinality(v_campos) = 0 THEN RETURN NULL; END IF;
    v_accion := CASE
      WHEN OLD.status IS DISTINCT FROM 'cancelled' AND NEW.status = 'cancelled' THEN 'cita_cancelada'
      WHEN OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN 'cita_reactivada'
      ELSE 'cita_editada'
    END;
    v_desc := v_desc || jsonb_build_object('campos', to_jsonb(v_campos));
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_desc := v_desc || jsonb_build_object('estado', jsonb_build_object('de', OLD.status, 'a', NEW.status));
    END IF;
  END IF;
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  VALUES (coalesce(auth.uid()::text, 'system'), v_accion, 'appointments', v_fila.id, v_desc::text);
  RETURN NULL;  -- AFTER ... FOR EACH ROW: el valor de retorno se ignora.
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.log_cita_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_cita_change() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.log_cita_change() IS
  'Auditoría de public.appointments (AG-DT-10). Escribe NOMBRES de columnas y estado de→a, nunca valores: audit_log es inmutable y no admite ARCO. La lista c_tecnicas está también en el WHEN de audit_appointments_update: cambiar las dos.';

-- ---------------------------------------------------------------------
-- 3 · Los disparadores.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER audit_appointments
  AFTER INSERT OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.log_cita_change();

-- ⚠️ La misma lista que c_tecnicas de log_cita_change(). Van juntas.
CREATE OR REPLACE TRIGGER audit_appointments_update
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  WHEN ((to_jsonb(OLD) - ARRAY['updated_at','client_id','gcal_sync_status','gcal_etag','gcal_calendar_id','google_event_id']::text[])
        IS DISTINCT FROM
        (to_jsonb(NEW) - ARRAY['updated_at','client_id','gcal_sync_status','gcal_etag','gcal_calendar_id','google_event_id']::text[]))
  EXECUTE FUNCTION public.log_cita_change();

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'log_cita_change: security definer / search_path' AS comprobacion,
         coalesce((SELECT p.prosecdef::text || ' / ' || coalesce(array_to_string(p.proconfig, ','), '')
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.log_cita_change()')), 'AUSENTE') AS valor,
         'true / search_path=""' AS esperado
  UNION ALL
  SELECT 2, 'disparadores audit_appointments* activos y apuntando a log_cita_change',
         (SELECT count(*)::text FROM pg_trigger t
           WHERE t.tgrelid = 'public.appointments'::regclass
             AND t.tgname IN ('audit_appointments', 'audit_appointments_update')
             AND t.tgfoid = to_regprocedure('public.log_cita_change()') AND t.tgenabled = 'O'),
         '2'
  UNION ALL
  SELECT 3, 'EXECUTE: PUBLIC / anon / authenticated / service_role',
         coalesce((SELECT (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text
                          || ' / ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.log_cita_change()')), 'AUSENTE'),
         'false / true / true / true'
  UNION ALL
  SELECT 4, 'appointments sin log_tabla_change (sin filas duplicadas)',
         (SELECT count(*)::text FROM pg_trigger t
           WHERE t.tgrelid = 'public.appointments'::regclass
             AND t.tgfoid = to_regprocedure('public.log_tabla_change()')),
         '0'
  UNION ALL
  SELECT 5, 'las 5 policies de appointments, intactas',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         '5'
) t
ORDER BY t.n;
