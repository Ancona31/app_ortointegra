-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda J, agente J4 (punto 10 de Angel) — aviso en la campana
-- cuando alguien mueve en Google una cita reservada por enlace
-- Rama: feature/agenda-v2-j4 · Escrita: 2026-11-18
-- Riesgo estimado: BAJO (una tabla nueva con RLS y sin filas, una función
-- RPC sólo de service_role, un disparador AFTER INSERT sobre la tabla nueva,
-- y la CHECK de tipos de avisos_clinica ampliada con un valor. Ninguna policy,
-- columna ni fila existente cambia).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: ver «APLICACIÓN LOCAL» al pie de esta cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de I2, 20261121121000,
--   e I5, 20261121150000; con el conjunto de la agenda v2).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 10 de Angel (tanda J), literal: «En ese mismo caso [alguien mueve en
-- Google una cita futura reservada por enlace], crea un aviso en la campana:
-- "Desde Google no se pueden mover las citas reservadas por enlace. Para
-- cambiarla, usa Reagendar: se le avisará al paciente." Al pulsarlo abre la
-- tarjeta de esa cita con "Reagendar" destacado. Un aviso por intento, no uno
-- por cada sincronización.»
-- Desde I2 la base rechaza ese cambio (cita_proteger_eleccion, 42501), la
-- pasada de sincronización lo audita como 'gcal_cambio_rechazado' (motivo
-- 'eleccion_paciente') y Spinus vuelve a escribir su hora en Google (C5).
-- Nadie de la clínica se enteraba: el 42501 deshace la transacción de
-- gcal_aplicar_evento entera, así que un disparador sobre appointments no
-- puede dejar nada. Lo escribe la pasada, por una RPC aparte, DESPUÉS del
-- rechazo (el mismo camino que la auditoría 'gcal_cambio_rechazado').
--
-- ═══ «UN AVISO POR INTENTO» ════════════════════════════════════════════
-- Intento = una VERSIÓN del evento de Google rechazada: (cita, `updated` del
-- evento). Dos sondeos que leen el mismo cambio (p. ej. la página se repite
-- porque Google no respondió al restablecer) traen el mismo `updated`: un
-- solo intento. Mover el evento otra vez (aunque sea a la misma hora) es una
-- versión nueva: otro intento. El restablecimiento de Spinus también cambia
-- `updated`, pero esa versión es el eco de Spinus y no se rechaza.
-- La deduplicación es de la BASE y atómica: UNIQUE (cita_id, google_updated)
-- en gcal_movimientos_rechazados + ON CONFLICT DO NOTHING.
-- Con avisos_clinica sólo cabe UN aviso sin revisar por (tipo, cita) (índice
-- único parcial de I5): un intento nuevo con el aviso anterior aún sin
-- revisar lo vuelve a poner arriba (creado_en = now()) en vez de añadir una
-- segunda línea igual para la misma cita; revisado el anterior, nace otro.
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- public.gcal_movimientos_rechazados (TABLA NUEVA): un renglón por intento.
--   clinica_id (FK RESTRICT a clinicas), cita_id (SIN FK a appointments, a
--   propósito y como reserva_empalmes_google y avisos_clinica: la semilla y
--   las e2e borran citas como postgres y una FK RESTRICT bloquearía esos
--   borrados), google_updated, detectado_en. Nada clínico: ni hora nueva, ni
--   título, ni texto de Google. RLS activa SIN policies; sólo service_role
--   (que se salta la RLS) puede SELECT/INSERT. authenticated y anon, nada.
-- public.cita_movimiento_google_registrar(p_clinica_id, p_cita_id,
--   p_google_updated) → boolean (true = intento nuevo). INVOKER, search_path
--   vacío, SÓLO service_role (la llama src/lib/gcalSincronizacionBase.ts con
--   createAdminClient(), con el clinica_id de la conexión). Filtra por
--   p_clinica_id en cada sentencia. Sólo registra si la v2 está encendida y la
--   cita es de ESA clínica, por enlace (reserva_canal) y no ha empezado: el
--   mismo criterio de cita_proteger_eleccion (I2).
-- public.aviso_clinica_de_movimiento_google() — disparador AFTER INSERT sobre
--   la tabla nueva, SECURITY DEFINER (dueño postgres), como los escritores de
--   I5: inserta (o vuelve a subir) el aviso 'google_movimiento_rechazado'.
-- avisos_clinica_tipo_check: + 'google_movimiento_rechazado'. DROP + ADD de la
--   CHECK: la nueva es más amplia, todas las filas existentes la cumplen.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B1 (agenda_ajustes), D1 (reserva_canal) e I5 (avisos_clinica).
-- Bloqueos (lock_timeout 5 s): ALTER TABLE avisos_clinica DROP/ADD CONSTRAINT
--   → ACCESS EXCLUSIVE un instante y un recorrido de la tabla para validar la
--   CHECK (pocas filas); CREATE TABLE con FK → SHARE ROW EXCLUSIVE un instante
--   sobre clinicas.
-- Orden respecto al código: cualquiera es seguro.
--   · Código nuevo, base sin esto: la RPC no existe (PGRST202) → la pasada lo
--     toma como «no disponible» y no avisa; el rechazo y el restablecimiento
--     siguen como en I2.
--   · Código viejo, base con esto: nadie llama a la RPC; la tabla queda vacía.
--     (Si llegara a haber un aviso del tipo nuevo con código viejo, el lector
--     de avisos lo rechaza por Zod y la campana cae a lo de antes; no ocurre
--     porque sólo lo escribe el código nuevo.)
-- Alcance de los roles:
--   gana — service_role: registrar intentos (sólo por la RPC). authenticated:
--          ve el aviso nuevo con la RLS de avisos_clinica (de su clínica y de
--          citas que ve), igual que los demás avisos.
--   pierde — nada.
-- Contrato con spinus-consola: tabla y función nuevas; la CHECK de
--   avisos_clinica (tabla de la agenda v2) se amplía; nada que la consola lea
--   cambia de nombre, tipo ni significado.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TRIGGER IF EXISTS trg_gcal_movimientos_aviso_clinica ON public.gcal_movimientos_rechazados;
--   DROP FUNCTION IF EXISTS public.aviso_clinica_de_movimiento_google();
--   DROP FUNCTION IF EXISTS public.cita_movimiento_google_registrar(uuid, uuid, timestamptz);
--   DROP TABLE IF EXISTS public.gcal_movimientos_rechazados;   -- (sin CASCADE)
--   UPDATE public.avisos_clinica SET revisado_en = now()       -- (sólo si hay; o respaldarlos antes)
--    WHERE tipo = 'google_movimiento_rechazado' AND revisado_en IS NULL;
--   -- y la CHECK de I5 con sus cinco tipos: falla si quedan filas del tipo
--   -- nuevo (revisadas o no); se conservan como registro y se deja la CHECK.
--
-- ═══ AUDITORÍA INDEPENDIENTE (2026-11-18, con supabase/AUDITORIA-MIGRACIONES.md) ═══
-- Sin hallazgos graves ni medios. Tres menores, ninguno bloquea:
--   1. gcal_movimientos_rechazados crece sin límite (un renglón por versión
--      rechazada; sin nada clínico, pesa poco). Deuda anotada: una purga de
--      renglones viejos, sabiendo que borrar uno deja que una repetición tardía
--      del MISMO `updated` vuelva a avisar.
--   2. Cada vez que un aviso pendiente «sube» queda un UPDATE en audit_log
--      (audit_avisos_clinica de I5). Deseable; se anota por si alguien cuenta filas.
--   3. La vuelta atrás no puede devolver la CHECK a cinco tipos si quedan
--      filas del tipo nuevo; ya lo dice la sección VUELTA ATRÁS.
-- Corregido tras el ensayo: la fila 10 del veredicto ya no nombra la tabla en
-- el texto del SELECT (si la transacción se deshace, la rejilla sale igual).
--
-- ═══ APLICACIÓN LOCAL (2026-11-18, base de Docker, nunca producción) ═══
-- Ensayo con ROLLBACK en lugar de COMMIT: nada quedó (veredicto con AUSENTE y
-- REVISAR, la fila 9 OK). Después, dos pasadas reales: las dos con 1-9 OK y la
-- 10 en 0 (la segunda, replay sin cambios). Prueba:
-- supabase/pruebas-sql/j4_aviso_google_reserva.sql.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_def text;
BEGIN
  IF to_regclass('public.agenda_ajustes') IS NULL OR to_regclass('public.avisos_clinica') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_ajustes (B1) o avisos_clinica (I5).';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
        AND attname IN ('reserva_canal', 'clinica_id', 'start_time')) <> 3 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: a appointments le falta reserva_canal (D1), clinica_id o start_time.';
  END IF;
  IF to_regprocedure('public.log_tabla_change()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta log_tabla_change().';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.avisos_clinica'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.avisos_clinica.', current_user;
  END IF;
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no se salta la RLS (la tabla nueva no tiene policies).';
  END IF;
  -- La CHECK es la de I5 (cinco tipos) o ya la de esta migración (replay).
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.avisos_clinica'::regclass AND conname = 'avisos_clinica_tipo_check';
  IF v_def IS NULL OR NOT (
       v_def LIKE '%reserva_enlace%' AND v_def LIKE '%cancelacion_paciente%' AND v_def LIKE '%reagendado_paciente%'
       AND v_def LIKE '%google_por_asignar%' AND v_def LIKE '%empalme_google%'
       AND (SELECT count(*) FROM regexp_matches(v_def, '''[a-z_]+''', 'g')) IN (5, 6)
       AND ((SELECT count(*) FROM regexp_matches(v_def, '''[a-z_]+''', 'g')) = 5 OR v_def LIKE '%google_movimiento_rechazado%')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: avisos_clinica_tipo_check no es la de I5 ni la de esta migración: %', v_def;
  END IF;
  -- Replay: la tabla, si existe, tiene exactamente estas columnas y tipos.
  IF to_regclass('public.gcal_movimientos_rechazados') IS NOT NULL AND (
       (SELECT count(*) FROM pg_attribute a
         WHERE a.attrelid = to_regclass('public.gcal_movimientos_rechazados') AND a.attnum > 0 AND NOT a.attisdropped
           AND (a.attname, a.atttypid::regtype) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype),
               ('cita_id', 'uuid'::regtype), ('google_updated', 'timestamptz'::regtype), ('detectado_en', 'timestamptz'::regtype))) <> 5
       OR (SELECT count(*) FROM pg_attribute WHERE attrelid = to_regclass('public.gcal_movimientos_rechazados') AND attnum > 0 AND NOT attisdropped) <> 5) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.gcal_movimientos_rechazados existe con otra forma.';
  END IF;
  -- Replay: las funciones, si existen, con la seguridad de esta migración.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.cita_movimiento_google_registrar(uuid, uuid, timestamptz)') AND prosecdef)
     OR EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.aviso_clinica_de_movimiento_google()') AND NOT prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una función de esta migración ya existe con otra seguridad (DEFINER/INVOKER).';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · El tipo nuevo de aviso.
