-- ═══════════════════════════════════════════════════════════════════════
-- Agenda E6 — reagendar desde «no podré asistir» con el enlace fijo del
-- médico (D), con el tope agenda_ajustes.candado_reagendados (§2: 2)
-- Rama: feature/agenda-v2 · Escrita: 2026-11-13
-- Riesgo estimado: ALTO (envuelve reservar_por_enlace: la misma puerta sin
-- sesión que escribe appointments con service_role).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-13
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 6 × OK + 1 INFO,
--   0 reagendados), y otra pasada encima: misma rejilla, sólo los 2 NOTICE
--   «already exists, skipping» (tabla e índice), y no-op comprobado con una
--   huella de catálogo de 87 renglones (columnas con tipo, NOT NULL, DEFAULT
--   y COMMENT; relacl, RLS y COMMENT de la tabla; constraints; índices;
--   policies de la tabla y de appointments; disparadores; md5, proacl,
--   prosecdef, proconfig y COMMENT de las funciones y de reservar_por_enlace
--   y log_cita_change; privilegios por columna; COMMENT de
--   appointments.reserva_reagendados; count(*) de audit_log): sin
--   diferencias. Pre-vuelo probado en ROLLBACK: aborta con log_cita_change
--   alterada, sin cita_confirmacion_responder, con reservar_por_enlace
--   SECURITY DEFINER, con clinica_no_suspendida() alterada, con una
--   constraint de cita_reagendos quitada, con una columna de más y con una
--   sobrecarga de cita_reagendar_oferta. Anotada a mano en
--   supabase_migrations.schema_migrations (versión 20261115130000), como
--   D1-E1.
--   Pruebas: supabase/pruebas-sql/e6_reagendar.sql (bash scripts/pruebas-sql.sh)
--   y la e2e e2e/confirmacion-enlace.e2e.ts («reagendar … hasta el tope de 2»).
--   Comprobación:
--     select proname, md5(prosrc) from pg_proc
--      where proname in ('cita_reagendar_oferta', 'reagendar_por_enlace') order by 1;
--   → 4bcf4c7ef84526c6b2ecefecade8a18f / a05266ad00e3ecc1cdcdcd3d5600b533.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de B1, C1, D1-D3 y E1).
-- AUDITORÍA INDEPENDIENTE 2026-11-13: APTA CON CAMBIOS
-- (supabase/AUDITORIA-MIGRACIONES.md). Aplicado antes del commit:
--   · un 'repetida' de reservar_por_enlace que NO es el reagendado de este
--     origen (un client_id que ya reservó por el fijo sin origen) da
--     'reagendar_invalido' en vez de pasar como reagendado sin anotarlo
--     (prueba, caso 4c);
--   · spinus.via se limpia tras anotar: set_config(…, true) dura hasta el fin
--     de la transacción, no de la función (caso 4d);
--   · COMMENT de appointments.reserva_reagendados reescrito con el convenio de
--     E6 (el de D1 hablaba de «veces que una cita se reagendó»).
--   NO aplicado, para revisar por Angel:
--   · el correo que se verifica al reagendar no tiene por qué ser el de la
--     cita de origen (una cita del personal no guarda su seudónimo); quien
--     tenga el enlace de confirmación puede reagendar con otro correo. El
--     personal liga la cita nueva al iniciar la consulta, como toda reserva.
--   · candado_reagendados no tiene tope superior en B1 y numero /
--     reserva_reagendados llevan CHECK ≤ 100: con un tope > 100, el
--     reagendado 101 lanzaría 23514 (atómico, sin nada a medias).
--   · authenticated puede hacer UPDATE de reserva_reagendados (heredado de
--     D1; auditado).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- mejora_agendaV2.md §2 («Reagendar»: la página de «no podré asistir»
-- ofrece elegir otro horario con el enlace de reserva del médico) y el
-- candado («veces que se puede reagendar una misma cita: 2»); diseño en
-- e2e/resultados/plan_E.md E6 (allí con el nombre e3_reagendar y otro
-- timestamp: el encargo fijó 20261115130000).
-- NO se cambia D3: reagendar_por_enlace valida el enlace de confirmación y la
-- cita de origen, llama a reservar_por_enlace EN LA MISMA TRANSACCIÓN (con la
-- verificación del correo por código, el candado y «1 activa» de D intactos)
-- y, si reservó, pone reserva_reagendados = origen + 1 en la nueva (auditado
-- por log_cita_change con via = 'enlace_paciente', ya en la lista blanca de
-- E1) y anota cita_reagendos.
-- La oferta (cita_reagendar_oferta, STABLE) es lo que la página de
-- confirmación pregunta por GET: nunca escribe.
-- Reglas (lista A 11): enlace de confirmación vigente con respuesta
--   'cancelo'; cita de origen cancelada y aún del mismo destinatario
--   (cita_confirmacion_coincide); hasta 7 días después de la respuesta; el
--   enlace fijo VIGENTE del MISMO médico; no reagendada ya; tope =
--   candado_reagendados de la clínica (origen.reserva_reagendados < tope).
--   La cita nueva es «por ligar» aunque la de origen tuviera paciente: la
--   reserva pública no liga pacientes (D, lista A 22); cita_reagendos deja
--   ver al personal de dónde viene. La cancelación previa cuenta como
--   incidencia del candado de D2 cuando la cita de origen es por enlace:
--   2 reagendados + 3 incidencias cuadran con §2.
-- CLÍNICA SUSPENDIDA = NO DISPONIBLE (el mismo cierre que E1 tras su
--   auditoría): oferta da 'no_aplica' y reagendar 'reagendar_invalido'. Es
--   clinica_no_suspendida() con la clínica por parámetro (copia del predicado
--   con su huella en el pre-vuelo, como E1). reservar_por_enlace además exige
--   la puerta S3 entera (suspendida o sin acceso → clinica_sin_acceso).
-- Orden de candados: cita_confirmaciones (FOR UPDATE) → la cita de origen
--   (FOR UPDATE, para que el personal no la reactive a la vez) →
--   reserva_enlaces (FOR UPDATE, dentro de D3) → consultivo 1790 del médico.
--   cita_confirmacion_responder toma cita_confirmaciones → appointments: el
--   mismo orden. Ningún camino toma cita_confirmaciones después de
--   reserva_enlaces: sin ciclo.
-- Idempotencia: el mismo client_id que ya reagendó esta cita devuelve
--   'repetida' con la cita nueva; otro client_id, 'ya_reagendada'.
-- appointments NO gana columnas (reserva_reagendados ya existe, D1). Sólo se
--   reescribe su COMMENT con el convenio de E6 (el número va en la cita NUEVA).
-- ESTADO DE spinus.via: se limpia después de anotar (set_config local dura
--   hasta el fin de la transacción, no de la función).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B1, C1, D1-D3 y E1 (con su cierre de la suspendida). PG ≥ 14.
-- Bloqueos (lock_timeout 5 s): CREATE TABLE con FK → SHARE ROW EXCLUSIVE un
--   instante sobre clinicas, appointments y cita_confirmaciones (bloquea sus
--   escrituras un instante, no lecturas). Funciones y COMMENT: catálogo.
-- Orden respecto al código: PRIMERO esta migración. El código nuevo sin ella
--   recibe PGRST202 y no ofrece reagendar (la página dice «comunícate»); un
--   POST con `origen` da 404 uniforme. El código viejo no la nombra.
-- Alcance de los roles:
--   gana — service_role: EXECUTE de las 2 funciones; SELECT/INSERT en
--          cita_reagendos. authenticated: SELECT de 6 columnas (sin
--          confirmacion_id) de los reagendados cuya cita NUEVA ya ve (EXISTS
--          bajo la RLS de appointments).
--   pierde — anon: todo sobre la tabla nueva; authenticated: escribirla;
--          service_role: UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER en ella.
--   appointments, cita_confirmaciones y audit_log: sin cambio de permisos.
-- Contrato con spinus-consola: tabla nueva; ninguna columna de public cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   Respaldar antes:
--     CREATE TABLE respaldos.cita_reagendos_AAAAMMDD AS SELECT * FROM public.cita_reagendos;
--   DROP FUNCTION IF EXISTS public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid);
--   DROP FUNCTION IF EXISTS public.cita_reagendar_oferta(uuid, text);
--   DROP TABLE IF EXISTS public.cita_reagendos;
--   Las citas reagendadas se quedan, con su reserva_reagendados (son hechos).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  -- md5(prosrc) de log_cita_change de E1 (la de la lista blanca con 'enlace_paciente').
  c_log_e1  CONSTANT text := '80c3556c1655ddf2eaf1d57995190463';
  -- md5(prosrc con espacios normalizados) de clinica_no_suspendida(), la que se copia (igual que E1).
  c_no_susp CONSTANT text := '588de29d551f6d474eb24346748e1148';
  -- Huella de constraints e índices de cita_reagendos tal como los deja esta migración.
  c_huella  CONSTANT text := '6d6680fe701e853eb3a15b04d9d9885a';
  c_cols    CONSTANT text[] := ARRAY['id','clinica_id','cita_origen_id','cita_nueva_id','confirmacion_id','numero','created_at'];
  c_reservar CONSTANT text := 'public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)';
  v_cols text[];
  v_md5  text;
