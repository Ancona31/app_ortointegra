-- ═══════════════════════════════════════════════════════════════════════
-- Google ↔ agenda · M5 — los empalmes con reservas por enlace, en una cola
-- persistente (AG-DT-264, alternativa A)
-- Rama: feature/agenda-para-todos · Escrita: 2026-11-25
-- Guion y repaso del autor: docs/spec/agenda-para-todos/
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: 2026-11-25, stack local de Supabase (CLI 2.117.0) con las 19
--   migraciones anteriores: aplicada, deshecha con su reversa y vuelta a
--   aplicar; prueba ap3_gcal_empalmes_pendientes.sql en verde.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR. PENDIENTE DE ENSAYO SOBRE EL CLON
--   DE ESTRUCTURA Y DE AUDITORÍA INDEPENDIENTE (supabase/AUDITORIA-MIGRACIONES.md).
--
-- EL DEFECTO: cuando la sincronización importa o mueve una cita desde Google,
--   el servidor guarda su id EN MEMORIA y al final de la página llama a
--   reserva_empalmes_registrar, que avisa a la clínica si esa cita pisa una
--   reserva por enlace. Si esa llamada falla (la base no contesta, se acaba el
--   presupuesto, la función de Vercel se corta), el id se pierde y el empalme
--   no se vuelve a detectar: la clínica no se entera.
--
-- QUÉ HACE:
--   1 · Tabla public.gcal_empalmes_pendientes (clinica_id, cita_id, creado_en):
--       el apunte «esta cita la tocó Google y falta mirar sus empalmes». Sólo
--       ids; nada clínico ni de personas. RLS activa SIN policies: ninguna
--       sesión la ve. Sin FK a appointments A PROPÓSITO: es una cola, y un
--       apunte no debe impedir borrar la cita (un evento sin paciente se
--       borra); el apunte de una cita que ya no existe se descarta al
--       procesarlo. FK a clinicas con RESTRICT, como todo.
--   2 · El apunte se escribe EN LA MISMA TRANSACCIÓN que la cita: dos
--       disparadores en appointments (alta, y cambio de inicio, fin o médico)
--       que sólo se ejecutan cuando la escritura viene de la sincronización
--       (spinus.via = 'google', que ponen gcal_aplicar_evento y la importación
--       de F2). No toca ninguna función de F2, de F4 ni de M1. Si el apunte
--       falla, WARNING, y la cita se escribe igual.
--   3 · public.reserva_empalmes_pendientes_procesar(clínica, límite): toma
--       apuntes de la clínica (SKIP LOCKED), llama con ellos a la
--       reserva_empalmes_registrar de F2 (sin cambios) y los borra, todo en una
--       transacción: si algo falla, los apuntes siguen ahí para la pasada
--       siguiente. INVOKER, sólo service_role.
--   El servidor (src/lib/gcalSincronizacion.ts) la llama al empezar cada pasada
--   y al acabar cada página, en vez de usar la lista en memoria.
--
-- ⚠️ gcal_empalme_apuntar() ES SECURITY DEFINER: la sincronización escribe con
--   service_role, que no tiene INSERT sobre la tabla (nadie de la app lo
--   tiene). Sólo inserta (NEW.clinica_id, NEW.id).
-- ⚠️ EL WHEN DE LOS DISPARADORES es lo que los hace gratis para una escritura
--   normal: current_setting('spinus.via', true) no vale 'google' y la función
--   no llega a llamarse. No le quites el WHEN ni lo cambies por una subconsulta.
-- Orden de candados: quien escribe la cita tiene tomada SU fila de appointments
--   e inserta el apunte; quien procesa toma apuntes y LEE appointments (sin
--   tomar filas). No hay ciclo. Un alta que coincide con el procesado de la
--   misma cita espera a que ese procesado termine (milisegundos).
--
-- Depende de: F2 (20261201150000): reserva_empalmes_registrar. No depende de
--   M3, MA ni M4.
-- Bloqueos: SHARE ROW EXCLUSIVE sobre public.appointments (los dos CREATE
--   TRIGGER; no bloquea lecturas, sí escrituras), en el ÚLTIMO bloque DO: de
--   ahí al COMMIT, el post-vuelo y el COMMIT.
-- Ventana de despliegue: cualquiera de los dos órdenes es seguro.
--   · Migración antes que el código: los disparadores apuntan y nadie procesa
--     (el código viejo sigue con su lista en memoria); los apuntes esperan al
--     código nuevo, que los procesa al empezar su primera pasada (registrar
--     dos veces el mismo par no lo duplica).
--   · Código antes que la migración: el código nuevo no encuentra la función
--     (PGRST202) y cae en la lista en memoria, como hoy.
-- Riesgo: MEDIO (dos disparadores en la tabla de citas).
-- No re-ejecutable: una segunda pasada ABORTA en el pre-vuelo sin cambiar nada.
-- Vuelta atrás: supabase/reversas/20261205120000_gcal_empalmes_pendientes_reversa.sql
-- Prueba: supabase/pruebas-sql/ap3_gcal_empalmes_pendientes.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.gcal_empalmes_pendientes') IS NOT NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.gcal_empalmes_pendientes ya existe: esta migración ya está aplicada. No se repite.';
  END IF;
  IF to_regprocedure('public.gcal_empalme_apuntar()') IS NOT NULL
     OR to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.appointments')
                   AND tgname IN ('trg_appointments_empalme_google_alta', 'trg_appointments_empalme_google_cambio')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: queda un resto de esta migración (función o disparador) sin su tabla. Consultar.';
  END IF;
  IF to_regprocedure('public.reserva_empalmes_registrar(uuid, uuid[])') IS NULL
     OR NOT has_function_privilege('service_role', 'public.reserva_empalmes_registrar(uuid, uuid[])', 'EXECUTE')
     OR (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.reserva_empalmes_registrar(uuid, uuid[])')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.reserva_empalmes_registrar(uuid, uuid[]) de F2 (20261201150000), INVOKER y para service_role.';
  END IF;
  -- Quien marca la vía: las funciones de F2 que escriben appointments desde Google.
  IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
         AND position('set_config(''spinus.via'', ''google'', true)' IN p.prosrc) > 0) < 2 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: no encuentro las funciones de F2 que ponen spinus.via = google antes de escribir la cita: los disparadores no se dispararían nunca.';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = to_regclass('public.appointments')), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: % no es dueño de public.appointments.', current_user;
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
         AND attname IN ('id', 'clinica_id', 'start_time', 'end_time', 'medico_id')) <> 5 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments no tiene las columnas que nombran los disparadores.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1 · La cola.
