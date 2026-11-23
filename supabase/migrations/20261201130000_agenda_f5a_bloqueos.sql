-- ═══════════════════════════════════════════════════════════════════════
-- Agenda v2 · F5a — BLOQUEOS DE HORARIO (public.agenda_bloqueos)
-- ───────────────────────────────────────────────────────────────────────
-- QUÉ HACE: crea la tabla de bloqueos (un periodo que el médico cierra a
--   propósito; NO es una fila de appointments), sus índices, su RLS con
--   cuatro policies, el disparador que toma el candado 1790 del médico
--   (agenda_bloqueo_preparar) y su auditoría (log_tabla_change de main).
--   Ninguna policy ni objeto existente cambia.
-- DEPENDE DE:
--   · orden: SEGUNDO del conjunto, después de F1 y ANTES de F3 y F2:
--     reserva_ocupacion (F3) es LANGUAGE sql y nombra esta tabla al crearse,
--     y gcal_bloqueo_aplicar (F2) declara agenda_bloqueos%ROWTYPE (PL/pgSQL
--     lo resuelve al crear la función).
--   · main: clinicas, profiles, auth.uid(), get_clinica_id(),
--     soy_admin_de_clinica(), get_my_role(), clinica_no_suspendida(),
--     clinica_tiene_acceso(), perfil_completo(), log_tabla_change().
--     De clinica_no_suspendida() y clinica_tiene_acceso() exige la huella
--     (md5 del cuerpo con los fines de línea \r\n pasados a \n: en producción
--     están guardadas con \r\n y el código es el mismo).
--   · F1: agenda_ajustes y agenda_v2_encendida(uuid).
--   · PostgreSQL ≥ 13 (gen_random_uuid() del núcleo); producción es 17.6.
--   · No depende del search_path de la sesión: todo va calificado.
-- RIESGO: bajo. Tabla nueva sin datos.
--   · Bloqueos: CREATE TABLE con dos FK toma SHARE ROW EXCLUSIVE sobre
--     clinicas y profiles hasta el COMMIT (frena sus escrituras, no sus
--     lecturas). Se piden al principio con NOWAIT y reintentos (5 s): si están
--     ocupadas, la migración no hace cola —la cola frenaría a todo el que
--     llega detrás— y aborta sin cambiar nada; se reintenta más tarde. Nada
--     sobre appointments.
--   · Si falla, es UNA transacción: no queda nada.
-- SEGUNDA PASADA: re-ejecutable; no cambia nada (el pre-vuelo exige que lo que
--   ya exista tenga esta misma forma, y si no, aborta).
-- CÓMO SE DESHACE: supabase/reversas/20261201130000_agenda_f5a_bloqueos_reversa.sql,
--   después de las reversas de F5b, F4, F2 y F3, que la nombran.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_n integer;
  v_md5 text;
  v_crudo text;