BEGIN
  IF to_regclass('public.cita_confirmaciones') IS NULL
     OR to_regprocedure('public.cita_confirmacion_coincide(uuid, text, uuid, text)') IS NULL
     OR to_regprocedure('public.cita_confirmacion_responder(uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta E1 (cita_confirmaciones y sus funciones).';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.log_cita_change()')) IS DISTINCT FROM c_log_e1 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: log_cita_change no es la de E1 (sin la lista blanca con enlace_paciente, el reagendado no quedaría auditado como del paciente).';
  END IF;
  IF to_regprocedure(c_reservar) IS NULL
     OR pg_get_function_result(to_regprocedure(c_reservar))
        <> 'TABLE(r_resultado text, r_cita_id uuid, r_inicio timestamp with time zone, r_fin timestamp with time zone, r_historial integer)'
     OR (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure(c_reservar)) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta reservar_por_enlace (D3) con su firma de 14 argumentos y su resultado, INVOKER.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass
                  AND attname = 'candado_reagendados' AND attnotnull AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.appointments'::regclass
                  AND attname = 'reserva_reagendados' AND atttypid = 'smallint'::regtype AND attnotnull AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_ajustes.candado_reagendados (B1) o appointments.reserva_reagendados smallint NOT NULL (D1).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.clinicas'::regclass AND attname = 'suspendida'
                   AND atttypid = 'boolean'::regtype AND attnotnull AND NOT attisdropped)
     OR (SELECT md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) FROM pg_proc p
          WHERE p.oid = to_regprocedure('public.clinica_no_suspendida()')) IS DISTINCT FROM c_no_susp THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: clinicas.suspendida o clinica_no_suspendida() no son las que copian oferta y reagendar.';
  END IF;
  IF to_regprocedure('public.log_tabla_change()') IS NULL OR to_regprocedure('public.get_clinica_id()') IS NULL
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.get_clinica_id()')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta log_tabla_change(), o get_clinica_id() no existe o no es SECURITY DEFINER.';
  END IF;
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no tiene BYPASSRLS; las funciones invoker no verían las filas.';
  END IF;
  -- Una por privilegio: con una lista, has_table_privilege da true si tiene CUALQUIERA.
  IF NOT (has_table_privilege('service_role', 'public.appointments', 'SELECT')
          AND has_table_privilege('service_role', 'public.appointments', 'UPDATE')
          AND has_table_privilege('service_role', 'public.cita_confirmaciones', 'SELECT')
          AND has_table_privilege('service_role', 'public.cita_confirmaciones', 'UPDATE')
          AND has_table_privilege('service_role', 'public.reserva_enlaces', 'SELECT')
          AND has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT')
          AND has_table_privilege('service_role', 'public.clinicas', 'SELECT')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role sin los privilegios que usan las funciones.';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.appointments'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.appointments.', current_user;
  END IF;
  IF to_regclass('public.cita_reagendos') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.cita_reagendos'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> c_cols AND v_cols <@ c_cols) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.cita_reagendos ya existe con OTRAS columnas (%).', v_cols;
    END IF;
    SELECT md5(string_agg(x.d, ';' ORDER BY x.d)) INTO v_md5 FROM (
      SELECT k.conname || ':' || replace(pg_get_constraintdef(k.oid), 'public.', '') AS d
        FROM pg_constraint k WHERE k.conrelid = 'public.cita_reagendos'::regclass
      UNION ALL
      SELECT i.indexname || ':' || replace(i.indexdef, 'public.', '')
        FROM pg_indexes i WHERE i.schemaname = 'public' AND i.tablename = 'cita_reagendos') x;
    IF v_md5 IS DISTINCT FROM c_huella THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.cita_reagendos ya existe con OTRAS constraints o índices (md5 %).', v_md5;
    END IF;
  END IF;
  -- Ninguna sobrecarga con otra firma, y ninguna como SECURITY DEFINER.
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
               AND p.proname IN ('cita_reagendar_oferta', 'reagendar_por_enlace')
               AND (p.prosecdef OR p.oid NOT IN (
                 coalesce(to_regprocedure('public.cita_reagendar_oferta(uuid, text)')::oid, 0::oid),
                 coalesce(to_regprocedure('public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)')::oid, 0::oid)))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una función de E6 existe como SECURITY DEFINER o con otra firma.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La tabla, su RLS y sus permisos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cita_reagendos (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id      uuid        NOT NULL,
  cita_origen_id  uuid        NOT NULL,
  cita_nueva_id   uuid        NOT NULL,
  confirmacion_id uuid        NOT NULL,
  numero          smallint    NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cita_reagendos_pkey PRIMARY KEY (id),
  -- Una cita se reagenda UNA vez; una cita nueva viene de UNA.
  CONSTRAINT cita_reagendos_origen_key UNIQUE (cita_origen_id),
  CONSTRAINT cita_reagendos_nueva_key UNIQUE (cita_nueva_id),
  CONSTRAINT cita_reagendos_clinica_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT cita_reagendos_origen_fkey FOREIGN KEY (cita_origen_id) REFERENCES public.appointments(id) ON DELETE RESTRICT,
  CONSTRAINT cita_reagendos_nueva_fkey FOREIGN KEY (cita_nueva_id) REFERENCES public.appointments(id) ON DELETE RESTRICT,
  CONSTRAINT cita_reagendos_confirmacion_fkey FOREIGN KEY (confirmacion_id) REFERENCES public.cita_confirmaciones(id) ON DELETE RESTRICT,
  CONSTRAINT cita_reagendos_numero_check CHECK (numero BETWEEN 1 AND 100),
  CONSTRAINT cita_reagendos_distintas_check CHECK (cita_origen_id <> cita_nueva_id)
);
-- Las UNIQUE ya indexan cita_origen_id y cita_nueva_id (las dos FK a appointments);
-- éste es para la FK a cita_confirmaciones.
CREATE INDEX IF NOT EXISTS cita_reagendos_confirmacion ON public.cita_reagendos (confirmacion_id);

ALTER TABLE public.cita_reagendos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cita_reagendos FROM PUBLIC, anon, authenticated, service_role;
-- Sin confirmacion_id: el personal ve de qué cita viene, no el enlace.
GRANT SELECT (id, clinica_id, cita_origen_id, cita_nueva_id, numero, created_at) ON TABLE public.cita_reagendos TO authenticated;
GRANT SELECT, INSERT ON TABLE public.cita_reagendos TO service_role;

-- Sin recursión: lee appointments, no cita_reagendos; el EXISTS corre bajo la
-- RLS de appointments de quien pregunta (el invitado, sólo las suyas).
DROP POLICY IF EXISTS cita_reagendos_select ON public.cita_reagendos;
CREATE POLICY cita_reagendos_select ON public.cita_reagendos FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = cita_reagendos.cita_nueva_id AND a.clinica_id = public.get_clinica_id()));

