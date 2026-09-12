-- ============================================================================
-- PENDIENTE DE APLICAR — parte A de 2. La ejecuta Angel a mano.
-- ============================================================================
-- Calendario propio de Spinus en Google (Rama 1) — CAMBIOS DE ESQUEMA
--
-- Este archivo es puramente ADITIVO y compatible hacia atrás: el código que
-- hay hoy en producción sigue funcionando igual con él aplicado. Por eso va
-- ANTES del deploy.
--
-- Lo que NO está aquí y sí estaba en el borrador original: soltar los
-- `google_event_id` y borrar los tokens. Esas dos son incompatibles con el
-- código viejo y viven en el archivo B, que se aplica DESPUÉS del deploy.
-- Si se aplican antes, el médico se ve desconectado mientras el código viejo
-- sigue arriba, reconecta contra el scope sensible, y queda con un token
-- inservible que la app ya no vuelve a pedir. Ver runbook en el archivo B.
--
-- ── QUÉ CAMBIA ──────────────────────────────────────────────────────────────
--
--   google_tokens.calendar_id    Dónde vive el calendario de Spinus de cada
--                                médico. Null = todavía no se ha creado; el
--                                helper de servidor lo crea al primer uso.
--
--   appointments.origen          De qué lado nació la cita ('spinus'|'google').
--                                Sólo se escribe 'spinus' hasta la Rama 2.
--
--   appointments.gcal_etag       Lo último que Spinus escribió en Google. No
--                                se usa hasta la Rama 2; entra ahora para no
--                                hacer dos migraciones.
--
--   gcal_sync_status 'unbound'   Estado nuevo: hubo un evento en Google y el
--                                vínculo se perdió sin vuelta atrás. La cita
--                                se conserva. Lo escribe `desvincularCitas`
--                                en src/lib/gcal.ts, así que el CHECK tiene
--                                que existir ANTES de que suba ese código.
-- ============================================================================

-- ── PRE-VUELO (correr aparte, leer el resultado, NO forma parte del archivo) ─
--
--   -- ¿Hay grants a nivel de columna? Si los hay, las columnas nuevas nacen
--   -- invisibles para el cliente y hay que concederlas a mano.
--   SELECT grantee, table_name, count(*)
--     FROM information_schema.column_privileges
--    WHERE table_schema = 'public'
--      AND table_name IN ('appointments','google_tokens')
--      AND grantee IN ('anon','authenticated')
--    GROUP BY 1,2;
--
--   -- ¿Hay transacciones viejas abiertas? Si las hay, esperar: un ALTER que
--   -- encola detrás de ellas bloquea también a todo el que llegue después.
--   SELECT pid, state, age(clock_timestamp(), xact_start) AS edad, query
--     FROM pg_stat_activity
--    WHERE xact_start IS NOT NULL AND state <> 'idle'
--    ORDER BY xact_start;
--
--   -- Respaldo: además de esto, tomar un snapshot del proyecto en el panel
--   -- de Supabase antes de aplicar el archivo B.
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Un ALTER que espera un lock encola detrás de sí a TODAS las consultas
-- siguientes, lecturas incluidas. Con timeout, en vez de tumbar la agenda,
-- esto falla limpio y se reintenta.
SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

-- ── google_tokens ───────────────────────────────────────────────────────────

ALTER TABLE public.google_tokens
  ADD COLUMN IF NOT EXISTS calendar_id text;

COMMENT ON COLUMN public.google_tokens.calendar_id IS
  'Calendario propio de Spinus del médico (calendar.app.created). NULL = aún no creado; lo crea conCalendarioSpinus en la primera operación.';

-- ── appointments: columnas ──────────────────────────────────────────────────
-- ADD COLUMN con DEFAULT constante no reescribe la tabla (PG 11+): el default
-- vive en el catálogo. Barato incluso con millones de renglones.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'spinus';

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS gcal_etag text;

COMMENT ON COLUMN public.appointments.origen IS
  'De qué lado nació la cita: spinus | google. Hasta la Rama 2 siempre spinus.';
COMMENT ON COLUMN public.appointments.gcal_etag IS
  'ETag del último evento que Spinus escribió en Google. Sin uso hasta la Rama 2.';

-- ── appointments: constraints ───────────────────────────────────────────────
-- NOT VALID + VALIDATE aparte: ADD CONSTRAINT normal escanea la tabla entera
-- bajo ACCESS EXCLUSIVE (bloquea lecturas Y escrituras). NOT VALID se aplica a
-- las escrituras NUEVAS de inmediato y aplaza sólo la comprobación de lo ya
-- existente; el VALIDATE posterior toma SHARE UPDATE EXCLUSIVE, que no bloquea
-- ni lectura ni escritura. Con decenas de renglones da igual; con millones es
-- la diferencia entre un parpadeo y una caída.
--
-- Ninguno de los dos CHECK puede fallar contra los datos actuales: `origen`
-- nace con DEFAULT constante, y el de gcal_sync_status es superconjunto
-- estricto del que sustituye.

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_origen_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_origen_check
  CHECK (origen = ANY (ARRAY['spinus'::text, 'google'::text]))
  NOT VALID;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_gcal_sync_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_gcal_sync_status_check
  CHECK (gcal_sync_status = ANY (ARRAY['synced'::text, 'pending'::text, 'failed'::text, 'unbound'::text]))
  NOT VALID;

COMMIT;

-- Fuera de la transacción: cada VALIDATE toma SHARE UPDATE EXCLUSIVE y deja
-- pasar lecturas y escrituras. Si alguno falla, el constraint se queda en
-- NOT VALID (sigue vigilando las escrituras nuevas) y hay datos viejos que
-- revisar antes de reintentar.
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_origen_check;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_gcal_sync_status_check;

-- ── POST-VUELO (correr y leer) ──────────────────────────────────────────────
--   SELECT conname, convalidated
--     FROM pg_constraint
--    WHERE conrelid = 'public.appointments'::regclass AND contype = 'c';
--   -- Se esperan las 3 (status, origen, gcal_sync_status) con convalidated = t
--
--   SELECT count(*) FILTER (WHERE origen <> 'spinus') AS origen_raro FROM public.appointments;
--   -- Se espera 0