BEGIN
  IF to_regclass('public.clinicas') IS NULL OR to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan public.clinicas o public.profiles (main).';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('public.get_clinica_id()') IS NULL
     OR to_regprocedure('public.soy_admin_de_clinica()') IS NULL OR to_regprocedure('public.get_my_role()') IS NULL
     OR to_regprocedure('public.perfil_completo()') IS NULL OR to_regprocedure('public.log_tabla_change()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta una de las funciones de main que usan las policies o la auditoría.';
  END IF;
  -- Las dos puertas de suscripción de appointments_gates_insert, que las policies
  -- de alta y edición repiten DENTRO de su WITH CHECK: el cuerpo de main.
  -- Huella del cuerpo con \r\n → \n (en producción están con \r\n); cualquier
  -- otro cambio, aunque sea un espacio, cambia la huella y aborta.
  SELECT md5(replace(prosrc, E'\r\n', E'\n')), md5(prosrc) INTO v_md5, v_crudo
    FROM pg_proc WHERE oid = to_regprocedure('public.clinica_no_suspendida()');
  IF v_md5 IS DISTINCT FROM 'a2dcfa8f2cfda91bc9c7a7ff7b642e1e' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: clinica_no_suspendida() falta o cambió (md5 con \r\n→\n: %, tal cual: %; se esperaba a2dcfa8f2cfda91bc9c7a7ff7b642e1e con \r\n→\n). Si sólo difiere el tal cual, son fines de línea; si difiere el otro, cambió el código: revisar antes de repetirla en las policies.', v_md5, v_crudo;
  END IF;
  SELECT md5(replace(prosrc, E'\r\n', E'\n')), md5(prosrc) INTO v_md5, v_crudo
    FROM pg_proc WHERE oid = to_regprocedure('public.clinica_tiene_acceso()');
  IF v_md5 IS DISTINCT FROM '2efd7734772dd4c7bea262e43a3779b5' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: clinica_tiene_acceso() falta o cambió (md5 con \r\n→\n: %, tal cual: %; se esperaba 2efd7734772dd4c7bea262e43a3779b5 con \r\n→\n). Si sólo difiere el tal cual, son fines de línea; si difiere el otro, cambió el código: revisar antes de repetirla en las policies.', v_md5, v_crudo;
  END IF;
  -- F1: la tabla del interruptor y la función que lo lee (INVOKER: con la RLS de la sesión).
  IF to_regclass('public.agenda_ajustes') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.agenda_ajustes (F1, 20261201120000).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.agenda_v2_encendida(uuid)')
                  AND NOT prosecdef AND prorettype = 'boolean'::regtype) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.agenda_v2_encendida(uuid) INVOKER → boolean (F1, 20261201120000).';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.agenda_v2_encendida(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: authenticated no puede ejecutar agenda_v2_encendida(uuid); las policies de alta fallarían siempre.';
  END IF;
  -- Segunda pasada: la función, si existe, es la de este archivo.
  SELECT md5(replace(prosrc, E'\r\n', E'\n')) INTO v_md5 FROM pg_proc WHERE oid = to_regprocedure('public.agenda_bloqueo_preparar()');
  IF v_md5 IS NOT NULL AND v_md5 <> 'dc778b4cbd29cedba8066caae5a7354f' THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: agenda_bloqueo_preparar() ya existe con otro cuerpo (md5 con \r\n→\n: %).', v_md5;
  END IF;
  -- Segunda pasada: la tabla, si existe, tiene exactamente estas columnas y
  -- restricciones (CREATE TABLE IF NOT EXISTS no las añadiría).
  IF to_regclass('public.agenda_bloqueos') IS NOT NULL THEN
    SELECT count(*) INTO v_n FROM pg_attribute a
     WHERE a.attrelid = to_regclass('public.agenda_bloqueos') AND a.attnum > 0 AND NOT a.attisdropped
       AND (a.attname, a.atttypid::regtype) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype),
           ('medico_id', 'uuid'::regtype), ('inicio', 'timestamptz'::regtype), ('fin', 'timestamptz'::regtype),
           ('todo_el_dia', 'boolean'::regtype), ('zona', 'text'::regtype), ('motivo', 'text'::regtype),
           ('google_event_id', 'text'::regtype), ('gcal_calendar_id', 'text'::regtype), ('gcal_etag', 'text'::regtype),
           ('created_by', 'uuid'::regtype), ('created_at', 'timestamptz'::regtype), ('updated_at', 'timestamptz'::regtype));
    IF v_n <> 14 OR (SELECT count(*) FROM pg_attribute WHERE attrelid = to_regclass('public.agenda_bloqueos')
                      AND attnum > 0 AND NOT attisdropped) <> 14 THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.agenda_bloqueos existe con otra forma.';
    END IF;
    IF (SELECT count(*) FROM pg_constraint WHERE conrelid = to_regclass('public.agenda_bloqueos') AND conname IN (
          'agenda_bloqueos_pkey', 'agenda_bloqueos_clinica_id_fkey', 'agenda_bloqueos_medico_id_fkey',
          'agenda_bloqueos_puntas_check', 'agenda_bloqueos_minuto_check', 'agenda_bloqueos_zona_check',
          'agenda_bloqueos_todo_el_dia_check', 'agenda_bloqueos_motivo_check', 'agenda_bloqueos_gcal_check')) <> 9 THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.agenda_bloqueos existe sin alguna de sus restricciones.';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · Candados, antes de pedir ninguno de otra forma: SHARE ROW EXCLUSIVE