CREATE OR REPLACE TRIGGER audit_cita_reagendos
  AFTER INSERT OR UPDATE OR DELETE ON public.cita_reagendos
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();

-- ---------------------------------------------------------------------
-- 3 · Funciones (INVOKER, sólo service_role).
-- ---------------------------------------------------------------------
-- ¿Se ofrece reagendar? UNA fila. r_motivo: ok (con r_enlace_id, el fijo
-- vigente del médico) | tope | sin_enlace | ya_reagendada | vencida | no_aplica.
-- STABLE: la página de confirmación la llama por GET y no escribe nada.
CREATE OR REPLACE FUNCTION public.cita_reagendar_oferta(p_clinica_id uuid, p_codigo_hash text)
RETURNS TABLE (r_enlace_id uuid, r_motivo text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_c    public.cita_confirmaciones%ROWTYPE;
  v_a    record;
  v_tope integer;
BEGIN
  IF p_clinica_id IS NULL OR p_codigo_hash IS NULL OR p_codigo_hash !~ '^[0-9a-f]{64}$' THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  -- Suspendida = no disponible (el cierre de E1).
  IF NOT EXISTS (SELECT 1 FROM public.clinicas k WHERE k.id = p_clinica_id AND NOT k.suspendida) THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c
   WHERE c.codigo_hash = p_codigo_hash AND c.clinica_id = p_clinica_id AND c.revocado_en IS NULL;
  SELECT j.candado_reagendados INTO v_tope FROM public.agenda_ajustes j
   WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF v_c.id IS NULL OR v_tope IS NULL OR v_c.respuesta IS DISTINCT FROM 'cancelo' THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  SELECT a.id, a.status, a.medico_id, a.reserva_reagendados, a.paciente_id, a.reserva_correo_hmac INTO v_a
    FROM public.appointments a WHERE a.id = v_c.appointment_id AND a.clinica_id = p_clinica_id;
  IF NOT FOUND OR v_a.status <> 'cancelled' OR v_a.medico_id IS NULL
     OR NOT public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac, v_a.paciente_id, v_a.reserva_correo_hmac) THEN
    r_motivo := 'no_aplica'; RETURN NEXT; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.cita_reagendos r WHERE r.cita_origen_id = v_a.id AND r.clinica_id = p_clinica_id) THEN
    r_motivo := 'ya_reagendada'; RETURN NEXT; RETURN;
  END IF;
  IF v_c.respondido_en <= now() - interval '7 days' THEN r_motivo := 'vencida'; RETURN NEXT; RETURN; END IF;
  IF v_a.reserva_reagendados >= v_tope THEN r_motivo := 'tope'; RETURN NEXT; RETURN; END IF;
  SELECT e.id INTO r_enlace_id FROM public.reserva_enlaces e
   WHERE e.clinica_id = p_clinica_id AND e.medico_id = v_a.medico_id AND e.clase = 'fijo' AND e.revocado_en IS NULL;
  r_motivo := CASE WHEN r_enlace_id IS NULL THEN 'sin_enlace' ELSE 'ok' END;
  RETURN NEXT;
