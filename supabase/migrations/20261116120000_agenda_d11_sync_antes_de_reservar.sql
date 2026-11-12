-- ═══════════════════════════════════════════════════════════════════════
-- Agenda D11 — sincronizar con Google ANTES de reservar por enlace:
-- frescura de la última sincronización buena y avisos de empalme con
-- reservas por enlace
-- Rama: feature/agenda-v2-dsync · Escrita: 2026-11-16
-- Riesgo estimado: BAJO (una tabla nueva sin datos previos, una función de
-- lectura y una que inserta en esa tabla y en audit_log; ninguna toca
-- appointments ni gcal_sync_estado, ni cambia una policy existente).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-16
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 6 × OK) y una
--   segunda pasada: misma rejilla (sólo los NOTICE de «ya existe»). Antes,
--   en seco con ROLLBACK. Anotada a mano en
--   supabase_migrations.schema_migrations (versión 20261116120000).
--   Pruebas: supabase/pruebas-sql/d11_sync_antes_de_reservar.sql
--   (bash scripts/pruebas-sql.sh).
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B1, C1, C2 y D1).
-- REVISIÓN INDEPENDIENTE DEL DIFF (otro modelo) 2026-11-16: APTA CON CAMBIOS,
--   aplicados: un solo par por solape entre dos reservas (antes, uno por cada
--   dirección: doble aviso y doble auditoría); pre-vuelo de la tabla por
--   nombres y tipos (antes sólo contaba columnas); pruebas del tope de 500 y
--   del par reserva-reserva. No aplicado: comprobar el dueño de objetos
--   previos (Postgres ya rechaza reemplazar uno ajeno).
-- AUDITORÍA INDEPENDIENTE: pendiente (supabase/AUDITORIA-MIGRACIONES.md).
--   ↑ Superado: AUDITORÍA INDEPENDIENTE 2026-11-12 (cierre del proyecto):
--   APTA CON CAMBIOS (supabase/AUDITORIA-MIGRACIONES.md, las 18
--   dimensiones; detalle en supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md §2).
--   Aplicado en este archivo (no estaba en producción; en local se volvió a
--   aplicar con el reinicio desde cero del conjunto):
--   · Hallazgo 1: el desempate «id menor» de dos reservas empalmadas perdía
--     el par cuando la de id menor no podía hacer de reserva (attended, o
--     ya terminada) y la otra sí: ahora el orden canónico sólo rige entre
--     dos reservas que las dos podrían serlo. Prueba: caso 5-ter.
--   · Hallazgo 4: el pre-vuelo exige agenda_ajustes.agenda_v2_encendida
--     boolean y SELECT de service_role en agenda_ajustes.
--   · Hallazgo 5: fila 7 de la rejilla, el UNIQUE del par del que depende el
--     ON CONFLICT ON CONSTRAINT.
--   · Hallazgo 6: COMMENT de la tabla (el orden canónico de un par
--     reserva-reserva) y de gcal_sync_frescura (también ultima_ok NULL).
--   NO aplicado, para Angel: (2) un par que vuelve a empalmarse pasados los
--   30 días del panel no reaparece (UNIQUE + DO NOTHING; cambiarlo rompe
--   «nadie UPDATE»); (3) con mucho historial, el OR de la consulta de pares
--   recorre todas las citas de la clínica (opcional: partirla en dos ramas
--   con UNION); comprobar dueños de objetos previos (Postgres ya lo rechaza).
--   Texto inexacto, se deja como constancia: «Escrita / APLICADA 2026-11-16»
--   de arriba y de la cabecera son fechas adelantadas (el commit bee670e es
--   del 2026-11-12); el nombre del archivo no se cambia (es su versión).
--   «Bloqueos de catálogo» del renglón de aplicación: la FK toma además
--   SHARE ROW EXCLUSIVE sobre clinicas hasta el COMMIT (bloquea escrituras
--   en clinicas, no lecturas), con el lock_timeout de 5 s.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Decisión de Angel (mejora_agendaV2.md §6-bis, «Bloque D — sincronización
-- con Google antes de reservar»): el enlace de reserva no depende de la
-- tarea programada para conocer lo que hay en Google. Las rutas públicas
-- sincronizan antes de calcular la ocupación (GET de turnos, si la última
-- buena tiene más de 60 s) y antes de la RPC de reserva (siempre). Si
-- Google falla, se reserva sólo si la última sincronización buena tiene
-- menos de 30 minutos. Para eso el código tiene que LEER `ultima_ok` y
-- saber si otra pasada tiene el candado: `gcal_sync_estado` sólo se toca
-- por las funciones `gcal_sync_*` (su COMMENT, C1), así que se añade una
-- función de lectura en vez de un SELECT directo con el cliente de servicio.
-- Y si una sincronización posterior importa o mueve en Google algo que se
-- empalma con una cita reservada por enlace, se avisa a la clínica (canal
-- de E8: el panel «Por confirmar») y se audita. Para no repetir el aviso en
-- cada resincronización hace falta recordar qué pares ya se avisaron: una
-- tabla con UNIQUE (reserva, cita empalmada).
--
-- ═══ QUÉ CREA ══════════════════════════════════════════════════════════
-- 1. gcal_sync_frescura(p_clinica_id) → (r_ultima_ok, r_ocupada). STABLE,
--    INVOKER, sólo service_role. Cero filas si la clínica nunca sincronizó.
-- 2. reserva_empalmes_google: un par (cita reservada por enlace, cita que se
--    le empalma) por fila. RLS: la sesión ve los de su clínica cuya reserva
--    puede ver (la RLS de appointments decide; el invitado, las suyas).
--    authenticated sólo SELECT; service_role SELECT e INSERT; nadie UPDATE
--    ni DELETE (es un registro). FK a clinicas RESTRICT. SIN FK a
--    appointments, a propósito: la cita la borra quien puede (B3 la deja
--    borrar sin paciente, y la siembra de las e2e), y una FK RESTRICT a la
--    tabla más grande bloquearía esos borrados en una base compartida; la
--    lectura cruza con appointments y descarta lo que ya no existe.
-- 3. reserva_empalmes_registrar(p_clinica_id, p_citas) → integer (pares
--    NUEVOS). VOLATILE, INVOKER, sólo service_role. Recibe las citas que la
--    sincronización acaba de importar o de mover; busca, en ESA clínica y
--    con el MISMO médico, los pares en los que una es una reserva por
--    enlace activa (scheduled/confirmed, con hora, futura) y la otra ocupa
--    (las reglas de reserva_ocupacion, D3: ni cancelled, ni no_show, ni todo
--    el día) y se solapan; inserta los pares con ON CONFLICT DO NOTHING y,
--    EN LA MISMA SENTENCIA, una fila de audit_log por par nuevo
--    ('reserva_empalme_google', user_id 'system', sólo ids). Si la
--    auditoría falla, falla todo (P10). Interruptor apagado → 0.
--    Dos reservas por enlace que se empalman ENTRE SÍ dan un solo par (la de
--    id menor como «reserva»), no uno por cada dirección: un solo aviso y una
--    sola fila de auditoría por solape (hallazgo del revisor).
--    Resto conocido: un par cuya cita se borra después queda en la tabla
--    (sin FK a appointments, sin purga); la lectura lo descarta. Es un
--    registro, como audit_log.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B1, C1 y D1. PG ≥ 14. Tabla nueva vacía: bloqueos de catálogo.
-- Orden respecto al código: cualquiera. Sin estas funciones el código las
--   trata como ausentes (PGRST202) y se comporta como hoy.
-- Alcance de los roles: authenticated gana SELECT sobre la tabla nueva
--   (bajo RLS); service_role gana EXECUTE de dos funciones y SELECT/INSERT
--   sobre la tabla. Nadie pierde nada. appointments y gcal_sync_estado: sin
--   cambio de permisos ni de policies.
-- Contrato con spinus-consola: ninguna columna existente cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP FUNCTION IF EXISTS public.reserva_empalmes_registrar(uuid, uuid[]);
--   DROP FUNCTION IF EXISTS public.gcal_sync_frescura(uuid);
--   DROP TABLE IF EXISTS public.reserva_empalmes_google;   -- (sin CASCADE)
--   Las filas de audit_log se quedan (son hechos).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.gcal_sync_estado') IS NULL OR to_regclass('public.agenda_ajustes') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta gcal_sync_estado (C1) o agenda_ajustes (B1).';
  END IF;
  -- Auditoría 2026-11-12 (hallazgo 4): el cuerpo plpgsql no se valida al crearse.
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass AND NOT attisdropped
                   AND attname = 'agenda_v2_encendida' AND atttypid = 'bool'::regtype)
     OR NOT has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: agenda_ajustes sin agenda_v2_encendida boolean (B1) o sin SELECT de service_role.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.gcal_sync_estado'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('clinica_id', 'uuid'::regtype), ('ultima_ok', 'timestamptz'::regtype),
              ('candado', 'uuid'::regtype), ('candado_hasta', 'timestamptz'::regtype))) <> 4 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: gcal_sync_estado no tiene clinica_id, ultima_ok, candado y candado_hasta.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND (attname, atttypid) IN (('clinica_id', 'uuid'::regtype), ('medico_id', 'uuid'::regtype),
              ('reserva_canal', 'text'::regtype), ('status', 'text'::regtype), ('all_day', 'bool'::regtype),
              ('start_time', 'timestamptz'::regtype), ('end_time', 'timestamptz'::regtype))) <> 7 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: appointments no tiene las columnas esperadas (D1).';
  END IF;
  IF to_regprocedure('public.get_clinica_id()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.get_clinica_id().';
  END IF;
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no tiene BYPASSRLS; las funciones invoker no verían las filas.';
  END IF;
  IF NOT (has_table_privilege('service_role', 'public.gcal_sync_estado', 'SELECT')
          AND has_table_privilege('service_role', 'public.appointments', 'SELECT')
          AND has_table_privilege('service_role', 'public.audit_log', 'INSERT')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role sin SELECT en gcal_sync_estado/appointments o sin INSERT en audit_log.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
               AND p.proname IN ('gcal_sync_frescura', 'reserva_empalmes_registrar')
               AND (p.prosecdef OR p.oid NOT IN (coalesce(to_regprocedure('public.gcal_sync_frescura(uuid)'), 0),
                                                 coalesce(to_regprocedure('public.reserva_empalmes_registrar(uuid, uuid[])'), 0)))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una de las funciones existe como SECURITY DEFINER o con otra firma.';
  END IF;
  IF to_regclass('public.reserva_empalmes_google') IS NOT NULL
     AND ((SELECT count(*) FROM pg_attribute WHERE attrelid = to_regclass('public.reserva_empalmes_google')
            AND attnum > 0 AND NOT attisdropped) <> 5
          OR (SELECT count(*) FROM pg_attribute WHERE attrelid = to_regclass('public.reserva_empalmes_google')
                AND attnum > 0 AND NOT attisdropped
                AND (attname, atttypid) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype),
                      ('cita_reserva_id', 'uuid'::regtype), ('cita_otra_id', 'uuid'::regtype),
                      ('detectado_en', 'timestamptz'::regtype))) <> 5) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: reserva_empalmes_google existe con otra forma.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La tabla de avisos, sus permisos y su RLS.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reserva_empalmes_google (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id       uuid        NOT NULL,
  cita_reserva_id  uuid        NOT NULL,
  cita_otra_id     uuid        NOT NULL,
  detectado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_empalmes_google_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_empalmes_google_par_key UNIQUE (cita_reserva_id, cita_otra_id),
  CONSTRAINT reserva_empalmes_google_clinica_id_fkey FOREIGN KEY (clinica_id)
    REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT reserva_empalmes_google_distintas CHECK (cita_reserva_id <> cita_otra_id)
);

