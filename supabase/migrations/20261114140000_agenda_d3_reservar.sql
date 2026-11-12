-- ═══════════════════════════════════════════════════════════════════════
-- Agenda D3 — reservar por enlace: contexto público, ocupación (sólo libre /
-- ocupado), código al correo y la reserva atómica
-- Rama: feature/agenda-v2 (worktree feature/agenda-v2-d) · Escrita: 2026-11-11
-- Riesgo estimado: ALTO (único camino por el que alguien SIN sesión escribe
-- una cita; con service_role, que se salta la RLS).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-12
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 6 × OK), y una
--   segunda pasada: misma rejilla, sólo 2 NOTICE «already exists, skipping»
--   (tabla e índice), y no-op comprobado con la huella de catálogo de D1/D2
--   ampliada (242 renglones; las cinco funciones con md5, proacl, prosecdef y
--   COMMENT): sin diferencias. Anotada a mano en
--   supabase_migrations.schema_migrations (versión 20261114140000, 26
--   sentencias), como D1.
--   Pruebas: supabase/pruebas-sql/d3_reservar_por_enlace.sql (bash
--   scripts/pruebas-sql.sh, secuencial en ROLLBACK) y la carrera de dos
--   sesiones bash scripts/reserva-carrera.sh: mismo turno por dos enlaces del
--   mismo médico → A ok, B esperó 1,5-1,9 s y salió «ocupado», 1 cita; control
--   sin la línea del candado → las dos reservan; mismo enlace único → B
--   «enlace_usado»; REPEATABLE READ → 25001. Limpia lo que crea.
--   Comprobación:
--     select count(*) from pg_proc where pronamespace = 'public'::regnamespace
--        and proname in ('reserva_contexto', 'reserva_ocupacion', 'reserva_codigo_emitir',
--                        'reserva_codigo_verificar', 'reservar_por_enlace') and not prosecdef;
--   → 5.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de C1, D1 y D2).
-- AUDITORÍA INDEPENDIENTE 2026-11-12: APTA CON CAMBIOS
-- (supabase/AUDITORIA-MIGRACIONES.md), sin hallazgos en la lógica. Aplicado:
--   · El renglón de bloqueos citaba clinicas (la tabla nueva sólo referencia
--     reserva_enlaces).
--   · Faltaba «Orden respecto al código»: nada en src/ llama todavía a estas
--     funciones y turnosReserva.ts (P9) llega con D5; escrito abajo y en el
--     COMMENT de reservar_por_enlace.
--   Corregido por el autor antes de la auditoría, sobre el diseño: guarda de
--   READ COMMITTED (en REPEATABLE READ el empalme no vería la reserva
--   ganadora); la puerta S3 también al emitir el código; reserva_ocupacion
--   exige el interruptor; dos códigos pedidos en la misma transacción ya no
--   empatan en created_at (clock_timestamp() y desempate por intentos); la
--   cita nace con gcal_sync_status 'pending' (sin evento en Google, 'synced'
--   mentiría); la fila 5 del veredicto busca también agenda_ajustes sin
--   «public.».
--   Dimensión propuesta por el auditor (no se tocó AUDITORIA-MIGRACIONES.md):
--   convenios que delegan en código de la aplicación que todavía no existe.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Todas SECURITY INVOKER y SÓLO service_role (BYPASSRLS, comprobado en el
-- pre-vuelo). Ninguna escribe agenda_ajustes. Toda escritura recibe
-- p_clinica_id y lo vuelve a casar con el enlace. reserva_contexto es la
-- única que entra por el hash del código (la clínica aún no se conoce).
-- GARANTÍA DE UN SOLO TURNO: FOR UPDATE sobre la fila del enlace + candado
-- consultivo (1790, hashtext(medico_id)) por médico; dentro, empalme y
-- candado se vuelven a comprobar y se inserta. NO es una restricción de
-- exclusión: §2 deja que el personal empalme citas, y una EXCLUDE sobre
-- appointments haría fallar su PUT al reactivar o mover una reserva.
-- Límite aceptado: el alta del personal no toma el candado; una cita del
-- personal confirmada en el mismo milisegundo puede empalmarse con una
-- reserva (lo mismo que §2 ya permite al personal).
-- Empalme = mismo médico, sin todo el día, sin cancelled ni no_show (P3);
-- las filas de Google importadas (C) SÍ ocupan (B8).
-- Horario y alineación del turno (P9) los comprueba el servidor con
-- turnosAgenda antes de llamar (convenio, dimensión 16): aquí van los
-- invariantes que una carrera rompería y el aislamiento.
-- Puerta S3: gcal_sync_clinica_habilitada (C1), porque service_role no pasa
-- por appointments_gates_insert.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere D1, D2 y C1. Bloqueos: sólo CREATE TABLE (SHARE ROW EXCLUSIVE un
-- instante sobre reserva_enlaces, por su FK) y catálogo.
-- Orden respecto al código: PRIMERO esta migración. Hoy nada en src/ llama a
--   estas cinco funciones; las llama la ruta pública de D5, que además tiene
--   que comprobar horario y alineación del turno (P9) con
--   src/lib/reserva/turnosReserva.ts ANTES de llamar a reservar_por_enlace.
--   Sin ese llamador nadie impone P9: no exponer un endpoint que llame a
--   reservar_por_enlace sin pasar por ahí.
-- Alcance de los roles: gana service_role (EXECUTE de 5 funciones; SELECT,
-- INSERT, UPDATE en reserva_verificaciones). pierden anon y authenticated
-- todo sobre reserva_verificaciones. Nadie más gana nada.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP FUNCTION IF EXISTS public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid);
--   DROP FUNCTION IF EXISTS public.reserva_codigo_verificar(uuid, uuid, text, text, text);
--   DROP FUNCTION IF EXISTS public.reserva_codigo_emitir(uuid, uuid, text, text);
--   DROP FUNCTION IF EXISTS public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz);
--   DROP FUNCTION IF EXISTS public.reserva_contexto(text, text, text);
--   DROP TABLE IF EXISTS public.reserva_verificaciones;
-- Las citas ya reservadas se quedan.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.reserva_enlaces') IS NULL OR to_regclass('public.reserva_incidencias') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta D1 o D2.';
  END IF;
  IF to_regprocedure('public.gcal_sync_clinica_habilitada(uuid)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta la puerta S3 gcal_sync_clinica_habilitada(uuid) (C1).';
  END IF;
  IF to_regprocedure('public.reserva_contacto_estado(uuid, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta reserva_contacto_estado (D2).';
  END IF;
  IF NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role ya no tiene BYPASSRLS; estas funciones invoker dejarían de ver las filas.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE prosecdef AND oid IN (
       to_regprocedure('public.reserva_contexto(text, text, text)'),
       to_regprocedure('public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz)'),
       to_regprocedure('public.reserva_codigo_emitir(uuid, uuid, text, text)'),
       to_regprocedure('public.reserva_codigo_verificar(uuid, uuid, text, text, text)'),
       to_regprocedure('public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid)'))) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una función de D3 existe como SECURITY DEFINER.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reserva_verificaciones (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id      uuid        NOT NULL,
  enlace_id       uuid        NOT NULL,
  correo_hmac     text        NOT NULL,
  codigo_hmac     text        NOT NULL,
  intentos        smallint    NOT NULL DEFAULT 0,
  caduca_en       timestamptz NOT NULL,
  verificado_en   timestamptz,
  ficha_hmac      text,
  ficha_caduca_en timestamptz,
  consumida_en    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_verificaciones_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_verificaciones_ficha_key UNIQUE (ficha_hmac),
  CONSTRAINT reserva_verificaciones_enlace_fkey FOREIGN KEY (enlace_id, clinica_id)
    REFERENCES public.reserva_enlaces (id, clinica_id) ON DELETE RESTRICT,
  CONSTRAINT reserva_verificaciones_intentos_check CHECK (intentos BETWEEN 0 AND 5),
  CONSTRAINT reserva_verificaciones_hmac_check CHECK (correo_hmac ~ '^[0-9a-f]{64}$' AND codigo_hmac ~ '^[0-9a-f]{64}$'
    AND (ficha_hmac IS NULL OR ficha_hmac ~ '^[0-9a-f]{64}$')),
  CONSTRAINT reserva_verificaciones_estado_check CHECK (
    ((verificado_en IS NULL) = (ficha_hmac IS NULL)) AND ((ficha_hmac IS NULL) = (ficha_caduca_en IS NULL))
    AND (consumida_en IS NULL OR verificado_en IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS reserva_verificaciones_busqueda ON public.reserva_verificaciones
  (clinica_id, enlace_id, correo_hmac, created_at DESC);
ALTER TABLE public.reserva_verificaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reserva_verificaciones FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.reserva_verificaciones TO service_role;

-- 1 · Contexto público: NULL = 404 indistinguible (no existe, revocado,
--     interruptor apagado, aviso sin aprobar, clínica sin acceso, médico ido).
CREATE OR REPLACE FUNCTION public.reserva_contexto(p_codigo_hash text, p_aviso_version text, p_aviso_sha256 text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_e  public.reserva_enlaces%ROWTYPE;
  v_p  record;
  v_aj record;
BEGIN
  IF p_codigo_hash IS NULL OR p_codigo_hash !~ '^[0-9a-f]{64}$' OR p_aviso_version IS NULL OR p_aviso_sha256 IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT e.* INTO v_e FROM public.reserva_enlaces e WHERE e.codigo_hash = p_codigo_hash;
  IF NOT FOUND OR v_e.revocado_en IS NOT NULL THEN RETURN NULL; END IF;
  SELECT j.anticipacion_min_horas, j.horizonte_dias INTO v_aj
    FROM public.agenda_ajustes j WHERE j.clinica_id = v_e.clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_avisos a
                  WHERE a.version = p_aviso_version AND a.texto_sha256 = p_aviso_sha256 AND a.aprobado) THEN
    RETURN NULL;
  END IF;
  IF NOT public.gcal_sync_clinica_habilitada(v_e.clinica_id) THEN RETURN NULL; END IF;
  SELECT p.titulo, p.nombres, p.apellido_paterno, p.apellido_materno, p.especialidad, p.telefono_consultorio INTO v_p
    FROM public.profiles p WHERE p.id = v_e.medico_id AND p.clinica_id = v_e.clinica_id AND p.role = 'medico';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'clinica_id', v_e.clinica_id, 'enlace_id', v_e.id, 'medico_id', v_e.medico_id, 'clase', v_e.clase,
    'estado', CASE WHEN v_e.clase = 'unico' AND v_e.usado_en IS NOT NULL THEN 'usado'
                   WHEN v_e.clase = 'unico' AND v_e.caduca_en <= now() THEN 'caducado' ELSE 'vigente' END,
    'medico', jsonb_build_object('titulo', v_p.titulo, 'nombres', v_p.nombres, 'apellido_paterno', v_p.apellido_paterno,
                                 'apellido_materno', v_p.apellido_materno, 'especialidad', v_p.especialidad,
                                 'telefono', v_p.telefono_consultorio),
    'clinica', (SELECT jsonb_build_object('nombre', c.nombre, 'nombre_display', c.nombre_display, 'horario', c.horario_consulta)
                  FROM public.clinicas c WHERE c.id = v_e.clinica_id),
    'consultorios', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'direccion', c.direccion,
                       'telefono', c.telefono, 'timezone', c.timezone, 'horario', c.horario, 'horario_propio', c.horario_propio)
                       ORDER BY c.es_default DESC, c.nombre), '[]'::jsonb)
                       FROM public.consultorios c
                      WHERE c.clinica_id = v_e.clinica_id AND c.medico_id = v_e.medico_id AND c.activo),
    'tipos', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre, 'duracion_min', t.duracion_min)
                ORDER BY t.nombre), '[]'::jsonb)
                FROM public.tipos_cita t
               WHERE t.clinica_id = v_e.clinica_id AND t.activo AND (t.medico_id IS NULL OR t.medico_id = v_e.medico_id)),
    'ajustes', jsonb_build_object('anticipacion_min_horas', v_aj.anticipacion_min_horas, 'horizonte_dias', v_aj.horizonte_dias));