END
$fn$;

-- Reagendar = validar el origen + reservar_por_enlace (D3) en la MISMA
-- transacción + marcar. UNA fila; usar .single(). r_resultado: los de D3
-- (ok, repetida, ocupado, bloqueado, ya_tiene_cita, correo_sin_verificar…)
-- más reagendar_invalido | ya_reagendada | tope_reagendados | apagado.
CREATE OR REPLACE FUNCTION public.reagendar_por_enlace(
  p_confirmacion_hash text,
  p_clinica_id uuid, p_codigo_hash text, p_consultorio_id uuid, p_tipo_cita_id uuid, p_inicio timestamptz,
  p_nombre text, p_telefono text, p_correo text, p_tel_hmac text, p_correo_hmac text, p_ficha_hmac text,
  p_aviso_version text, p_aviso_sha256 text, p_client_id uuid)
RETURNS TABLE (r_resultado text, r_cita_id uuid, r_inicio timestamptz, r_fin timestamptz, r_historial integer)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_c    public.cita_confirmaciones%ROWTYPE;
  v_a    record;
  v_e    record;
  v_tope integer;
  v_prev record;
  v_r    record;
BEGIN
  IF p_confirmacion_hash IS NULL OR p_confirmacion_hash !~ '^[0-9a-f]{64}$' OR p_clinica_id IS NULL
     OR p_codigo_hash IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'reagendar_por_enlace: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT c.* INTO v_c FROM public.cita_confirmaciones c
   WHERE c.codigo_hash = p_confirmacion_hash AND c.clinica_id = p_clinica_id AND c.revocado_en IS NULL
   FOR UPDATE;
  IF NOT FOUND OR v_c.respuesta IS DISTINCT FROM 'cancelo'
     -- Suspendida = no disponible (el cierre de E1).
     OR NOT EXISTS (SELECT 1 FROM public.clinicas k WHERE k.id = p_clinica_id AND NOT k.suspendida) THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  -- La cita de origen, bloqueada: el personal no la reactiva mientras tanto.
  SELECT a.id, a.status, a.medico_id, a.reserva_reagendados, a.paciente_id, a.reserva_correo_hmac INTO v_a
    FROM public.appointments a WHERE a.id = v_c.appointment_id AND a.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR v_a.status <> 'cancelled' OR v_a.medico_id IS NULL
     OR NOT public.cita_confirmacion_coincide(v_c.paciente_id, v_c.reserva_correo_hmac, v_a.paciente_id, v_a.reserva_correo_hmac) THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  -- Idempotencia: el mismo envío ya reagendó; otro envío, ya está reagendada.
  SELECT r.cita_nueva_id, n.start_time, n.end_time, n.client_id INTO v_prev
    FROM public.cita_reagendos r JOIN public.appointments n ON n.id = r.cita_nueva_id AND n.clinica_id = p_clinica_id
   WHERE r.cita_origen_id = v_a.id AND r.clinica_id = p_clinica_id;
  IF FOUND THEN
    IF v_prev.client_id = p_client_id::text THEN
      r_resultado := 'repetida'; r_cita_id := v_prev.cita_nueva_id; r_inicio := v_prev.start_time; r_fin := v_prev.end_time;
    ELSE
      r_resultado := 'ya_reagendada';
    END IF;
    RETURN NEXT; RETURN;
  END IF;
  IF v_c.respondido_en <= now() - interval '7 days' THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  SELECT e.medico_id, e.clase INTO v_e FROM public.reserva_enlaces e
   WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id AND e.revocado_en IS NULL;
  IF NOT FOUND OR v_e.clase <> 'fijo' OR v_e.medico_id <> v_a.medico_id THEN
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  SELECT j.candado_reagendados INTO v_tope FROM public.agenda_ajustes j
   WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND THEN r_resultado := 'apagado'; RETURN NEXT; RETURN; END IF;
  IF v_a.reserva_reagendados >= v_tope THEN r_resultado := 'tope_reagendados'; RETURN NEXT; RETURN; END IF;

  SELECT x.* INTO v_r FROM public.reservar_por_enlace(
    p_clinica_id, p_codigo_hash, p_consultorio_id, p_tipo_cita_id, p_inicio, p_nombre, p_telefono, p_correo,
    p_tel_hmac, p_correo_hmac, p_ficha_hmac, p_aviso_version, p_aviso_sha256, p_client_id) x;
  IF v_r.r_resultado = 'repetida' THEN
    -- D3 reconoció un envío que NO es el reagendado de este origen (ése lo
    -- atrapa la idempotencia de arriba): no se da por reagendado.
    r_resultado := 'reagendar_invalido'; RETURN NEXT; RETURN;
  END IF;
  IF v_r.r_resultado = 'ok' THEN
    -- Lo hizo la persona por el enlace de su cita (lista blanca de E1).
    PERFORM set_config('spinus.via', 'enlace_paciente', true);
    UPDATE public.appointments SET reserva_reagendados = v_a.reserva_reagendados + 1
     WHERE id = v_r.r_cita_id AND clinica_id = p_clinica_id;
    INSERT INTO public.cita_reagendos (clinica_id, cita_origen_id, cita_nueva_id, confirmacion_id, numero)
    VALUES (p_clinica_id, v_a.id, v_r.r_cita_id, v_c.id, v_a.reserva_reagendados + 1);
    -- set_config(…, true) dura hasta el fin de la TRANSACCIÓN, no de la función:
    -- se limpia para que nada de lo que siga en ella herede el «via».
    PERFORM set_config('spinus.via', '', true);
  END IF;
  r_resultado := v_r.r_resultado; r_cita_id := v_r.r_cita_id; r_inicio := v_r.r_inicio;
  r_fin := v_r.r_fin; r_historial := v_r.r_historial;
  RETURN NEXT;