-- ---------------------------------------------------------------------
CREATE TABLE public.gcal_empalmes_pendientes (
  clinica_id uuid        NOT NULL,
  cita_id    uuid        NOT NULL,
  creado_en  timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT gcal_empalmes_pendientes_pkey PRIMARY KEY (clinica_id, cita_id),
  CONSTRAINT gcal_empalmes_pendientes_clinica_id_fkey FOREIGN KEY (clinica_id)
    REFERENCES public.clinicas(id) ON DELETE RESTRICT
);
CREATE INDEX gcal_empalmes_pendientes_orden_idx ON public.gcal_empalmes_pendientes (clinica_id, creado_en);
ALTER TABLE public.gcal_empalmes_pendientes ENABLE ROW LEVEL SECURITY;
-- Sin policies: ninguna sesión la lee ni la escribe. service_role (que salta la
-- RLS) sólo lee y borra, por la función de abajo; el alta es del disparador.
REVOKE ALL ON TABLE public.gcal_empalmes_pendientes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON TABLE public.gcal_empalmes_pendientes TO service_role;
-- FOR UPDATE SKIP LOCKED (con lo que el consumidor toma apuntes sin esperar a otra pasada) exige
-- UPDATE sobre al menos una columna: se concede sólo sobre creado_en, la que menos importa.
GRANT UPDATE (creado_en) ON TABLE public.gcal_empalmes_pendientes TO service_role;
COMMENT ON TABLE public.gcal_empalmes_pendientes IS
  'AG-DT-264 (M5): cola de citas que la sincronización con Google importó o movió y cuyos empalmes con reservas por enlace faltan por mirar. La escribe gcal_empalme_apuntar() en la misma transacción que la cita; la vacía reserva_empalmes_pendientes_procesar(). Sólo ids. Sin FK a appointments a propósito (no debe impedir borrar la cita). RLS sin policies. Un apunte con más de una hora es una señal de que la sincronización no está procesando.';