END
$fn$;

-- 2 · Ocupación: sólo puntas, nunca título ni paciente. Atada al enlace.
CREATE OR REPLACE FUNCTION public.reserva_ocupacion(p_clinica_id uuid, p_enlace_id uuid, p_desde timestamptz, p_hasta timestamptz)
RETURNS TABLE (start_time timestamptz, end_time timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT a.start_time, a.end_time
    FROM public.reserva_enlaces e
    JOIN public.agenda_ajustes j ON j.clinica_id = e.clinica_id AND j.agenda_v2_encendida
    JOIN public.appointments a ON a.clinica_id = e.clinica_id AND a.medico_id = e.medico_id
   WHERE e.id = p_enlace_id AND e.clinica_id = p_clinica_id AND e.revocado_en IS NULL
     AND p_hasta > p_desde AND p_hasta - p_desde <= interval '15 days'
     AND a.start_time < p_hasta AND a.end_time > p_desde
     AND NOT a.all_day
     AND a.status NOT IN ('cancelled', 'no_show')
   ORDER BY a.start_time;
$fn$;

-- 3 · Código al correo (sólo enlace fijo). El código llega ya en HMAC.
CREATE OR REPLACE FUNCTION public.reserva_codigo_emitir(p_clinica_id uuid, p_enlace_id uuid, p_correo_hmac text, p_codigo_hmac text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_enlace_id IS NULL OR p_correo_hmac IS NULL OR p_codigo_hmac IS NULL
     OR p_correo_hmac !~ '^[0-9a-f]{64}$' OR p_codigo_hmac !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'reserva_codigo_emitir: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_enlaces e
                   JOIN public.agenda_ajustes j ON j.clinica_id = e.clinica_id AND j.agenda_v2_encendida
                  WHERE e.id = p_enlace_id AND e.clinica_id = p_clinica_id AND e.clase = 'fijo' AND e.revocado_en IS NULL)
     OR NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    RETURN 'enlace_invalido';
  END IF;
  UPDATE public.reserva_verificaciones SET intentos = 5
   WHERE clinica_id = p_clinica_id AND enlace_id = p_enlace_id AND correo_hmac = p_correo_hmac
     AND verificado_en IS NULL AND intentos < 5;
  -- clock_timestamp(): dos códigos pedidos en la misma transacción no empatan
  -- en created_at, que es por donde verificar elige el último.
  INSERT INTO public.reserva_verificaciones (clinica_id, enlace_id, correo_hmac, codigo_hmac, caduca_en, created_at)
  VALUES (p_clinica_id, p_enlace_id, p_correo_hmac, p_codigo_hmac, now() + interval '10 minutes', clock_timestamp());
  RETURN 'ok';
END
$fn$;

-- 4 · Verificar: 5 intentos por código; emite la ficha (30 min, un uso).
CREATE OR REPLACE FUNCTION public.reserva_codigo_verificar(
  p_clinica_id uuid, p_enlace_id uuid, p_correo_hmac text, p_codigo_hmac text, p_ficha_hmac text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v public.reserva_verificaciones%ROWTYPE;
BEGIN
  IF p_clinica_id IS NULL OR p_enlace_id IS NULL OR p_correo_hmac IS NULL OR p_codigo_hmac IS NULL OR p_ficha_hmac IS NULL
     OR p_ficha_hmac !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'reserva_codigo_verificar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT r.* INTO v FROM public.reserva_verificaciones r
   WHERE r.clinica_id = p_clinica_id AND r.enlace_id = p_enlace_id AND r.correo_hmac = p_correo_hmac
     AND r.verificado_en IS NULL
   ORDER BY r.created_at DESC, r.intentos ASC LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 'sin_codigo'; END IF;
  IF v.intentos >= 5 THEN RETURN 'agotado'; END IF;
  IF v.caduca_en <= now() THEN RETURN 'caducado'; END IF;
  IF v.codigo_hmac <> p_codigo_hmac THEN
    UPDATE public.reserva_verificaciones SET intentos = intentos + 1 WHERE id = v.id;
    RETURN CASE WHEN v.intentos + 1 >= 5 THEN 'agotado' ELSE 'incorrecto' END;
  END IF;
  UPDATE public.reserva_verificaciones
     SET verificado_en = now(), ficha_hmac = p_ficha_hmac, ficha_caduca_en = now() + interval '30 minutes'
   WHERE id = v.id;
  RETURN 'ok';
END
$fn$;

-- 5 · La reserva.
CREATE OR REPLACE FUNCTION public.reservar_por_enlace(
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
  v_enl   public.reserva_enlaces%ROWTYPE;
  v_aj    record;
  v_con   record;
  v_tipo  record;
  v_hist  record;
  v_verif uuid;
  v_fin   timestamptz;
  v_id    uuid;
BEGIN
  IF p_clinica_id IS NULL OR p_codigo_hash IS NULL OR p_consultorio_id IS NULL OR p_tipo_cita_id IS NULL
     OR p_inicio IS NULL OR p_nombre IS NULL OR p_telefono IS NULL OR p_correo IS NULL OR p_tel_hmac IS NULL
     OR p_correo_hmac IS NULL OR p_aviso_version IS NULL OR p_aviso_sha256 IS NULL OR p_client_id IS NULL THEN
    RAISE EXCEPTION 'reservar_por_enlace: argumentos obligatorios en NULL' USING ERRCODE = '22023';
  END IF;
  IF btrim(p_nombre) = '' OR char_length(p_nombre) > 120 OR p_telefono !~ '^[0-9]{10}$'
     OR char_length(p_correo) NOT BETWEEN 3 AND 254 OR position('@' IN p_correo) = 0
     OR p_codigo_hash !~ '^[0-9a-f]{64}$' OR p_tel_hmac !~ '^[0-9a-f]{64}$' OR p_correo_hmac !~ '^[0-9a-f]{64}$'
     OR (p_ficha_hmac IS NOT NULL AND p_ficha_hmac !~ '^[0-9a-f]{64}$')
     OR date_trunc('minute', p_inicio) <> p_inicio THEN
    RAISE EXCEPTION 'reservar_por_enlace: datos con forma inválida' USING ERRCODE = '22023';
  END IF;

  -- La garantía de un solo turno exige READ COMMITTED: cada sentencia después
  -- del candado toma una instantánea nueva y ve la reserva que ganó. En
  -- REPEATABLE READ o SERIALIZABLE la instantánea es la del inicio y el
  -- empalme no se vería. PostgREST usa READ COMMITTED; si alguien lo cambia,
  -- esto falla cerrado en vez de duplicar turnos.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'reservar_por_enlace: requiere READ COMMITTED (es %)', current_setting('transaction_isolation')
      USING ERRCODE = '25001';
  END IF;

  -- El enlace, bloqueado: dos reservas con el mismo enlace se serializan.
  SELECT e.* INTO v_enl FROM public.reserva_enlaces e
   WHERE e.codigo_hash = p_codigo_hash AND e.clinica_id = p_clinica_id
   FOR UPDATE;
  IF NOT FOUND OR v_enl.revocado_en IS NOT NULL THEN
    r_resultado := 'enlace_invalido'; RETURN NEXT; RETURN;
  END IF;

  -- Candado por médico (empalme y candado de persona en la misma sección).
  PERFORM pg_advisory_xact_lock(1790, hashtext(v_enl.medico_id::text));

  -- Idempotencia: el mismo envío ya entró.
  SELECT a.id, a.start_time, a.end_time INTO v_id, r_inicio, r_fin FROM public.appointments a
   WHERE a.client_id = p_client_id::text AND a.clinica_id = p_clinica_id AND a.reserva_enlace_id = v_enl.id;
  IF FOUND THEN
    r_resultado := 'repetida'; r_cita_id := v_id; RETURN NEXT; RETURN;
  END IF;
  r_inicio := NULL; r_fin := NULL;

  IF v_enl.clase = 'unico' AND v_enl.usado_en IS NOT NULL THEN
    r_resultado := 'enlace_usado'; RETURN NEXT; RETURN;
  END IF;
  IF v_enl.clase = 'unico' AND v_enl.caduca_en <= now() THEN
    r_resultado := 'enlace_caducado'; RETURN NEXT; RETURN;
  END IF;

  SELECT j.anticipacion_min_horas, j.horizonte_dias, j.candado_citas_activas INTO v_aj
    FROM public.agenda_ajustes j WHERE j.clinica_id = p_clinica_id AND j.agenda_v2_encendida;
  IF NOT FOUND THEN
    r_resultado := 'apagado'; RETURN NEXT; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reserva_avisos a
                  WHERE a.version = p_aviso_version AND a.texto_sha256 = p_aviso_sha256 AND a.aprobado) THEN
    r_resultado := 'aviso_no_aprobado'; RETURN NEXT; RETURN;
  END IF;
  IF NOT public.gcal_sync_clinica_habilitada(p_clinica_id) THEN
    r_resultado := 'clinica_sin_acceso'; RETURN NEXT; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = v_enl.medico_id AND p.clinica_id = p_clinica_id AND p.role = 'medico') THEN
    r_resultado := 'enlace_invalido'; RETURN NEXT; RETURN;
  END IF;

  SELECT c.id, c.nombre, c.nombre_corto, c.direccion, c.telefono, c.timezone INTO v_con
    FROM public.consultorios c
   WHERE c.id = p_consultorio_id AND c.clinica_id = p_clinica_id AND c.medico_id = v_enl.medico_id AND c.activo;
  IF NOT FOUND THEN
    r_resultado := 'consultorio_invalido'; RETURN NEXT; RETURN;
  END IF;
  SELECT t.id, t.nombre, t.duracion_min INTO v_tipo
    FROM public.tipos_cita t
   WHERE t.id = p_tipo_cita_id AND t.clinica_id = p_clinica_id AND t.activo
     AND (t.medico_id IS NULL OR t.medico_id = v_enl.medico_id);
  IF NOT FOUND THEN
    r_resultado := 'tipo_invalido'; RETURN NEXT; RETURN;
  END IF;
  v_fin := p_inicio + make_interval(mins => v_tipo.duracion_min);

  IF p_inicio < now() + make_interval(hours => v_aj.anticipacion_min_horas)
     OR p_inicio >= now() + make_interval(days => v_aj.horizonte_dias) THEN
    r_resultado := 'fuera_de_ventana'; RETURN NEXT; RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.appointments a
              WHERE a.clinica_id = p_clinica_id AND a.medico_id = v_enl.medico_id
                AND a.start_time < v_fin AND a.end_time > p_inicio
                AND NOT a.all_day AND a.status NOT IN ('cancelled', 'no_show')) THEN
    r_resultado := 'ocupado'; RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_hist FROM public.reserva_contacto_estado(p_clinica_id, v_enl.medico_id, p_tel_hmac, p_correo_hmac);

  IF v_enl.clase = 'fijo' THEN
    SELECT r.id INTO v_verif FROM public.reserva_verificaciones r
     WHERE r.ficha_hmac = p_ficha_hmac AND r.clinica_id = p_clinica_id AND r.enlace_id = v_enl.id
       AND r.correo_hmac = p_correo_hmac AND r.verificado_en IS NOT NULL AND r.consumida_en IS NULL
       AND r.ficha_caduca_en > now()
     FOR UPDATE;
    IF NOT FOUND THEN
      r_resultado := 'correo_sin_verificar'; RETURN NEXT; RETURN;
    END IF;
    IF v_hist.bloqueado THEN
      r_resultado := 'bloqueado'; RETURN NEXT; RETURN;
    END IF;
    IF (SELECT count(*) FROM public.appointments a
         WHERE a.clinica_id = p_clinica_id AND a.medico_id = v_enl.medico_id AND a.reserva_canal IS NOT NULL
           AND (a.reserva_tel_hmac = p_tel_hmac OR a.reserva_correo_hmac = p_correo_hmac)
           AND a.status IN ('scheduled', 'confirmed') AND a.end_time > now()) >= v_aj.candado_citas_activas THEN
      r_resultado := 'ya_tiene_cita'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  INSERT INTO public.appointments (
    clinica_id, paciente_id, created_by, medico_id, title, start_time, end_time, status, origen, all_day, client_id,
    gcal_sync_status,
    consultorio_id, consultorio_nombre, consultorio_nombre_corto, consultorio_direccion, consultorio_telefono,
    consultorio_timezone, tipo_cita_id, tipo_cita_nombre,
    reserva_enlace_id, reserva_canal, reserva_nombre, reserva_telefono, reserva_correo, reserva_tel_hmac,
    reserva_correo_hmac, reserva_aviso_version, reserva_aceptado_en, reserva_historial_previo)
  VALUES (
    p_clinica_id, NULL, NULL, v_enl.medico_id, btrim(p_nombre), p_inicio, v_fin, 'scheduled', 'spinus', false, p_client_id::text,
    'pending',
    v_con.id, v_con.nombre, v_con.nombre_corto, v_con.direccion, v_con.telefono, v_con.timezone, v_tipo.id, v_tipo.nombre,
    v_enl.id, v_enl.clase, btrim(p_nombre), p_telefono, btrim(p_correo), p_tel_hmac,
    p_correo_hmac, p_aviso_version, now(), coalesce(v_hist.cancelaciones, 0) + coalesce(v_hist.no_shows, 0))
  RETURNING id INTO v_id;

  IF v_enl.clase = 'unico' THEN
    UPDATE public.reserva_enlaces SET usado_en = now(), usado_cita_id = v_id
     WHERE id = v_enl.id AND clinica_id = p_clinica_id;
  ELSE
    UPDATE public.reserva_verificaciones SET consumida_en = now() WHERE id = v_verif;
  END IF;

  -- Además de cita_alta ('system') de log_cita_change: quién fue el canal. Sin datos personales.
  INSERT INTO public.audit_log (user_id, accion, tabla, registro_id, descripcion)
  VALUES ('system', 'cita_reservada_enlace', 'appointments', v_id,
          jsonb_build_object('clinica_id', p_clinica_id, 'enlace_id', v_enl.id, 'canal', v_enl.clase,
                             'aviso', p_aviso_version)::text);

  r_resultado := 'ok'; r_cita_id := v_id; r_inicio := p_inicio; r_fin := v_fin;
  r_historial := coalesce(v_hist.cancelaciones, 0) + coalesce(v_hist.no_shows, 0);
  RETURN NEXT;