CREATE INDEX IF NOT EXISTS reserva_empalmes_google_clinica_idx
  ON public.reserva_empalmes_google (clinica_id, detectado_en DESC);

ALTER TABLE public.reserva_empalmes_google ENABLE ROW LEVEL SECURITY;
-- Los privilegios por omisión de Supabase dan ALL a anon, authenticated y service_role.
REVOKE ALL ON TABLE public.reserva_empalmes_google FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.reserva_empalmes_google TO authenticated;
GRANT SELECT, INSERT ON TABLE public.reserva_empalmes_google TO service_role;

DROP POLICY IF EXISTS reserva_empalmes_google_select ON public.reserva_empalmes_google;
CREATE POLICY reserva_empalmes_google_select ON public.reserva_empalmes_google FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = reserva_empalmes_google.cita_reserva_id AND a.clinica_id = public.get_clinica_id()));

COMMENT ON TABLE public.reserva_empalmes_google IS
  'D11: pares (cita reservada por enlace, cita que se le empalma) detectados por la sincronización con Google al importar o mover una cita. UNIQUE por par: una resincronización no repite el aviso. Sólo lo escribe reserva_empalmes_registrar (service_role), que audita cada par nuevo. Sin FK a appointments a propósito (ver la migración 20261116120000); el lector cruza con appointments. cita_otra_id puede ser también una reserva por enlace: entre dos reservas activas, cita_reserva_id es la de id menor; si sólo una está activa (scheduled/confirmed y sin terminar), es ésa.';