-- ---------------------------------------------------------------------
-- 2 · El apunte, en la transacción de la cita. Nunca impide escribirla.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.gcal_empalme_apuntar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.gcal_empalmes_pendientes (clinica_id, cita_id) VALUES (NEW.clinica_id, NEW.id)
    ON CONFLICT (clinica_id, cita_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'gcal_empalme_apuntar: apunte de empalme no escrito (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NULL;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.gcal_empalme_apuntar() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.gcal_empalme_apuntar() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.gcal_empalme_apuntar() IS
  'AG-DT-264 (M5): apunta en gcal_empalmes_pendientes la cita que la sincronización con Google acaba de importar o de mover. SECURITY DEFINER a propósito (service_role no tiene INSERT sobre la cola). Si falla, WARNING y la cita se escribe igual. Sólo la llaman los dos disparadores de appointments, y sólo con spinus.via = google.';

-- ---------------------------------------------------------------------
-- 3 · El consumidor. Una llamada = una transacción: o se registran los
--     empalmes y se borran los apuntes, o no pasa nada.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.reserva_empalmes_pendientes_procesar(p_clinica_id uuid, p_limite integer DEFAULT 500)
 RETURNS TABLE (r_procesados integer, r_pares integer, r_quedan boolean)
 LANGUAGE plpgsql
 VOLATILE
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  v_lim integer := least(greatest(coalesce(p_limite, 500), 1), 500);
  v_ids uuid[];
BEGIN
  IF p_clinica_id IS NULL THEN
    RAISE EXCEPTION 'reserva_empalmes_pendientes_procesar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  WITH tomados AS (
    DELETE FROM public.gcal_empalmes_pendientes p
     WHERE p.clinica_id = p_clinica_id
       AND p.cita_id IN (SELECT x.cita_id FROM public.gcal_empalmes_pendientes x
                          WHERE x.clinica_id = p_clinica_id
                          ORDER BY x.creado_en LIMIT v_lim FOR UPDATE SKIP LOCKED)
    RETURNING p.cita_id)
  SELECT coalesce(array_agg(t.cita_id), ARRAY[]::uuid[]) INTO v_ids FROM tomados t;
  r_procesados := cardinality(v_ids);
  r_pares := 0;
  IF r_procesados > 0 THEN
    r_pares := public.reserva_empalmes_registrar(p_clinica_id, v_ids);
  END IF;
  r_quedan := r_procesados >= v_lim;
  RETURN NEXT;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.reserva_empalmes_pendientes_procesar(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_empalmes_pendientes_procesar(uuid, integer) TO service_role;
COMMENT ON FUNCTION public.reserva_empalmes_pendientes_procesar(uuid, integer) IS
  'AG-DT-264 (M5): procesa hasta p_limite (1 a 500) apuntes de gcal_empalmes_pendientes de UNA clínica: llama con ellos a reserva_empalmes_registrar y los borra, en una transacción (si falla, siguen ahí). Devuelve cuántos procesó, cuántos pares nuevos y si quedan. INVOKER, sólo service_role (la sincronización con Google).';

-- ---------------------------------------------------------------------
-- 4 · Los dos disparadores de appointments, juntos y al final (dimensión 29).
-- ---------------------------------------------------------------------
DO $$
BEGIN
  CREATE TRIGGER trg_appointments_empalme_google_alta
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    WHEN (current_setting('spinus.via', true) = 'google')
    EXECUTE FUNCTION public.gcal_empalme_apuntar();
  CREATE TRIGGER trg_appointments_empalme_google_cambio
    AFTER UPDATE OF start_time, end_time, medico_id ON public.appointments
    FOR EACH ROW
    WHEN (current_setting('spinus.via', true) = 'google'
          AND (OLD.start_time, OLD.end_time, OLD.medico_id) IS DISTINCT FROM (NEW.start_time, NEW.end_time, NEW.medico_id))
    EXECUTE FUNCTION public.gcal_empalme_apuntar();
END $$;

-- ---------------------------------------------------------------------
-- 5 · Post-vuelo.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.gcal_empalmes_pendientes'::regclass)
     OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.gcal_empalmes_pendientes'::regclass) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: gcal_empalmes_pendientes no quedó con RLS activa y sin policies.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
              WHERE has_table_privilege(r, 'public.gcal_empalmes_pendientes', p))
     OR has_table_privilege('service_role', 'public.gcal_empalmes_pendientes', 'INSERT')
     OR has_table_privilege('service_role', 'public.gcal_empalmes_pendientes', 'UPDATE')
     OR has_table_privilege('service_role', 'public.gcal_empalmes_pendientes', 'TRUNCATE')
     OR NOT has_table_privilege('service_role', 'public.gcal_empalmes_pendientes', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.gcal_empalmes_pendientes', 'DELETE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: los privilegios de gcal_empalmes_pendientes no son sólo SELECT y DELETE para service_role (¿los concedió otro otorgante?).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = 'public.gcal_empalme_apuntar()'::regprocedure
                    AND p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                    AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0))
     OR NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = 'public.reserva_empalmes_pendientes_procesar(uuid, integer)'::regprocedure
                       AND NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'])
     OR has_function_privilege('anon', 'public.reserva_empalmes_pendientes_procesar(uuid, integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.reserva_empalmes_pendientes_procesar(uuid, integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.reserva_empalmes_pendientes_procesar(uuid, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: las dos funciones no quedaron como deben (DEFINER sin PUBLIC la del disparador; INVOKER sólo service_role la que procesa).';
  END IF;
  IF (SELECT count(*) FROM pg_trigger g WHERE g.tgrelid = 'public.appointments'::regclass AND NOT g.tgisinternal AND g.tgenabled = 'O'
         AND g.tgname IN ('trg_appointments_empalme_google_alta', 'trg_appointments_empalme_google_cambio')
         AND g.tgfoid = 'public.gcal_empalme_apuntar()'::regprocedure
         AND pg_get_triggerdef(g.oid) ~ 'WHEN \(.*spinus\.via') <> 2 THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: no quedaron los dos disparadores de appointments, habilitados y con su WHEN.';
  END IF;
END $$;

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'gcal_empalmes_pendientes: RLS activa / policies' AS comprobacion,
         (SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.gcal_empalmes_pendientes')) || ' / '
         || (SELECT count(*)::text FROM pg_policy WHERE polrelid = to_regclass('public.gcal_empalmes_pendientes')) AS valor,
         'true / 0' AS esperado
  UNION ALL
  SELECT 2, 'privilegios de la tabla: anon / authenticated / service_role',
         (SELECT string_agg(coalesce((SELECT string_agg(p, ',' ORDER BY p) FROM unnest(ARRAY['DELETE', 'INSERT', 'SELECT', 'TRUNCATE', 'UPDATE']) p
                                       WHERE has_table_privilege(r, 'public.gcal_empalmes_pendientes', p)), 'ninguno'), ' / ' ORDER BY o)
            FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) WITH ORDINALITY AS x(r, o)),
         'ninguno / ninguno / DELETE,SELECT'
  UNION ALL
  SELECT 3, 'gcal_empalme_apuntar: DEFINER, search_path vacío, sin PUBLIC',
         (SELECT (p.prosecdef AND p.proconfig = ARRAY['search_path=""']
                  AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0))::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.gcal_empalme_apuntar()')),
         'true'
  UNION ALL
  SELECT 4, 'reserva_empalmes_pendientes_procesar: INVOKER; quién la ejecuta (anon/authenticated/service_role)',
         (SELECT (NOT p.prosecdef)::text || ' ; ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || '/'
                 || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
            FROM pg_proc p WHERE p.oid = to_regprocedure('public.reserva_empalmes_pendientes_procesar(uuid, integer)')),
         'true ; false/false/true'
  UNION ALL
  SELECT 5, 'disparadores nuevos en appointments, habilitados y con WHEN de spinus.via',
         (SELECT count(*)::text FROM pg_trigger g WHERE g.tgrelid = to_regclass('public.appointments') AND NOT g.tgisinternal
             AND g.tgenabled = 'O' AND g.tgname IN ('trg_appointments_empalme_google_alta', 'trg_appointments_empalme_google_cambio')
             AND pg_get_triggerdef(g.oid) ~ 'WHEN \(.*spinus\.via'),
         '2'
  UNION ALL
  SELECT 6, 'reserva_empalmes_registrar de F2 (no se toca): sigue y la ejecuta service_role',
         (to_regprocedure('public.reserva_empalmes_registrar(uuid, uuid[])') IS NOT NULL
          AND has_function_privilege('service_role', 'public.reserva_empalmes_registrar(uuid, uuid[])', 'EXECUTE'))::text,
         'true'
  UNION ALL
  SELECT 7, 'apuntes en la cola (nace vacía)', (SELECT count(*)::text FROM public.gcal_empalmes_pendientes), NULL
) t
ORDER BY t.n;