END
$fn$;

-- Permisos de funciones: SOLO service_role, justificado: son la escritura y
-- la lectura de la página pública, sin sesión; la consola y las sesiones de
-- la app no deben poder escribir citas por aquí saltándose la RLS.
REVOKE EXECUTE ON FUNCTION public.reserva_contexto(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_contexto(text, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_ocupacion(uuid, uuid, timestamptz, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reserva_codigo_emitir(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_codigo_emitir(uuid, uuid, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reserva_codigo_verificar(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserva_codigo_verificar(uuid, uuid, text, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) TO service_role;

COMMENT ON FUNCTION public.reservar_por_enlace(uuid, text, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, uuid) IS
  'Reserva por enlace (D3). Sólo service_role. Serializa por enlace (FOR UPDATE) y por médico (advisory 1790). CONVENIO: horario del consultorio y alineación del turno (P9) los comprueba el servidor antes de llamar (src/lib/reserva/turnosReserva.ts, ruta pública de D5); un llamador que no lo haga puede reservar fuera de horario sin que la base lo note. Devuelve UNA fila: usar .single().';

COMMIT;

SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'reserva_verificaciones: RLS / policies' AS comprobacion,
         coalesce((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.reserva_verificaciones')), 'AUSENTE')
         || ' / ' || (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reserva_verificaciones') AS valor,
         'true / 0' AS esperado
  UNION ALL
  SELECT 2, 'privilegios anon / authenticated / service_role',
         coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'reserva_verificaciones' AND grantee = 'anon'), '-') || ' / '
         || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'reserva_verificaciones' AND grantee = 'authenticated'), '-') || ' / '
         || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'reserva_verificaciones' AND grantee = 'service_role'), '-'),
         '- / - / INSERT,SELECT,UPDATE'
  UNION ALL
  SELECT 3, 'las 5 funciones: invoker y EXECUTE sólo service_role',
         (SELECT string_agg(p.proname || '=' || p.prosecdef::text || '/' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
                  || ',' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text || ','
                  || has_function_privilege('service_role', p.oid, 'EXECUTE')::text, ' ; ' ORDER BY p.proname)
            FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname IN ('reserva_contexto', 'reserva_ocupacion', 'reserva_codigo_emitir', 'reserva_codigo_verificar', 'reservar_por_enlace')),
         'reserva_codigo_emitir=false/false,false,true ; reserva_codigo_verificar=false/false,false,true ; reserva_contexto=false/false,false,true ; reserva_ocupacion=false/false,false,true ; reservar_por_enlace=false/false,false,true'
  UNION ALL
  SELECT 4, 'puerta S3 presente / service_role BYPASSRLS',
         (to_regprocedure('public.gcal_sync_clinica_habilitada(uuid)') IS NOT NULL)::text || ' / '
         || (SELECT rolbypassrls::text FROM pg_roles WHERE rolname = 'service_role'),
         'true / true'
  UNION ALL
  SELECT 5, 'ninguna SECURITY DEFINER escribe agenda_ajustes',
         (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
           AND p.prosrc ~* '(insert\s+into|update)\s+(public\.)?agenda_ajustes'),
         '0'
  UNION ALL
  SELECT 6, 'las 5 policies de appointments, intactas',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'appointments'), '5'
) t
ORDER BY t.n;
