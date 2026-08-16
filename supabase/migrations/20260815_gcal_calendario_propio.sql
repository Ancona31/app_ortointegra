-- ============================================================================
-- PENDIENTE DE APLICAR — la ejecuta Angel a mano
-- ============================================================================
-- Calendario propio de Spinus en Google (Rama 1)
--
-- ── POR QUÉ ─────────────────────────────────────────────────────────────────
--
-- Hoy la app pide el scope `calendar.events`, que Google clasifica como
-- sensible: obliga a verificación, limita a 100 usuarios de por vida y enseña
-- la pantalla de advertencia de app no verificada. Los eventos se escriben
-- además en el calendario `primary` del médico, revueltos con su vida
-- personal.
--
-- La salida es un calendario dedicado que la propia app crea y posee, con dos
-- scopes NO sensibles: `calendar.app.created` (CRUD sólo en calendarios que la
-- app creó) y `calendar.events.freebusy` (disponibilidad de `primary`, sin
-- títulos ni detalles).
--
-- Este archivo prepara el esquema para esa migración.
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
--   gcal_sync_status 'unbound'   Estado nuevo: el evento murió del lado de
--                                Google (el médico borró el calendario). La
--                                cita se conserva; lo que se pierde es su
--                                vínculo con Google.
--
--   pacientes.alta_rapida        Rama 3, entra ahora por lo mismo.
--
-- ── LO QUE SE LIMPIA Y POR QUÉ ──────────────────────────────────────────────
--
-- Los `google_event_id` existentes apuntan a eventos del calendario `primary`,
-- que abandonamos: quedan colgados. Se ponen en null ANTES de crear el índice
-- único (si no, cualquier duplicado histórico haría fallar el CREATE INDEX).
-- Ninguna cita se borra.
--
-- Los tokens actuales se emitieron con el scope viejo y NO pueden crear
-- calendarios. Se borran para forzar reconexión: sin esto, cada médico
-- conectado arrastraría un token que falla en `calendars.insert` sin
-- diagnóstico claro. Tras aplicar, cada médico vuelve a conectar Google
-- una vez.
-- ============================================================================

-- Dónde vive el calendario de Spinus de cada médico
ALTER TABLE public.google_tokens
  ADD COLUMN IF NOT EXISTS calendar_id text;

-- De qué lado nació la cita
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'spinus';
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_origen_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_origen_check
  CHECK (origen = ANY (ARRAY['spinus'::text, 'google'::text]));

-- Qué fue lo último que Spinus escribió en Google (se usa hasta la Rama 2,
-- pero la columna entra ahora para no hacer dos migraciones)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS gcal_etag text;

-- Nuevo estado: el evento murió del lado de Google
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_gcal_sync_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_gcal_sync_status_check
  CHECK (gcal_sync_status = ANY (ARRAY['synced'::text, 'pending'::text, 'failed'::text, 'unbound'::text]));

-- Los google_event_id existentes apuntan al calendario `primary`, que vamos a
-- abandonar. Quedan colgados. Se limpian ANTES de crear el índice único.
UPDATE public.appointments
   SET google_event_id = NULL,
       gcal_sync_status = 'pending'
 WHERE google_event_id IS NOT NULL;

-- Una cita por evento de Google. La red contra duplicados.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_google_event_id_uniq
  ON public.appointments (google_event_id)
  WHERE google_event_id IS NOT NULL;

-- Los tokens actuales se emitieron con el scope viejo y no pueden crear
-- calendarios. Hay que forzar reconexión.
DELETE FROM public.google_tokens;

-- Rama 3, pero entra ahora por lo mismo
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS alta_rapida boolean NOT NULL DEFAULT false;