-- ---------------------------------------------------------------------
ALTER TABLE public.avisos_clinica DROP CONSTRAINT IF EXISTS avisos_clinica_tipo_check;
ALTER TABLE public.avisos_clinica ADD CONSTRAINT avisos_clinica_tipo_check
  CHECK (tipo IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente',
                  'google_por_asignar', 'empalme_google', 'google_movimiento_rechazado'));

-- ---------------------------------------------------------------------
-- 3 · Los intentos rechazados: la tabla, sus permisos y su RLS.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gcal_movimientos_rechazados (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id      uuid        NOT NULL,
  cita_id         uuid        NOT NULL,
  google_updated  timestamptz NOT NULL,
  detectado_en    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gcal_movimientos_rechazados_pkey PRIMARY KEY (id),
  CONSTRAINT gcal_movimientos_rechazados_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT gcal_movimientos_rechazados_intento_key UNIQUE (cita_id, google_updated)
);
-- La FK RESTRICT a clinicas (borrar una clínica busca aquí).
CREATE INDEX IF NOT EXISTS gcal_movimientos_rechazados_clinica_idx ON public.gcal_movimientos_rechazados (clinica_id);

ALTER TABLE public.gcal_movimientos_rechazados ENABLE ROW LEVEL SECURITY;
-- Los privilegios por omisión de Supabase dan ALL a anon, authenticated y service_role.
REVOKE ALL ON TABLE public.gcal_movimientos_rechazados FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.gcal_movimientos_rechazados TO service_role;

