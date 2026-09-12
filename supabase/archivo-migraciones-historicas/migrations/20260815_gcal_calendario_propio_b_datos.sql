-- ============================================================================
-- PENDIENTE DE APLICAR — parte B de 2. La ejecuta Angel a mano.
-- ============================================================================
-- Calendario propio de Spinus en Google (Rama 1) — CORTE DE DATOS
--
-- ⚠️ ORDEN OBLIGATORIO. Este archivo va DESPUÉS de que el código nuevo esté
--    en producción. Aplicarlo antes deja al médico desconectado mientras el
--    código viejo sigue arriba: reconectaría contra el scope sensible viejo y
--    quedaría con un token que no puede crear calendarios y que la app ya no
--    vuelve a pedir, porque el renglón existe.
--
--    Runbook completo:
--      1. Snapshot del proyecto en el panel de Supabase.
--      2. Aplicar el archivo A.
--      3. Deploy del código nuevo. Verificar que carga la agenda.
--      4. (Opcional, IRREVERSIBLE si se salta) Limpiar de `primary` los
--         eventos que Spinus dejará huérfanos. Los nuevos scopes NO pueden
--         listar ni borrar nada de `primary`: si no se hace ahora, sólo queda
--         borrarlos a mano desde la interfaz de Google. La tabla de respaldo
--         que crea este archivo deja al menos la lista de ids.
--      5. (Opcional) Revocar el consentimiento viejo. Al borrar el renglón se
--         pierde el refresh_token y con él la única vía programática de
--         revocar: el permiso sensible seguiría listado en la cuenta Google
--         del médico hasta que él lo quite a mano en myaccount.google.com.
--      6. Aplicar ESTE archivo.
--      7. Avisar al médico: tiene que reconectar Google una vez. Las citas
--         creadas entre el paso 6 y su reconexión NO llegan a Google y nada
--         las reintenta después.
--
-- ── QUÉ HACE ────────────────────────────────────────────────────────────────
--   · Respalda el mapeo cita↔evento en un esquema NO expuesto por PostgREST.
--   · Suelta los google_event_id, que apuntan al `primary` que abandonamos.
--   · Crea el índice único que impide dos citas sobre un mismo evento.
--   · Borra los tokens viejos para forzar reconexión con los scopes nuevos.
--
--   Ninguna cita se borra. Se pierde una columna, no un renglón.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '5min';

-- ── Guarda de un solo disparo ───────────────────────────────────────────────
-- Sin esto, un replay meses después no encontraría los vínculos al `primary`
-- viejo: encontraría los del calendario NUEVO, vivos y correctos, y los
-- tiraría todos; y borraría tokens que funcionan. En silencio, sin un error.
-- La tabla de respaldo hace de testigo de que este archivo ya corrió.
DO $$
BEGIN
  IF to_regclass('respaldos.appointments_gcal_20260815') IS NOT NULL THEN
    RAISE EXCEPTION
      'Este archivo ya se aplicó (existe respaldos.appointments_gcal_20260815). '
      'Abortado para no desvincular citas vivas ni borrar tokens buenos.';
  END IF;
END $$;

-- ── Respaldo ────────────────────────────────────────────────────────────────
-- NO en `public`: Supabase concede por default a anon/authenticated sobre las
-- tablas nuevas de ese esquema y PostgREST lo expone entero. Un respaldo de
-- appointments ahí sería legible por cualquier médico de cualquier clínica.
CREATE SCHEMA IF NOT EXISTS respaldos;
REVOKE ALL ON SCHEMA respaldos FROM anon, authenticated;

CREATE TABLE respaldos.appointments_gcal_20260815 AS
SELECT id,
       clinica_id,
       medico_id,
       google_event_id,
       gcal_sync_status,
       start_time,
       now() AS respaldado_en
  FROM public.appointments
 WHERE google_event_id IS NOT NULL;

REVOKE ALL ON respaldos.appointments_gcal_20260815 FROM anon, authenticated;

COMMENT ON TABLE respaldos.appointments_gcal_20260815 IS
  'Mapeo cita↔evento del calendario primary, antes de soltarlo (Rama 1, 2026-08-15). Única forma de localizar los eventos huérfanos que quedan en el primary del médico.';