END
$fn$;

-- Permisos de funciones: SOLO service_role, justificado: son la lectura y la
-- escritura de la página pública y de la ruta sin sesión; ni la consola ni una
-- sesión de la app deben reservar citas por aquí saltándose la RLS.
REVOKE EXECUTE ON FUNCTION public.cita_reagendar_oferta(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cita_reagendar_oferta(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) TO service_role;

COMMENT ON COLUMN public.appointments.reserva_reagendados IS
  'Agenda E6: posición en la cadena de reagendados. 0 en una cita no reagendada; la cita NUEVA de un reagendado lleva origen + 1 (sólo la escribe reagendar_por_enlace; la de origen no cambia). Tope agenda_ajustes.candado_reagendados.';
COMMENT ON TABLE public.cita_reagendos IS
  'Reagendados por enlace (agenda E6): cita cancelada por el paciente con su enlace de confirmación → cita reservada con el enlace fijo del mismo médico. numero = reserva_reagendados de la nueva; tope agenda_ajustes.candado_reagendados. Sólo escribe reagendar_por_enlace; nunca se borra.';
COMMENT ON FUNCTION public.cita_reagendar_oferta(uuid, text) IS
  'Agenda E6: ¿se ofrece reagendar la cita de este enlace de confirmación? STABLE, sólo service_role. Clínica suspendida, apagada o sin respuesta cancelo: no_aplica.';
COMMENT ON FUNCTION public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) IS
  'Agenda E6: valida el enlace de confirmación y la cita de origen y llama a reservar_por_enlace (D3) en la misma transacción; con ok, reserva_reagendados = origen + 1 (via enlace_paciente) y anota cita_reagendos. Sólo service_role.';