COMMENT ON TABLE public.gcal_movimientos_rechazados IS
  'Tanda J (punto 10): un renglón por INTENTO de mover desde Google una cita reservada por enlace que la base rechazó (cita_proteger_eleccion, I2). Intento = (cita, updated del evento de Google): dos sondeos del mismo cambio son uno. Sólo lo escribe cita_movimiento_google_registrar (service_role); su disparador deja el aviso google_movimiento_rechazado en avisos_clinica. Nada clínico. Sin FK a appointments a propósito (como reserva_empalmes_google).';

-- ---------------------------------------------------------------------
-- 4 · La RPC de la pasada de sincronización.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cita_movimiento_google_registrar(
  p_clinica_id uuid, p_cita_id uuid, p_google_updated timestamptz)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_cita_id IS NULL OR p_google_updated IS NULL THEN
    RAISE EXCEPTION 'cita_movimiento_google_registrar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida) THEN
    RETURN false;
  END IF;
  -- El criterio de cita_proteger_eleccion (I2): de ESTA clínica, por enlace y sin empezar.
  IF NOT EXISTS (SELECT 1 FROM public.appointments a
                  WHERE a.id = p_cita_id AND a.clinica_id = p_clinica_id
                    AND a.reserva_canal IS NOT NULL AND a.start_time > now()) THEN
    RETURN false;
  END IF;
  INSERT INTO public.gcal_movimientos_rechazados (clinica_id, cita_id, google_updated)
  VALUES (p_clinica_id, p_cita_id, p_google_updated)
  ON CONFLICT ON CONSTRAINT gcal_movimientos_rechazados_intento_key DO NOTHING;
  RETURN FOUND;