-- ── Soltar los vínculos muertos ─────────────────────────────────────────────
-- 'unbound', NO 'pending'. Estas citas tenían un evento y su vínculo se perdió
-- para siempre: es la definición literal de 'unbound'. 'pending' significa
-- "algo lo va a empujar a Google", y no existe ningún proceso que lo haga —
-- el campo se quedaría mintiendo, el índice parcial idx_appointments_gcal_sync
-- (WHERE status = 'pending') pasaría a cubrir la tabla entera, y el día que
-- la Rama 2 escriba el backfill obvio sobre 'pending' recrearía en Google
-- cada cita cancelada y cada consulta de hace dos años.
--
-- Va ANTES del índice único: si quedara algún duplicado histórico de
-- google_event_id, el CREATE INDEX fallaría.
UPDATE public.appointments
   SET google_event_id  = NULL,
       gcal_sync_status = 'unbound'
 WHERE google_event_id IS NOT NULL;

-- Variante, sólo si se decide que las citas futuras vuelvan a Google: dejar
-- el UPDATE de arriba tal cual y añadir después un segundo paso explícito que
-- marque 'pending' lo que de verdad se vaya a reempujar, con un backfill que
-- exista. Hoy no existe; marcarlas 'pending' sin él sólo ensucia el estado.
--   UPDATE public.appointments SET gcal_sync_status = 'pending'
--    WHERE gcal_sync_status = 'unbound' AND start_time > now() AND status <> 'cancelled';

-- ── Una cita por evento de Google ───────────────────────────────────────────
-- Con ámbito de clínica, no global: los ids de evento de Google son únicos por
-- calendario, no entre calendarios (un evento copiado, o la copia que le llega
-- a un invitado, conservan el id). Un único global haría que el import de la
-- Rama 2 en una clínica fallara por lo que hay en otra — y fallaría dentro de
-- after(), en background, donde el error se traga.
-- clinica_id y no medico_id: medico_id es nullable y en un índice único los
-- NULL son distintos entre sí, así que dos citas sin médico se colarían.
--
-- Sin CONCURRENTLY a propósito: toma SHARE (bloquea escrituras) durante la
-- construcción, que con este volumen es instantáneo, y a cambio el archivo
-- entero sigue siendo atómico. Si algún día se replayea sobre una base grande,
-- sacar esta sentencia de la transacción y usar:
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ... ;
-- que no puede ir dentro de un bloque de transacción y, si falla, deja un
-- índice INVALID que hay que dropear a mano.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_clinica_google_event_id_uniq
  ON public.appointments (clinica_id, google_event_id)
  WHERE google_event_id IS NOT NULL;

-- ── Forzar reconexión ───────────────────────────────────────────────────────
-- Los tokens actuales llevan el scope `calendar.events`, que no autoriza
-- calendars.insert (403). Son inservibles para el modelo nuevo. Sin RLS de por
-- medio: en el SQL editor esto corre como dueño de la tabla y borra los
-- renglones de todos los usuarios, que es lo que se busca.
DELETE FROM public.google_tokens;

COMMIT;

-- Las estadísticas de appointments cambiaron de golpe (google_event_id pasó a
-- ser todo NULL, el índice parcial de 'pending' se vació).
ANALYZE public.appointments;

-- ── POST-VUELO (correr y leer) ──────────────────────────────────────────────
--   SELECT count(*) FROM public.google_tokens;                      -- 0
--   SELECT count(*) FROM public.appointments WHERE google_event_id IS NOT NULL; -- 0
--   SELECT gcal_sync_status, count(*) FROM public.appointments GROUP BY 1;
--   -- Se esperan sólo 'unbound' (las migradas) y lo que ya hubiera de antes.
--   SELECT count(*) FROM respaldos.appointments_gcal_20260815;
--   -- Debe coincidir con el número de citas que tenían evento.
--
--   -- Después: el médico reconecta y se comprueba que se creó el calendario.
--   SELECT user_id, calendar_id IS NOT NULL AS tiene_calendario FROM public.google_tokens;