COMMIT;

-- ---------------------------------------------------------------------
-- 4 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'cita_reagendos: RLS / policies' AS comprobacion,
         coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.cita_reagendos')), 'AUSENTE')
         || ' / ' || coalesce((SELECT string_agg(cmd, ',' ORDER BY cmd) FROM pg_policies
                                WHERE schemaname = 'public' AND tablename = 'cita_reagendos'), '-') AS valor,
         'true / SELECT' AS esperado
  UNION ALL
  SELECT 2, 'privilegios de TABLA anon / authenticated / service_role',
         coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'cita_reagendos' AND grantee = 'anon'), '-') || ' / '
         || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'cita_reagendos' AND grantee = 'authenticated'), '-') || ' / '
         || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'cita_reagendos' AND grantee = 'service_role'), '-'),
         '- / - / INSERT,SELECT'
  UNION ALL
  SELECT 3, 'columnas que authenticated puede leer',
         coalesce((SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges
                    WHERE table_schema = 'public' AND table_name = 'cita_reagendos'
                      AND grantee = 'authenticated' AND privilege_type = 'SELECT'), '-'),
         'cita_nueva_id,cita_origen_id,clinica_id,created_at,id,numero'
  UNION ALL
  SELECT 4, 'FKs (todas RESTRICT) / huella de constraints e índices',
         coalesce((SELECT string_agg(conname || '=' || confdeltype::text, ',' ORDER BY conname) FROM pg_constraint
                    WHERE conrelid = to_regclass('public.cita_reagendos') AND contype = 'f'), '-')
         || ' / ' || coalesce((SELECT md5(string_agg(x.d, ';' ORDER BY x.d)) FROM (
              SELECT k.conname || ':' || replace(pg_get_constraintdef(k.oid), 'public.', '') AS d
                FROM pg_constraint k WHERE k.conrelid = to_regclass('public.cita_reagendos')
              UNION ALL
              SELECT i.indexname || ':' || replace(i.indexdef, 'public.', '')
                FROM pg_indexes i WHERE i.schemaname = 'public' AND i.tablename = 'cita_reagendos') x), '-'),
         'cita_reagendos_clinica_fkey=r,cita_reagendos_confirmacion_fkey=r,cita_reagendos_nueva_fkey=r,cita_reagendos_origen_fkey=r / 6d6680fe701e853eb3a15b04d9d9885a'
  UNION ALL
  SELECT 5, 'funciones: definer / EXECUTE anon,authenticated,service_role / PUBLIC / md5',
         coalesce((SELECT string_agg(p.proname || '=' || p.prosecdef::text || '/' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
                    || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                    || has_function_privilege('service_role', p.oid, 'EXECUTE')::text || '/'
                    || (EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                 WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))::text || '/' || md5(p.prosrc), ' ; ' ORDER BY p.proname)
                     FROM pg_proc p WHERE p.oid IN (
                       to_regprocedure('public.cita_reagendar_oferta(uuid, text)'),
                       to_regprocedure('public.reagendar_por_enlace(text, uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)'))), '-'),
         'cita_reagendar_oferta=false/false,false,true/false/4bcf4c7ef84526c6b2ecefecade8a18f ; reagendar_por_enlace=false/false,false,true/false/a05266ad00e3ecc1cdcdcd3d5600b533'
  UNION ALL
  SELECT 6, 'disparador audit_cita_reagendos / las 5 policies de appointments, intactas',
         (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = to_regclass('public.cita_reagendos')
             AND tgname = 'audit_cita_reagendos' AND tgenabled = 'O') || ' / '
         || (SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'),
         '1 / appointments_delete,appointments_gates_insert,appointments_insert,appointments_select,appointments_update'
  UNION ALL
  SELECT 7, 'censo: reagendados',
         (SELECT count(*)::text FROM public.cita_reagendos), NULL
) t
ORDER BY t.n;
