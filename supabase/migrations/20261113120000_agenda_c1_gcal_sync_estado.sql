-- ═══════════════════════════════════════════════════════════════════════
-- Agenda C1 — estado de la sincronización con Google por clínica: token,
-- página pendiente, candado (lease), listado para el cron y la puerta de
-- acceso de la clínica evaluada sin sesión (S3)
-- Rama: feature/agenda-v2-c · Escrita: 2026-11-13
-- Riesgo estimado: BAJO (tabla nueva y vacía; seis funciones nuevas sólo para
-- service_role; ninguna tabla, policy, función ni permiso existente se toca).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA Y VERIFICADA — 2026-11-13
--   `docker exec -i supabase_db_app_ortointegra psql -U postgres
--   -v ON_ERROR_STOP=1 -f` del archivo completo (rejilla: 9 × OK + 1 INFO,
--   0 filas), y una segunda pasada: misma rejilla, sólo el NOTICE «relation
--   "gcal_sync_estado" already exists, skipping», y no-op comprobado
--   comparando antes y después definición (md5), proacl y COMMENT de las seis
--   funciones y de log_cita_change, clinica_tiene_acceso y
--   clinica_no_suspendida; relacl, RLS y COMMENT de la tabla; columnas con
--   DEFAULT y COMMENT; constraints; disparadores y policies de appointments;
--   count(*) de audit_log y de la tabla (sin diferencias). Anotada a mano en
--   supabase_migrations.schema_migrations (versión 20261113120000), por la
--   misma razón que B0 y B1.
--   Pruebas: supabase/pruebas-sql/c1_gcal_sync_estado.sql
--   (bash scripts/pruebas-sql.sh).
--   Comprobación:
--     select count(*) from pg_proc where pronamespace = 'public'::regnamespace
--        and proname like 'gcal\_sync\_%' and not prosecdef;
--   → 6.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de A1.8, B0 y B1).
-- AUDITORÍA INDEPENDIENTE 2026-11-13: APTA CON CAMBIOS
-- (supabase/AUDITORIA-MIGRACIONES.md). Aplicado antes del commit: el
-- pre-vuelo comprueba también el dueño de las seis funciones en un replay; la
-- prueba muta la original en un savepoint (caso 12) y cubre argumentos NULL y
-- el tope de 1 h de la espera. NO aplicado, a propósito: escribir el aviso del
-- acoplamiento en el COMMENT de clinica_tiene_acceso() y de
-- clinica_no_suspendida() (S3 prohíbe modificarlas; ver «ACOPLAMIENTO A LA
-- FORMA» abajo). Notas: la sustitución es de texto y no distingue un literal
-- o un comentario que contenga `public.get_clinica_id()` (lo más probable es
-- un error de sintaxis: cerrado); dimensión 19 propuesta por el auditor
-- (acoplamiento textual a la fuente de otro objeto), sin añadir al archivo de
-- auditoría, que no se modifica.
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Bloque C de mejora_agendaV2.md: lectura incremental del calendario Spinus
-- con events.list + syncToken. Aquí viven, UNA fila por clínica, el
-- nextSyncToken, la página pendiente de una pasada a medias, la ventana de la
-- sincronización completa (el MISMO timeMin en cada página) y el candado.
-- Tabla propia y NO columnas en clinica_conexiones_google: esa tabla la
-- escribe sólo src/lib/gcalConexion.ts (cerrojoGcalConexion.test.ts), su
-- policy de SELECT la abre a toda la clínica, y toda columna de public se
-- presume leída por spinus-consola.
-- SIN FK a la conexión, a propósito: borrarConexion() no debe fallar por
-- esto. Una fila cuya (conexion_id, calendar_id) no sea la vigente se
-- reinicia sola en gcal_sync_tomar: el token de otro calendario no sirve.
-- Sin datos de pacientes: ids, un cursor opaco de Google, fechas y un código
-- de error corto que compone el código (NUNCA texto que venga de Google).
-- Sin disparador de auditoría: no es dato sensible y se escribe en cada
-- sondeo; en audit_log (inmutable) sería ruido.
-- Candado = lease con testigo: tomar entrega un uuid y una caducidad;
-- avanzar/reiniciar sólo prenden con ese uuid y ANTES de caducar. No se usan
-- advisory locks: PostgREST no conserva la sesión entre llamadas.
-- TODAS las funciones son SECURITY INVOKER y sólo las ejecuta service_role
-- (BYPASSRLS, comprobado en el pre-vuelo). Ninguna es SECURITY DEFINER y
-- ninguna ESCRIBE en agenda_ajustes (aviso de la auditoría de B1): sólo la leen.
-- Toda función recibe p_clinica_id y filtra por él en cada sentencia, salvo
-- gcal_sync_clinicas_pendientes, que es el listado del cron (sin secretos) y
-- la ÚNICA lectura entre clínicas del bloque.
--
-- ═══ S3 · LA PUERTA DE ACCESO SIN SESIÓN ═══════════════════════════════
-- Decisión de Angel (mejora_agendaV2.md §6-bis, S3): NO se suplantan claims
-- ni rol; función aparte con p_clinica_id, sólo service_role, SIN modificar
-- clinica_tiene_acceso() ni ninguna policy, y el mismo veredicto que la
-- original para VIP, suscripción activa, free virgen y free degradada.
-- Cómo, SIN COPIAR el predicado de RN-1 (es contrato con spinus-consola):
-- gcal_sync_clinica_habilitada lee en cada llamada el cuerpo VIGENTE de
-- clinica_no_suspendida() y de clinica_tiene_acceso() desde pg_proc,
-- sustituye su única fuente de sesión, `public.get_clinica_id()`, por el
-- parámetro ($1, con USING: nada del texto lo pone quien llama) y lo ejecuta.
-- La regla vive en un solo sitio: si la consola cambia RN-1, esto evalúa la
-- regla nueva sin tocar este archivo. Falla CERRADO y RUIDOSO: si alguna de
-- las dos deja de ser `LANGUAGE sql` de una sola sentencia SELECT que
-- devuelve boolean, o si tras sustituir queda cualquier otra fuente de sesión
-- (auth.*, current_setting, request.jwt, current_user, ...), lanza en vez de
-- adivinar. El paso 4 lo comprueba antes del COMMIT, así que una base cuya
-- puerta ya no tenga esa forma aborta la migración entera.
-- Se evalúan las DOS puertas del INSERT de appointments
-- (appointments_gates_insert): clinica_no_suspendida() Y clinica_tiene_acceso().
-- perfil_completo(), la tercera, no aplica: es del usuario que escribe, y aquí
-- no hay usuario.
-- ⚠️ ACOPLAMIENTO A LA FORMA (lo marcó la auditoría): quien reescriba
-- clinica_tiene_acceso() o clinica_no_suspendida() cambiando su FORMA (pasarla
-- a plpgsql, partirla en dos sentencias, escribir get_clinica_id() sin
-- `public.`, o mencionar `public.get_clinica_id()` dentro de un literal o un
-- comentario) sin cambiar su lógica hace que ESTA función lance en cada
-- llamada: la sincronización con Google se detiene (cerrada, sin dañar datos)
-- hasta revisar C1. El aviso no se escribe en el COMMENT de las originales a
-- propósito: S3 prohíbe modificarlas, y un COMMENT ON es una sentencia sobre
-- ellas. Por eso lo cubren la prueba c1_gcal_sync_estado.sql (caso 12, que
-- muta la original en un savepoint y comprueba las dos cosas: que la nueva
-- SIGUE la lógica nueva y que una forma desconocida lanza P0001) y la nota
-- para Angel en mejora_agendaV2.md §6-bis.
-- NOTA para la auditoría final: CLAUDE.md de feature/limites-ajustables
-- describe RN-1 con una cláusula más («o 5 pacientes o menos contando los
-- dados de baja») que NO está en la función de esta rama ni en la base local
-- (comprobado con pg_get_functiondef el 2026-11-13). Aquí manda la vigente; y
-- como no se copia, si esa cláusula llega, esta función la hereda.
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Bloqueos: CREATE TABLE con FK toma SHARE ROW EXCLUSIVE sobre clinicas un
-- instante (bloquea escrituras en clinicas, no lecturas). lock_timeout 5 s.
-- Orden respecto al código: PRIMERO esta migración. El código viejo no la
-- lee; el nuevo sin ella falla al llamar la RPC y no sincroniza (cerrado).
-- Alcance de los roles:
--   gana   — service_role: SELECT/INSERT/UPDATE en esta tabla y EXECUTE de
--            las seis funciones.
--   pierde — anon y authenticated: los privilegios por omisión de Supabase
--            sobre esta tabla (sin uso); service_role: DELETE, TRUNCATE,
--            REFERENCES y TRIGGER sobre ella. Sobre las demás tablas y
--            funciones nadie gana ni pierde nada.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP FUNCTION IF EXISTS public.gcal_sync_tomar(uuid, uuid, text, integer, integer);
--   DROP FUNCTION IF EXISTS public.gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer);
--   DROP FUNCTION IF EXISTS public.gcal_sync_reiniciar(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.gcal_sync_soltar(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.gcal_sync_clinicas_pendientes(integer);
--   DROP FUNCTION IF EXISTS public.gcal_sync_clinica_habilitada(uuid);
--   DROP TABLE IF EXISTS public.gcal_sync_estado;
-- (C2 depende de gcal_sync_clinica_habilitada: revertir C2 antes.)
-- Sólo se pierden tokens: la siguiente pasada hace una sincronización completa.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de crear nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_cols text[];
  c_esperadas CONSTANT text[] := ARRAY['id', 'clinica_id', 'conexion_id', 'calendar_id', 'fase', 'sync_token',
    'page_token', 'ventana_desde', 'candado', 'candado_hasta', 'ultima_ok', 'ultimo_intento', 'ultimo_error',
    'errores_seguidos', 'completas', 'created_at', 'updated_at'];
  v_fn regprocedure;
BEGIN
  IF to_regclass('public.clinicas') IS NULL OR to_regclass('public.agenda_ajustes') IS NULL
     OR to_regclass('public.clinica_conexiones_google') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.clinicas, public.agenda_ajustes (B1) o public.clinica_conexiones_google.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute
       WHERE attrelid = 'public.clinica_conexiones_google'::regclass AND attnum > 0 AND NOT attisdropped
         AND attname IN ('id', 'clinica_id', 'user_id', 'rol', 'estado', 'calendar_id', 'google_account_email')) <> 7 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: clinica_conexiones_google no tiene la forma esperada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.agenda_ajustes'::regclass
                  AND attname = 'agenda_v2_encendida' AND atttypid = 'boolean'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta agenda_ajustes.agenda_v2_encendida (B1).';
  END IF;
  IF to_regprocedure('public.get_clinica_id()') IS NULL OR to_regprocedure('public.clinica_no_suspendida()') IS NULL
     OR to_regprocedure('public.clinica_tiene_acceso()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta get_clinica_id(), clinica_no_suspendida() o clinica_tiene_acceso().';
  END IF;
  IF NOT coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'), false) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no tiene BYPASSRLS; las RPC invoker no verían las filas.';
  END IF;
  IF NOT (has_table_privilege('service_role', 'public.agenda_ajustes', 'SELECT')
          AND has_table_privilege('service_role', 'public.clinica_conexiones_google', 'SELECT')
          AND has_table_privilege('service_role', 'public.clinicas', 'SELECT')) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: service_role no puede leer agenda_ajustes, clinica_conexiones_google o clinicas.';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.clinicas'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.clinicas; la FK no se podría crear.', current_user;
  END IF;
  -- Replay: CREATE TABLE IF NOT EXISTS mira sólo el nombre.
  IF to_regclass('public.gcal_sync_estado') IS NOT NULL THEN
    SELECT array_agg(attname::text) INTO v_cols FROM pg_attribute
     WHERE attrelid = 'public.gcal_sync_estado'::regclass AND attnum > 0 AND NOT attisdropped;
    IF NOT (v_cols @> c_esperadas AND v_cols <@ c_esperadas) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.gcal_sync_estado ya existe con OTRAS columnas (%). No se toca.', v_cols;
    END IF;
    IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.gcal_sync_estado'::regclass), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.gcal_sync_estado existe y no es de %.', current_user;
    END IF;
  END IF;
  -- CREATE OR REPLACE no convierte una DEFINER en INVOKER: si existe, que no lo sea.
  FOREACH v_fn IN ARRAY ARRAY[
      to_regprocedure('public.gcal_sync_tomar(uuid, uuid, text, integer, integer)'),
      to_regprocedure('public.gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer)'),
      to_regprocedure('public.gcal_sync_reiniciar(uuid, uuid)'),
      to_regprocedure('public.gcal_sync_soltar(uuid, uuid, text)'),
      to_regprocedure('public.gcal_sync_clinicas_pendientes(integer)'),
      to_regprocedure('public.gcal_sync_clinica_habilitada(uuid)')] LOOP
    IF v_fn IS NOT NULL AND (SELECT prosecdef FROM pg_proc WHERE oid = v_fn) THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % existe como SECURITY DEFINER; tiene que ser invoker.', v_fn;
    END IF;
    IF v_fn IS NOT NULL AND NOT pg_has_role(current_user, (SELECT proowner FROM pg_proc WHERE oid = v_fn), 'USAGE') THEN
      RAISE EXCEPTION 'PRE-VUELO FALLÓ: % existe y no es de %.', v_fn, current_user;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2 · La tabla, sus permisos y su RLS (sin policies: ninguna sesión la lee).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gcal_sync_estado (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id       uuid        NOT NULL,
  conexion_id      uuid        NOT NULL,
  calendar_id      text        NOT NULL,
  fase             text        NOT NULL DEFAULT 'completa',
  sync_token       text,
  page_token       text,
  ventana_desde    timestamptz,
  candado          uuid,
  candado_hasta    timestamptz,
  ultima_ok        timestamptz,
  ultimo_intento   timestamptz,
  ultimo_error     text,
  errores_seguidos integer     NOT NULL DEFAULT 0,
  completas        integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gcal_sync_estado_pkey PRIMARY KEY (id),
  CONSTRAINT gcal_sync_estado_clinica_key UNIQUE (clinica_id),
  CONSTRAINT gcal_sync_estado_clinica_id_fkey FOREIGN KEY (clinica_id)
    REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT gcal_sync_estado_fase_check CHECK (fase IN ('completa', 'incremental')),
  CONSTRAINT gcal_sync_estado_incremental_con_token CHECK (fase = 'completa' OR sync_token IS NOT NULL),
  CONSTRAINT gcal_sync_estado_candado_par CHECK ((candado IS NULL) = (candado_hasta IS NULL)),
  CONSTRAINT gcal_sync_estado_error_corto CHECK (ultimo_error IS NULL OR length(ultimo_error) <= 300),
  CONSTRAINT gcal_sync_estado_contadores CHECK (errores_seguidos >= 0 AND completas >= 0)
);

ALTER TABLE public.gcal_sync_estado ENABLE ROW LEVEL SECURITY;
-- Los privilegios por omisión de Supabase dan ALL a anon, authenticated y service_role.
REVOKE ALL ON TABLE public.gcal_sync_estado FROM anon, authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.gcal_sync_estado FROM service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.gcal_sync_estado TO service_role;

COMMENT ON TABLE public.gcal_sync_estado IS
  'Estado de la sincronización incremental con Google por clínica (bloque C). Sólo service_role, sólo vía gcal_sync_*. Sin FK a la conexión: si (conexion_id, calendar_id) no es la vigente, gcal_sync_tomar reinicia el token. ultimo_error lo compone el código, nunca texto de Google.';
COMMENT ON COLUMN public.gcal_sync_estado.ventana_desde IS
  'timeMin de la sincronización COMPLETA en curso o de la última; se repite idéntico en cada página. Las incrementales no lo mandan (Google lo prohíbe con syncToken) y el código lo usa para no importar eventos que terminan antes.';

-- ---------------------------------------------------------------------
-- 3 · Las funciones. INVOKER, search_path vacío, sólo service_role.
-- ---------------------------------------------------------------------

-- Toma el candado de ESTA clínica si su interruptor está encendido, si la
-- conexión es la activa de esa clínica con ese calendario, si nadie lo tiene,
-- si no se sondeó hace poco (salvo página pendiente) y si no está en espera
-- por errores seguidos (30 s · 2^n, tope 1 h). Cero filas = no toca.
CREATE OR REPLACE FUNCTION public.gcal_sync_tomar(
  p_clinica_id uuid, p_conexion_id uuid, p_calendar_id text,
  p_lease_seg integer, p_min_intervalo_seg integer)
RETURNS TABLE (r_candado uuid, r_fase text, r_sync_token text, r_page_token text, r_ventana_desde timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_conexion_id IS NULL OR p_calendar_id IS NULL
     OR p_lease_seg IS NULL OR p_lease_seg NOT BETWEEN 10 AND 900
     OR p_min_intervalo_seg IS NULL OR p_min_intervalo_seg NOT BETWEEN 0 AND 86400 THEN
    RAISE EXCEPTION 'gcal_sync_tomar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  -- Detrás del interruptor (B1). agenda_ajustes sólo se LEE.
  IF NOT EXISTS (SELECT 1 FROM public.agenda_ajustes a
                  WHERE a.clinica_id = p_clinica_id AND a.agenda_v2_encendida) THEN
    RETURN;
  END IF;
  -- LA conexión de esta clínica, activa, con ESE calendario.
  IF NOT EXISTS (SELECT 1 FROM public.clinica_conexiones_google g
                  WHERE g.id = p_conexion_id AND g.clinica_id = p_clinica_id
                    AND g.rol = 'clinica' AND g.estado = 'activa' AND g.calendar_id = p_calendar_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.gcal_sync_estado (clinica_id, conexion_id, calendar_id)
  VALUES (p_clinica_id, p_conexion_id, p_calendar_id)
  ON CONFLICT ON CONSTRAINT gcal_sync_estado_clinica_key DO NOTHING;

  -- Otra conexión u otro calendario: su token no vale aquí. Sólo sin candado vivo.
  UPDATE public.gcal_sync_estado e
     SET conexion_id = p_conexion_id, calendar_id = p_calendar_id, fase = 'completa',
         sync_token = NULL, page_token = NULL, ventana_desde = NULL, updated_at = now()
   WHERE e.clinica_id = p_clinica_id
     AND (e.conexion_id, e.calendar_id) IS DISTINCT FROM (p_conexion_id, p_calendar_id)
     AND (e.candado_hasta IS NULL OR e.candado_hasta < now());

  RETURN QUERY
  UPDATE public.gcal_sync_estado e
     SET candado = gen_random_uuid(),
         candado_hasta = now() + make_interval(secs => p_lease_seg),
         ultimo_intento = now(),
         updated_at = now()
   WHERE e.clinica_id = p_clinica_id
     AND e.conexion_id = p_conexion_id
     AND e.calendar_id = p_calendar_id
     AND (e.candado_hasta IS NULL OR e.candado_hasta < now())
     AND (e.page_token IS NOT NULL OR e.ultima_ok IS NULL
          OR e.ultima_ok <= now() - make_interval(secs => p_min_intervalo_seg))
     AND (e.errores_seguidos = 0 OR e.ultimo_intento IS NULL
          OR e.ultimo_intento < now() - make_interval(secs => least(3600, 30 * (2 ^ least(e.errores_seguidos, 7)))::integer))
  RETURNING e.candado, e.fase, e.sync_token, e.page_token, e.ventana_desde;
END
$fn$;

-- Una página aplicada: o hay página siguiente (se guarda y se alarga el
-- candado) o hay token final (pasa a incremental, se suelta el candado).
CREATE OR REPLACE FUNCTION public.gcal_sync_avanzar(
  p_clinica_id uuid, p_candado uuid, p_page_token text, p_sync_token text,
  p_ventana_desde timestamptz, p_lease_seg integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_candado IS NULL OR p_lease_seg IS NULL OR p_lease_seg NOT BETWEEN 10 AND 900 THEN
    RAISE EXCEPTION 'gcal_sync_avanzar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  IF (p_page_token IS NULL) = (p_sync_token IS NULL) THEN
    RAISE EXCEPTION 'gcal_sync_avanzar: o página siguiente o token final, exactamente uno' USING ERRCODE = '22023';
  END IF;
  UPDATE public.gcal_sync_estado e
     SET page_token       = p_page_token,
         ventana_desde    = CASE WHEN e.fase = 'completa' THEN coalesce(e.ventana_desde, p_ventana_desde)
                                 ELSE e.ventana_desde END,
         sync_token       = coalesce(p_sync_token, e.sync_token),
         fase             = CASE WHEN p_sync_token IS NOT NULL THEN 'incremental' ELSE e.fase END,
         ultima_ok        = CASE WHEN p_sync_token IS NOT NULL THEN now() ELSE e.ultima_ok END,
         errores_seguidos = CASE WHEN p_sync_token IS NOT NULL THEN 0 ELSE e.errores_seguidos END,
         ultimo_error     = CASE WHEN p_sync_token IS NOT NULL THEN NULL ELSE e.ultimo_error END,
         candado          = CASE WHEN p_sync_token IS NOT NULL THEN NULL ELSE e.candado END,
         candado_hasta    = CASE WHEN p_sync_token IS NOT NULL THEN NULL
                                 ELSE now() + make_interval(secs => p_lease_seg) END,
         updated_at       = now()
   WHERE e.clinica_id = p_clinica_id AND e.candado = p_candado AND e.candado_hasta > now();
  RETURN FOUND;
END
$fn$;

-- 410 de Google: el token murió. Se vuelve a completa SIN soltar el candado.
CREATE OR REPLACE FUNCTION public.gcal_sync_reiniciar(p_clinica_id uuid, p_candado uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_candado IS NULL THEN
    RAISE EXCEPTION 'gcal_sync_reiniciar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  UPDATE public.gcal_sync_estado e
     SET fase = 'completa', sync_token = NULL, page_token = NULL, ventana_desde = NULL,
         completas = e.completas + 1, updated_at = now()
   WHERE e.clinica_id = p_clinica_id AND e.candado = p_candado AND e.candado_hasta > now();
  RETURN FOUND;
END
$fn$;

-- Suelta el candado: por error (p_error = código corto) o por presupuesto
-- agotado a mitad (p_error NULL; la página pendiente se conserva).
CREATE OR REPLACE FUNCTION public.gcal_sync_soltar(p_clinica_id uuid, p_candado uuid, p_error text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF p_clinica_id IS NULL OR p_candado IS NULL THEN
    RAISE EXCEPTION 'gcal_sync_soltar: argumentos inválidos' USING ERRCODE = '22023';
  END IF;
  UPDATE public.gcal_sync_estado e
     SET candado = NULL, candado_hasta = NULL,
         ultimo_error     = CASE WHEN p_error IS NULL THEN e.ultimo_error ELSE left(p_error, 300) END,
         errores_seguidos = CASE WHEN p_error IS NULL THEN e.errores_seguidos ELSE e.errores_seguidos + 1 END,
         updated_at = now()
   WHERE e.clinica_id = p_clinica_id AND e.candado = p_candado;
  RETURN FOUND;
END
$fn$;

-- ⚠️ LA ÚNICA LECTURA ENTRE CLÍNICAS DEL BLOQUE, y es a propósito: el cron
-- tiene que saber a quién sondear. Sin secretos; sólo el descriptor.
CREATE OR REPLACE FUNCTION public.gcal_sync_clinicas_pendientes(p_limite integer)
RETURNS TABLE (r_conexion_id uuid, r_clinica_id uuid, r_user_id uuid, r_calendar_id text, r_google_account_email text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT g.id, g.clinica_id, g.user_id, g.calendar_id, g.google_account_email
    FROM public.clinica_conexiones_google g
    JOIN public.agenda_ajustes a ON a.clinica_id = g.clinica_id AND a.agenda_v2_encendida
    LEFT JOIN public.gcal_sync_estado e ON e.clinica_id = g.clinica_id
   WHERE g.rol = 'clinica' AND g.estado = 'activa' AND g.calendar_id IS NOT NULL
     AND (e.candado_hasta IS NULL OR e.candado_hasta < now())
   ORDER BY e.ultima_ok ASC NULLS FIRST, g.clinica_id
   LIMIT least(greatest(coalesce(p_limite, 1), 1), 100);
$fn$;

-- S3 (ver la cabecera): la puerta de acceso de UNA clínica sin sesión, sin
-- suplantar a nadie y sin copiar RN-1. Evalúa el cuerpo vigente de las dos
-- puertas del INSERT de appointments con get_clinica_id() sustituido por el
-- parámetro. Lanza si la forma de alguna ya no es la que se sabe sustituir.
CREATE OR REPLACE FUNCTION public.gcal_sync_clinica_habilitada(p_clinica_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  c_puertas CONSTANT text[] := ARRAY['public.clinica_no_suspendida()', 'public.clinica_tiene_acceso()'];
  c_fuente  CONSTANT text   := 'public.get_clinica_id()';
  v_puerta text;
  v_src    text;
  v_sql    text;
  v_ok     boolean;
BEGIN
  IF p_clinica_id IS NULL THEN
    RAISE EXCEPTION 'gcal_sync_clinica_habilitada: clínica en NULL' USING ERRCODE = '22023';
  END IF;
  FOREACH v_puerta IN ARRAY c_puertas LOOP
    v_src := NULL;
    SELECT p.prosrc INTO v_src
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid = p.prolang
     WHERE p.oid = to_regprocedure(v_puerta) AND l.lanname = 'sql'
       AND p.prorettype = 'pg_catalog.bool'::pg_catalog.regtype AND NOT p.proretset;
    v_sql := btrim(replace(v_src, c_fuente, '$1'), E' \t\r\n;');
    IF v_src IS NULL OR strpos(v_src, c_fuente) = 0 OR v_sql !~* '^select\s'
       OR v_sql ~* '(get_clinica_id|auth\.|current_setting|request\.jwt|current_user|session_user|current_role|set_config|;)' THEN
      RAISE EXCEPTION 'gcal_sync_clinica_habilitada: % ya no tiene la forma que se sabe evaluar por clínica', v_puerta
        USING ERRCODE = 'P0001', HINT = 'Revisar C1 (20261113120000) contra la definición nueva; no se adivina.';
    END IF;
    EXECUTE v_sql INTO v_ok USING p_clinica_id;
    IF v_ok IS NOT TRUE THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END
$fn$;

-- Permisos de funciones (CLAUDE.md): SOLO service_role. La consola y las
-- sesiones de la app no deben poder mover el token, el candado ni leer la
-- puerta de otra clínica; por eso el revoke incluye anon y authenticated.
REVOKE EXECUTE ON FUNCTION public.gcal_sync_tomar(uuid, uuid, text, integer, integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_tomar(uuid, uuid, text, integer, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_sync_reiniciar(uuid, uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_reiniciar(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_sync_soltar(uuid, uuid, text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_soltar(uuid, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_sync_clinicas_pendientes(integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_clinicas_pendientes(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.gcal_sync_clinica_habilitada(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gcal_sync_clinica_habilitada(uuid) TO service_role;

COMMENT ON FUNCTION public.gcal_sync_clinica_habilitada(uuid) IS
  'S3: clinica_no_suspendida() Y clinica_tiene_acceso() para la clínica dada, sin sesión. NO copia RN-1: ejecuta el cuerpo vigente de las dos con public.get_clinica_id() sustituido por el parámetro, y lanza si su forma cambia. Sólo service_role.';

-- ---------------------------------------------------------------------
-- 4 · La puerta tiene que saber evaluarse en ESTA base, antes del COMMIT.
--     Una clínica que no existe da false, nunca error.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF public.gcal_sync_clinica_habilitada('00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'POST-VUELO FALLÓ: la puerta dio true para una clínica inexistente.';
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- 5 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'gcal_sync_estado existe / RLS activa' AS comprobacion,
         coalesce((SELECT 'sí / ' || relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.gcal_sync_estado')), 'AUSENTE') AS valor,
         'sí / true' AS esperado
  UNION ALL
  SELECT 2, 'policies (ninguna)',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gcal_sync_estado'), '0'
  UNION ALL
  SELECT 3, 'privilegios anon / authenticated / service_role',
         coalesce((SELECT coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                                     WHERE table_schema = 'public' AND table_name = 'gcal_sync_estado' AND grantee = 'anon'), '-')
                  || ' / ' || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                                     WHERE table_schema = 'public' AND table_name = 'gcal_sync_estado' AND grantee = 'authenticated'), '-')
                  || ' / ' || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                                     WHERE table_schema = 'public' AND table_name = 'gcal_sync_estado' AND grantee = 'service_role'), '-')
                    WHERE to_regclass('public.gcal_sync_estado') IS NOT NULL), 'AUSENTE'),
         '- / - / INSERT,SELECT,UPDATE'
  UNION ALL
  SELECT 4, 'FK a clinicas es RESTRICT',
         coalesce((SELECT confdeltype::text FROM pg_constraint WHERE conrelid = to_regclass('public.gcal_sync_estado')
                    AND conname = 'gcal_sync_estado_clinica_id_fkey'), 'AUSENTE'), 'r'
  UNION ALL
  SELECT 5, 'CHECK', (SELECT count(*)::text FROM pg_constraint WHERE conrelid = to_regclass('public.gcal_sync_estado') AND contype = 'c'), '5'
  UNION ALL
  SELECT 6, 'funciones INVOKER con search_path vacío (de 6)',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.gcal_sync_tomar(uuid, uuid, text, integer, integer)'),
                           to_regprocedure('public.gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer)'),
                           to_regprocedure('public.gcal_sync_reiniciar(uuid, uuid)'),
                           to_regprocedure('public.gcal_sync_soltar(uuid, uuid, text)'),
                           to_regprocedure('public.gcal_sync_clinicas_pendientes(integer)'),
                           to_regprocedure('public.gcal_sync_clinica_habilitada(uuid)'))
             AND NOT p.prosecdef AND p.proconfig @> ARRAY['search_path=""']),
         '6'
  UNION ALL
  SELECT 7, 'EXECUTE sólo service_role (PUBLIC, anon, authenticated sin) (de 6)',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.gcal_sync_tomar(uuid, uuid, text, integer, integer)'),
                           to_regprocedure('public.gcal_sync_avanzar(uuid, uuid, text, text, timestamptz, integer)'),
                           to_regprocedure('public.gcal_sync_reiniciar(uuid, uuid)'),
                           to_regprocedure('public.gcal_sync_soltar(uuid, uuid, text)'),
                           to_regprocedure('public.gcal_sync_clinicas_pendientes(integer)'),
                           to_regprocedure('public.gcal_sync_clinica_habilitada(uuid)'))
             AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                              WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
             AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
             AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
             AND has_function_privilege('service_role', p.oid, 'EXECUTE')),
         '6'
  UNION ALL
  SELECT 8, 'service_role con BYPASSRLS',
         coalesce((SELECT rolbypassrls::text FROM pg_roles WHERE rolname = 'service_role'), 'AUSENTE'), 'true'
  UNION ALL
  SELECT 9, 'clinica_tiene_acceso / clinica_no_suspendida: siguen DEFINER (no se tocaron)',
         (SELECT string_agg(p.prosecdef::text, ' / ' ORDER BY p.proname) FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.clinica_no_suspendida()'), to_regprocedure('public.clinica_tiene_acceso()'))),
         'true / true'
  UNION ALL
  SELECT 10, 'filas (clínicas con estado)', (SELECT count(*)::text FROM public.gcal_sync_estado), NULL
) t
ORDER BY t.n;