END
$fn$;

COMMENT ON FUNCTION public.cita_movimiento_google_registrar(uuid, uuid, timestamptz) IS
  'Tanda J (punto 10): registra un intento de mover desde Google una cita reservada por enlace que la base rechazó; true = intento nuevo (deja el aviso), false = repetido o no aplica (v2 apagada, otra clínica, no es por enlace, ya empezó). Sólo service_role (gcalSincronizacionBase.ts, tras el 42501 de cita_proteger_eleccion).';

-- ---------------------------------------------------------------------
-- 5 · El escritor del aviso. SECURITY DEFINER (dueño postgres), como los de
--     I5: sólo inserta o vuelve a subir en avisos_clinica con lo que trae la
--     fila del disparador. RETURNS trigger: no se puede llamar por RPC.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aviso_clinica_de_movimiento_google()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
  VALUES (NEW.clinica_id, 'google_movimiento_rechazado', NEW.cita_id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL
  DO UPDATE SET creado_en = now();
  RETURN NULL;
END
$fn$;

-- Permisos de funciones (CLAUDE.md). La RPC, SÓLO service_role: la consola y
-- las sesiones no registran intentos. La de disparador, como las de I5.
REVOKE EXECUTE ON FUNCTION public.cita_movimiento_google_registrar(uuid, uuid, timestamptz) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_movimiento_google_registrar(uuid, uuid, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_movimiento_google() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_movimiento_google() TO anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trg_gcal_movimientos_aviso_clinica
  AFTER INSERT ON public.gcal_movimientos_rechazados
  FOR EACH ROW EXECUTE FUNCTION public.aviso_clinica_de_movimiento_google();

COMMIT;

-- ---------------------------------------------------------------------
-- 6 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'avisos_clinica_tipo_check admite el tipo nuevo' AS comprobacion,
         coalesce((SELECT (pg_get_constraintdef(oid) LIKE '%google_movimiento_rechazado%')::text FROM pg_constraint
                    WHERE conrelid = 'public.avisos_clinica'::regclass AND conname = 'avisos_clinica_tipo_check'), 'AUSENTE') AS valor,
         'true' AS esperado
  UNION ALL
  SELECT 2, 'gcal_movimientos_rechazados existe / RLS activa / sin policies',
         coalesce((SELECT 'sí / ' || relrowsecurity::text || ' / ' ||
                          (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gcal_movimientos_rechazados')::text
                     FROM pg_class WHERE oid = to_regclass('public.gcal_movimientos_rechazados')), 'AUSENTE'),
         'sí / true / 0'
  UNION ALL
  SELECT 3, 'privilegios de tabla anon / authenticated / service_role',
         coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'gcal_movimientos_rechazados' AND grantee = 'anon'), '-')
         || ' / ' || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'gcal_movimientos_rechazados' AND grantee = 'authenticated'), '-')
         || ' / ' || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'gcal_movimientos_rechazados' AND grantee = 'service_role'), '-'),
         '- / - / INSERT,SELECT'
  UNION ALL
  SELECT 4, 'FK a clinicas RESTRICT (y ninguna otra FK)',
         coalesce((SELECT string_agg(conname || ':' || confdeltype::text, ',') FROM pg_constraint
                    WHERE conrelid = to_regclass('public.gcal_movimientos_rechazados') AND contype = 'f'), 'NINGUNA'),
         'gcal_movimientos_rechazados_clinica_id_fkey:r'
  UNION ALL
  SELECT 5, 'funciones: RPC INVOKER / disparador DEFINER, search_path vacío',
         coalesce((SELECT (NOT p.prosecdef)::text FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_movimiento_google_registrar(uuid, uuid, timestamptz)')
                     AND p.proconfig @> ARRAY['search_path=""']), 'AUSENTE')
         || ' / ' || coalesce((SELECT p.prosecdef::text FROM pg_proc p WHERE p.oid = to_regprocedure('public.aviso_clinica_de_movimiento_google()')
                     AND p.proconfig @> ARRAY['search_path=""']), 'AUSENTE'),
         'true / true'
  UNION ALL
  SELECT 6, 'EXECUTE de la RPC: anon / authenticated / service_role',
         coalesce((SELECT has_function_privilege('anon', p.oid, 'EXECUTE')::text || ' / ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                          || ' / ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
                     FROM pg_proc p WHERE p.oid = to_regprocedure('public.cita_movimiento_google_registrar(uuid, uuid, timestamptz)')), 'AUSENTE'),
         'false / false / true'
  UNION ALL
  SELECT 7, 'ninguna de las 2 con EXECUTE a PUBLIC',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.cita_movimiento_google_registrar(uuid, uuid, timestamptz)'),
                           to_regprocedure('public.aviso_clinica_de_movimiento_google()'))
             AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                              WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')),
         '2'
  UNION ALL
  SELECT 8, 'disparador nuevo',
         coalesce((SELECT string_agg(tgname, ',') FROM pg_trigger WHERE NOT tgisinternal AND tgname = 'trg_gcal_movimientos_aviso_clinica'), 'AUSENTE'),
         'trg_gcal_movimientos_aviso_clinica'
  UNION ALL
  SELECT 9, 'policies de avisos_clinica, intactas',
         coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avisos_clinica'), 'NINGUNA'),
         'avisos_clinica_select,avisos_clinica_update'
  UNION ALL
  -- Sin nombrar la tabla en el texto del SELECT: si la transacción se deshizo, la rejilla
  -- tiene que salir igual (con AUSENTE arriba) y no un «relation does not exist».
  SELECT 10, 'intentos registrados',
         CASE WHEN to_regclass('public.gcal_movimientos_rechazados') IS NULL THEN 'AUSENTE'
              ELSE (xpath('/row/n/text()', query_to_xml('SELECT count(*) AS n FROM public.gcal_movimientos_rechazados', false, true, '')))[1]::text END,
         NULL
) t
ORDER BY t.n;