--     sobre clinicas y profiles (los que tomarían las FK). NOWAIT: no entra
--     en la cola de candados, así que nunca frena a quien llega detrás. Si
--     no los consigue en 5 s (50 intentos cada 0,1 s), aborta sin cambiar
--     nada. Un intento fallido se deshace entero (subtransacción): no se
--     queda con la mitad de los candados.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  FOR i IN 1..50 LOOP
    BEGIN
      LOCK TABLE public.clinicas, public.profiles IN SHARE ROW EXCLUSIVE MODE NOWAIT;
      RETURN;
    EXCEPTION WHEN lock_not_available THEN
      PERFORM pg_sleep(0.1);
    END;
  END LOOP;
  RAISE EXCEPTION 'CANDADOS: clinicas o profiles siguieron ocupadas 5 s (una transacción larga las escribe). No se cambió nada: reintenta en unos minutos.'
    USING ERRCODE = '55P03';
END $$;

-- ---------------------------------------------------------------------
-- 3 · La tabla, sus índices, sus permisos y su RLS.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agenda_bloqueos (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id       uuid        NOT NULL,
  medico_id        uuid        NOT NULL,
  inicio           timestamptz NOT NULL,
  fin              timestamptz NOT NULL,
  todo_el_dia      boolean     NOT NULL DEFAULT false,
  zona             text,
  motivo           text,
  google_event_id  text,
  gcal_calendar_id text,
  gcal_etag        text,
  -- Atribución, SIN FK (como audit_log.user_id): dar de baja a quien lo creó no lo bloquea.
  created_by       uuid                 DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_bloqueos_pkey PRIMARY KEY (id),
  CONSTRAINT agenda_bloqueos_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT agenda_bloqueos_medico_id_fkey FOREIGN KEY (medico_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT agenda_bloqueos_puntas_check CHECK (fin > inicio AND fin - inicio <= interval '400 days'),
  -- Minutos enteros: la página de turnos trabaja en minutos; un fin con segundos
  -- haría ofrecer un turno que la reserva luego rechaza.
  CONSTRAINT agenda_bloqueos_minuto_check CHECK (date_trunc('minute', inicio) = inicio AND date_trunc('minute', fin) = fin),
  CONSTRAINT agenda_bloqueos_zona_check CHECK (zona IS NULL OR char_length(zona) BETWEEN 1 AND 64),
  -- Todo el día: las dos puntas son medianoches de `zona` (la regla de appointments_all_day_medianoche_check).
  CONSTRAINT agenda_bloqueos_todo_el_dia_check CHECK (NOT todo_el_dia OR (zona IS NOT NULL
    AND (inicio AT TIME ZONE zona)::time = '00:00'::time AND (fin AT TIME ZONE zona)::time = '00:00'::time)),
  CONSTRAINT agenda_bloqueos_motivo_check CHECK (motivo IS NULL OR (btrim(motivo) <> '' AND char_length(motivo) <= 120)),
  CONSTRAINT agenda_bloqueos_gcal_check CHECK (char_length(google_event_id) <= 1024 AND char_length(gcal_calendar_id) <= 1024
    AND char_length(gcal_etag) <= 300)
);

-- Un evento de Google liga como mucho un bloqueo por clínica (el sondeo busca por aquí).
CREATE UNIQUE INDEX IF NOT EXISTS agenda_bloqueos_evento_key ON public.agenda_bloqueos (clinica_id, google_event_id)
  WHERE google_event_id IS NOT NULL;
-- La agenda, la reserva y cita_proteger_bloqueo: los de un médico que acaban
-- después del inicio del rango (por `fin`, para no recorrer los pasados).
-- También sirve a la FK a clinicas.
CREATE INDEX IF NOT EXISTS agenda_bloqueos_medico_idx ON public.agenda_bloqueos (clinica_id, medico_id, fin);
-- La FK RESTRICT a profiles (dar de baja a un médico busca aquí).
CREATE INDEX IF NOT EXISTS agenda_bloqueos_medico_fk_idx ON public.agenda_bloqueos (medico_id);

ALTER TABLE public.agenda_bloqueos ENABLE ROW LEVEL SECURITY;
-- Los privilegios por omisión de Supabase dan ALL (TRUNCATE incluido) a anon,
-- authenticated y service_role: se quita todo y se da sólo lo que se usa.
-- google_event_id / gcal_* sólo los escribe el servidor (service_role).
REVOKE ALL ON TABLE public.agenda_bloqueos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON TABLE public.agenda_bloqueos TO authenticated;
GRANT INSERT (clinica_id, medico_id, inicio, fin, todo_el_dia, zona, motivo) ON TABLE public.agenda_bloqueos TO authenticated;
GRANT UPDATE (inicio, fin, todo_el_dia, zona, motivo) ON TABLE public.agenda_bloqueos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agenda_bloqueos TO service_role;

-- Quién: el MISMO predicado que appointments_select/insert/update/delete.
-- Sin recursión: ninguna policy lee agenda_bloqueos (sólo profiles y agenda_ajustes).
DROP POLICY IF EXISTS agenda_bloqueos_select ON public.agenda_bloqueos;
CREATE POLICY agenda_bloqueos_select ON public.agenda_bloqueos FOR SELECT TO authenticated
  USING ((medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
         AND clinica_id = public.get_clinica_id());
DROP POLICY IF EXISTS agenda_bloqueos_delete ON public.agenda_bloqueos;
CREATE POLICY agenda_bloqueos_delete ON public.agenda_bloqueos FOR DELETE TO authenticated
  USING ((medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
         AND clinica_id = public.get_clinica_id());
-- Alta y edición: además las puertas de appointments_gates_insert DENTRO del
-- PERMISSIVE (no se añade otra puerta RESTRICTIVE), la v2 encendida en la
-- clínica de la sesión (falla cerrado: sin fila = apagada) y, al crear, que el
-- médico sea de esa clínica.
DROP POLICY IF EXISTS agenda_bloqueos_insert ON public.agenda_bloqueos;
CREATE POLICY agenda_bloqueos_insert ON public.agenda_bloqueos FOR INSERT TO authenticated
  WITH CHECK ((medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
              AND clinica_id = public.get_clinica_id()
              AND public.clinica_no_suspendida() AND public.clinica_tiene_acceso() AND public.perfil_completo()
              AND public.agenda_v2_encendida(public.get_clinica_id())
              AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = agenda_bloqueos.medico_id AND p.clinica_id = public.get_clinica_id()));
DROP POLICY IF EXISTS agenda_bloqueos_update ON public.agenda_bloqueos;
CREATE POLICY agenda_bloqueos_update ON public.agenda_bloqueos FOR UPDATE TO authenticated
  USING ((medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
         AND clinica_id = public.get_clinica_id())
  WITH CHECK ((medico_id = auth.uid() OR public.soy_admin_de_clinica() OR public.get_my_role() = 'secretaria')
              AND clinica_id = public.get_clinica_id()
              AND public.clinica_no_suspendida() AND public.clinica_tiene_acceso() AND public.perfil_completo()
              AND public.agenda_v2_encendida(public.get_clinica_id()));

COMMENT ON TABLE public.agenda_bloqueos IS
  'Un periodo que el médico cierra a propósito (horas o días completos, motivo opcional). NO es una cita ni un evento. En el enlace de reserva no se ofrecen turnos que lo toquen (reserva_ocupacion) y reservar_por_enlace lo rechaza (''ocupado''); dentro de Spinus, con la v2 encendida, ninguna cita ni evento entra ni se mueve a él (cita_proteger_bloqueo, HINT agenda_horario_bloqueado). Lo crean, editan y quitan quienes pueden agendar para ese médico (mismo predicado que appointments). google_event_id/gcal_*: el evento «Ocupado» del calendario de Spinus, sólo los escribe el servidor; gcal_bloqueo_aplicar trae lo movido o borrado en Google. agenda_bloqueo_preparar toma el candado 1790 del médico.';

-- ---------------------------------------------------------------------
-- 4 · Antes de escribir: el candado del médico y updated_at.
--     INVOKER: no decide nada, sólo serializa; no necesita más permisos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agenda_bloqueo_preparar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  -- El candado de reservar_por_enlace (1790 + médico): un bloqueo y una
  -- reserva del mismo médico a la vez no se cruzan (ver tras la función).
  -- Si cambia de médico, los dos candados en orden fijo (sin abrazo mortal).
  IF TG_OP = 'UPDATE' AND OLD.medico_id IS DISTINCT FROM NEW.medico_id THEN
    PERFORM pg_advisory_xact_lock(1790, least(hashtext(OLD.medico_id::text), hashtext(NEW.medico_id::text)));
    PERFORM pg_advisory_xact_lock(1790, greatest(hashtext(OLD.medico_id::text), hashtext(NEW.medico_id::text)));
  ELSE
    PERFORM pg_advisory_xact_lock(1790, hashtext(NEW.medico_id::text));
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.updated_at := now();
  ELSIF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    -- gcal_bloqueo_aplicar pone a propósito la hora del cambio de Google; lo demás, now().
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END
$fn$;
-- El candado 1790 es un contrato entre bloques: la MISMA clave
-- pg_advisory_xact_lock(1790, hashtext(medico_id::text)) en reservar_por_enlace
-- (F3) y gcal_bloqueo_aplicar (F2). Si un bloqueo entra antes, la reserva (READ
-- COMMITTED, sentencia nueva tras el candado) lo ve y sale 'ocupado'; si la
-- reserva entra antes, el bloqueo espera y queda encima de la cita (no la
-- cancela). No reutilices 1790 para otra cosa.
REVOKE EXECUTE ON FUNCTION public.agenda_bloqueo_preparar() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.agenda_bloqueo_preparar() TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_agenda_bloqueos_preparar ON public.agenda_bloqueos;
CREATE TRIGGER trg_agenda_bloqueos_preparar BEFORE INSERT OR UPDATE ON public.agenda_bloqueos
  FOR EACH ROW EXECUTE FUNCTION public.agenda_bloqueo_preparar();
DROP TRIGGER IF EXISTS audit_agenda_bloqueos ON public.agenda_bloqueos;
CREATE TRIGGER audit_agenda_bloqueos AFTER INSERT OR DELETE OR UPDATE ON public.agenda_bloqueos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

-- ---------------------------------------------------------------------
-- 5 · Post-vuelo. Si algo no quedó como se quiere, se deshace TODO.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_t regclass := 'public.agenda_bloqueos'::regclass;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = v_t) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: agenda_bloqueos sin RLS.';
  END IF;
  IF (SELECT string_agg(policyname || ':' || cmd || ':' || permissive, ',' ORDER BY policyname)
        FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agenda_bloqueos')
     IS DISTINCT FROM 'agenda_bloqueos_delete:DELETE:PERMISSIVE,agenda_bloqueos_insert:INSERT:PERMISSIVE,agenda_bloqueos_select:SELECT:PERMISSIVE,agenda_bloqueos_update:UPDATE:PERMISSIVE' THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: las policies de agenda_bloqueos no son las cuatro permisivas esperadas.';
  END IF;
  -- anon nada; nadie TRUNCATE; authenticated sin INSERT/UPDATE de tabla (sólo por columnas).
  IF has_table_privilege('anon', v_t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_table_privilege('authenticated', v_t, 'TRUNCATE') OR has_table_privilege('service_role', v_t, 'TRUNCATE')
     OR has_table_privilege('authenticated', v_t, 'INSERT') OR has_table_privilege('authenticated', v_t, 'UPDATE')
     OR has_table_privilege('authenticated', v_t, 'REFERENCES,TRIGGER') OR has_table_privilege('service_role', v_t, 'REFERENCES,TRIGGER')
     OR has_column_privilege('authenticated', v_t, 'google_event_id', 'INSERT,UPDATE')
     OR has_column_privilege('authenticated', v_t, 'medico_id', 'UPDATE')
     OR has_column_privilege('authenticated', v_t, 'clinica_id', 'UPDATE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: algún rol tiene de más sobre agenda_bloqueos.';
  END IF;
  IF NOT (has_table_privilege('authenticated', v_t, 'SELECT') AND has_table_privilege('authenticated', v_t, 'DELETE')
          AND has_column_privilege('authenticated', v_t, 'inicio', 'INSERT') AND has_column_privilege('authenticated', v_t, 'motivo', 'UPDATE')
          AND has_table_privilege('service_role', v_t, 'SELECT') AND has_table_privilege('service_role', v_t, 'INSERT')
          AND has_table_privilege('service_role', v_t, 'UPDATE') AND has_table_privilege('service_role', v_t, 'DELETE')) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: falta algún permiso que la app usa sobre agenda_bloqueos.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) x
              WHERE p.oid = 'public.agenda_bloqueo_preparar()'::regprocedure AND x.grantee = 0) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: PUBLIC puede ejecutar agenda_bloqueo_preparar().';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid = v_t AND NOT tgisinternal AND tgenabled = 'O'
        AND tgname IN ('trg_agenda_bloqueos_preparar', 'audit_agenda_bloqueos')) <> 2 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: faltan los disparadores de agenda_bloqueos.';
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- 6 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'agenda_bloqueos: columnas / restricciones con nombre / índices' AS comprobacion,
         coalesce((SELECT (SELECT count(*) FROM pg_attribute WHERE attrelid = c.oid AND attnum > 0 AND NOT attisdropped)::text
                          || ' / ' || (SELECT count(*) FROM pg_constraint WHERE conrelid = c.oid)::text
                          || ' / ' || (SELECT count(*) FROM pg_index WHERE indrelid = c.oid)::text
                     FROM pg_class c WHERE c.oid = to_regclass('public.agenda_bloqueos')), 'AUSENTE') AS valor,
         '14 / 9 / 4' AS esperado
  UNION ALL
  SELECT 2, 'RLS activada / policies',
         coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.agenda_bloqueos')), 'AUSENTE') || ' / '
           || coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
                         WHERE schemaname = 'public' AND tablename = 'agenda_bloqueos'), ''),
         'true / agenda_bloqueos_delete,agenda_bloqueos_insert,agenda_bloqueos_select,agenda_bloqueos_update'
  UNION ALL
  SELECT 3, 'ACL de la tabla',
         coalesce((SELECT array_to_string(relacl, ',') FROM pg_class WHERE oid = to_regclass('public.agenda_bloqueos')), 'AUSENTE'),
         'postgres=arwdDxtm/postgres,authenticated=rd/postgres,service_role=arwd/postgres'
  UNION ALL
  SELECT 4, 'TRUNCATE de anon / authenticated / service_role',
         coalesce((SELECT has_table_privilege('anon', oid, 'TRUNCATE')::text || ',' || has_table_privilege('authenticated', oid, 'TRUNCATE')::text
                          || ',' || has_table_privilege('service_role', oid, 'TRUNCATE')::text
                     FROM pg_class WHERE oid = to_regclass('public.agenda_bloqueos')), 'AUSENTE'),
         'false,false,false'
  UNION ALL
  SELECT 5, 'agenda_bloqueo_preparar: md5 (\r\n→\n) / INVOKER / search_path vacío / sin PUBLIC',
         coalesce((SELECT md5(replace(prosrc, E'\r\n', E'\n')) || ' / ' || (NOT prosecdef)::text || ' / ' || (proconfig @> ARRAY['search_path=""'])::text
                          || ' / ' || (NOT EXISTS (SELECT 1 FROM aclexplode(proacl) x WHERE x.grantee = 0))::text
                     FROM pg_proc WHERE oid = to_regprocedure('public.agenda_bloqueo_preparar()')), 'AUSENTE'),
         'dc778b4cbd29cedba8066caae5a7354f / true / true / true'
  UNION ALL
  SELECT 6, 'disparadores de agenda_bloqueos, activos',
         coalesce((SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_trigger
                    WHERE tgrelid = to_regclass('public.agenda_bloqueos') AND NOT tgisinternal AND tgenabled = 'O'), ''),
         'audit_agenda_bloqueos,trg_agenda_bloqueos_preparar'
) t
ORDER BY t.n;