-- ---------------------------------------------------------------------
-- 3 · Las funciones. INVOKER, search_path vacío, sólo service_role.
-- ---------------------------------------------------------------------

-- La última sincronización buena de ESTA clínica y si alguien tiene el
-- candado ahora. Cero filas = nunca se tomó el candado.
CREATE OR REPLACE FUNCTION public.gcal_sync_frescura(p_clinica_id uuid)
RETURNS TABLE (r_ultima_ok timestamptz, r_ocupada boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT e.ultima_ok, coalesce(e.candado_hasta > now(), false)
    FROM public.gcal_sync_estado e
   WHERE e.clinica_id = p_clinica_id;
$fn$;

-- Pares nuevos (reserva por enlace, cita empalmada) en los que participa
-- alguna de p_citas, de ESTA clínica y del mismo médico. Audita cada uno.
CREATE OR REPLACE FUNCTION public.reserva_empalmes_registrar(p_clinica_id uuid, p_citas uuid[])
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_n integer;
BEGIN
  IF p_clinica_id IS NULL OR p_citas IS NULL OR cardinality(p_citas) > 500
     OR EXISTS (SELECT 1 FROM unnest(p_citas) c WHERE c IS NULL) THEN
    RAISE EXCEPTION 'reserva_empalmes_registrar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_citas) = 0
     OR NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida) THEN
    RETURN 0;
  END IF;

  WITH pares AS (
    SELECT r.clinica_id, r.id AS reserva, o.id AS otra
      FROM public.appointments r
      JOIN public.appointments o
        ON o.clinica_id = r.clinica_id AND o.medico_id = r.medico_id AND o.id <> r.id
     WHERE r.clinica_id = p_clinica_id
       AND r.reserva_canal IS NOT NULL AND r.status IN ('scheduled', 'confirmed')
       AND NOT r.all_day AND r.end_time > now()
       AND o.status NOT IN ('cancelled', 'no_show') AND NOT o.all_day
       AND o.start_time < r.end_time AND o.end_time > r.start_time
       AND (r.id = ANY (p_citas) OR o.id = ANY (p_citas))
       -- Reserva contra reserva: un solo par por solape, en orden canónico,
       -- SÓLO si la otra también podría hacer de reserva (activa y sin
       -- terminar); si no, este r es el único representante posible
       -- (auditoría 2026-11-12, hallazgo 1).
       AND (o.reserva_canal IS NULL OR r.id < o.id
            OR o.status NOT IN ('scheduled', 'confirmed') OR o.end_time <= now())
  ), nuevos AS (
    INSERT INTO public.reserva_empalmes_google (clinica_id, cita_reserva_id, cita_otra_id)
    SELECT p.clinica_id, p.reserva, p.otra FROM pares p
    ON CONFLICT ON CONSTRAINT reserva_empalmes_google_par_key DO NOTHING
    RETURNING cita_reserva_id, cita_otra_id
  )
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  SELECT 'system', 'reserva_empalme_google', 'appointments', n.cita_reserva_id,
         jsonb_build_object('clinica_id', p_clinica_id, 'cita_empalmada', n.cita_otra_id, 'via', 'sondeo')::text
    FROM nuevos n;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;

-- Permisos de funciones (CLAUDE.md): SOLO service_role. La consola y las
-- sesiones no deben leer el estado de sincronización de una clínica ni
-- escribir avisos; por eso el revoke incluye anon y authenticated.
REVOKE EXECUTE ON FUNCTION public.gcal_sync_frescura(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_frescura(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reserva_empalmes_registrar(uuid, uuid[]) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_empalmes_registrar(uuid, uuid[]) TO service_role;

COMMENT ON FUNCTION public.gcal_sync_frescura(uuid) IS
  'D11: ultima_ok y si el candado de sincronización de la clínica está tomado ahora. Sólo lectura, sólo service_role. Cero filas si nunca se tomó el candado; ultima_ok NULL si se tomó y ninguna pasada terminó bien.';
COMMENT ON FUNCTION public.reserva_empalmes_registrar(uuid, uuid[]) IS
  'D11: registra (sin repetir) los pares reserva por enlace / cita empalmada del mismo médico en los que participa alguna de p_citas (recién importadas o movidas desde Google) y audita cada par nuevo en la misma sentencia. Devuelve los pares nuevos. Sólo service_role; interruptor apagado = 0.';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'reserva_empalmes_google existe / RLS activa' AS comprobacion,
         coalesce((SELECT 'sí / ' || relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.reserva_empalmes_google')), 'AUSENTE') AS valor,
         'sí / true' AS esperado
  UNION ALL
  SELECT 2, 'privilegios anon / authenticated / service_role',
         coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'reserva_empalmes_google' AND grantee = 'anon'), '-')
         || ' / ' || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'reserva_empalmes_google' AND grantee = 'authenticated'), '-')
         || ' / ' || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'reserva_empalmes_google' AND grantee = 'service_role'), '-'),
         '- / SELECT / INSERT,SELECT'
  UNION ALL
  SELECT 3, 'policies (sólo la de SELECT)',
         (SELECT string_agg(policyname || ':' || cmd, ',') FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reserva_empalmes_google'),
         'reserva_empalmes_google_select:SELECT'
  UNION ALL
  SELECT 4, 'FK a clinicas es RESTRICT',
         coalesce((SELECT confdeltype::text FROM pg_constraint WHERE conrelid = to_regclass('public.reserva_empalmes_google')
                    AND conname = 'reserva_empalmes_google_clinica_id_fkey'), 'AUSENTE'), 'r'
  UNION ALL
  SELECT 5, 'funciones INVOKER con search_path vacío (de 2)',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.gcal_sync_frescura(uuid)'), to_regprocedure('public.reserva_empalmes_registrar(uuid, uuid[])'))
             AND NOT p.prosecdef AND p.proconfig @> ARRAY['search_path=""']), '2'
  UNION ALL
  SELECT 6, 'EXECUTE sólo service_role (de 2)',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.gcal_sync_frescura(uuid)'), to_regprocedure('public.reserva_empalmes_registrar(uuid, uuid[])'))
             AND has_function_privilege('service_role', p.oid, 'EXECUTE')
             AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
             AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
             AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')), '2'
  UNION ALL
  SELECT 7, 'UNIQUE del par (lo usa ON CONFLICT ON CONSTRAINT)',
         coalesce((SELECT pg_get_constraintdef(oid) FROM pg_constraint
                    WHERE conrelid = to_regclass('public.reserva_empalmes_google')
                      AND conname = 'reserva_empalmes_google_par_key'), 'AUSENTE'),
         'UNIQUE (cita_reserva_id, cita_otra_id)'
) t
ORDER BY t.n;
