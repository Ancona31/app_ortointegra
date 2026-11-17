-- ═══════════════════════════════════════════════════════════════════════
-- Agenda · tanda I, agente I5 (puntos 19 y 20 de Angel) — «Avisos» de la
-- clínica (lo que pasó sin que nadie de la clínica lo hiciera) y el
-- interruptor del correo a la clínica por cada reserva nueva
-- Rama: feature/agenda-v2-i5 · Escrita: 2026-11-17
-- Riesgo estimado: BAJO-MEDIO (una tabla nueva con RLS; cuatro disparadores
-- nuevos AFTER sobre tablas que ya existen y que sólo INSERTAN en la tabla
-- nueva; una columna nueva con DEFAULT constante en agenda_ajustes. Ninguna
-- policy, función, columna ni fila existente cambia).
-- ───────────────────────────────────────────────────────────────────────
-- ESTADO · LOCAL: APLICADA (2026-11-17); ver «APLICACIÓN LOCAL» al pie de esta cabecera.
-- ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR (después de toda la agenda v2:
--   B1, D1, D3, D11, E1 y E6).
--
-- ═══ EL PORQUÉ ═════════════════════════════════════════════════════════
-- Punto 19 (Angel, 2026-11-17): «"Avisos" registra, y conserva hasta que
-- alguien lo revisa: reserva nueva por enlace, cancelación hecha por el
-- paciente, cita reagendada por el paciente, evento nuevo de Google por
-- asignar, y empalme con Google. Cada uno lleva a su cita al pulsarlo. […]
-- Constrúyelo de forma que después se pueda mover a toda la app sin
-- rehacerlo.» Hasta hoy lo único parecido era el panel «Por confirmar»: las
-- canceladas por el paciente de las últimas 48 h (E8) y los empalmes de los
-- últimos 30 días (D11), calculados al vuelo y sin «revisado».
-- Punto 20: «Un correo a la clínica por cada reserva nueva, como opción en
-- la configuración, APAGADA de fábrica».
--
-- ═══ QUÉ CAMBIA ════════════════════════════════════════════════════════
-- public.avisos_clinica (TABLA NUEVA): un aviso por hecho, con su tipo, su
--   cita y su clínica; `revisado_en`/`revisado_por` vacíos hasta que alguien
--   del personal lo revisa (entonces deja de salir; la fila se conserva).
--   · FK a clinicas RESTRICT. SIN FK a appointments, a propósito y como
--     reserva_empalmes_google (D11): la semilla, las e2e y la limpieza de
--     scripts borran citas como postgres, y una FK RESTRICT bloquearía esos
--     borrados en la base compartida; la lectura cruza con appointments
--     (RLS incluida). `revisado_por` SIN FK: una FK a profiles (RESTRICT)
--     bloquearía dar de baja a quien revisó un aviso, y SET NULL dispararía
--     el normalizador de abajo; es atribución, como audit_log.user_id.
--   · Un solo aviso SIN REVISAR por (tipo, cita): índice único parcial y
--     `ON CONFLICT DO NOTHING` en los escritores. Un par nuevo de empalme
--     sobre la misma reserva no repite el aviso mientras siga sin revisar.
--   · RLS: SELECT y UPDATE sólo de la clínica de la sesión Y de citas que
--     quien mira ve (EXISTS sobre appointments con su RLS: el médico invitado
--     sólo los de sus citas, como cita_confirmaciones y cita_reagendos). Sin
--     recursión: la policy lee appointments, no avisos_clinica.
--   · Permisos: authenticated SELECT y UPDATE SÓLO de (revisado_en,
--     revisado_por); nadie más que el dueño (postgres) INSERTA o BORRA.
--     service_role nada (el servidor lee con la sesión).
--   · `aviso_clinica_revisar()` (BEFORE UPDATE, INVOKER): un aviso revisado
--     no se vuelve a tocar; al revisarlo, `revisado_en` = now() del servidor.
--     La policy exige `revisado_por = auth.uid()`.
-- Quién escribe (cuatro disparadores AFTER, SECURITY DEFINER de postgres,
--   que SÓLO insertan o reetiquetan en avisos_clinica; los que llaman son
--   las RPC de service_role de siempre, que no cambian):
--   · appointments AFTER INSERT con `reserva_enlace_id` → 'reserva_enlace'
--     (reservar_por_enlace, D3/seg1; la única que la rellena: el disparador
--     de seg protege las columnas reserva_*).
--   · appointments AFTER INSERT con `origen = 'google'`, sin paciente, sin
--     reserva, con hora y por venir → 'google_por_asignar'
--     (gcal_importar_evento, C2; el criterio de `cita_asignacion_google()`). El agente I3
--     añade el botón «¿No es una cita?»; marcarlo como no-cita debería
--     marcar también el aviso revisado (lo cablea el integrador).
--   · cita_confirmaciones AFTER UPDATE OF respuesta a 'cancelo' →
--     'cancelacion_paciente' (cita_confirmacion_responder, E1).
--   · cita_reagendos AFTER INSERT → 'reagendado_paciente' sobre la cita
--     NUEVA (reagendar_por_enlace, E6): reetiqueta el 'reserva_enlace' que
--     acaba de dejar la inserción de esa misma cita en la misma transacción.
--   · reserva_empalmes_google AFTER INSERT → 'empalme_google' sobre la
--     reserva (reserva_empalmes_registrar, D11). D11 no cambia.
-- Arrastre: los empalmes de los últimos 30 días y las cancelaciones del
--   paciente de las últimas 48 h que ya había (las que el panel enseñaba)
--   entran como avisos sin revisar. En producción no hay ninguno.
-- agenda_ajustes.correo_reserva_clinica boolean NOT NULL DEFAULT false
--   (columna NUEVA): el correo a la clínica por cada reserva nueva por
--   enlace, APAGADO de fábrica. La escribe el administrador como el resto de
--   la fila (policy de UPDATE de B1; el disparador de B1 no la protege).
--
-- ═══ APLICACIÓN ════════════════════════════════════════════════════════
-- EJECUTAR EN EL SQL EDITOR DE SUPABASE, DE UNA SOLA VEZ, COMPLETO.
-- Requiere B1, D1 (reserva_enlace_id), C2 (origen), D11, E1 y E6. PG ≥ 14.
-- Bloqueos (lock_timeout 5 s): ALTER TABLE agenda_ajustes ADD COLUMN →
--   ACCESS EXCLUSIVE un instante (sin reescritura); CREATE TRIGGER → SHARE
--   ROW EXCLUSIVE un instante sobre appointments, cita_confirmaciones,
--   cita_reagendos y reserva_empalmes_google (bloquea escrituras, no
--   lecturas); CREATE TABLE con FK → SHARE ROW EXCLUSIVE sobre clinicas.
-- Orden respecto al código: cualquiera es seguro.
--   · Código nuevo, base sin esto: la campana enseña lo de antes (las
--     canceladas y los empalmes calculados al vuelo); el interruptor del
--     correo sale «no disponible» y no se manda ningún correo a la clínica.
--   · Código viejo, base con esto: los avisos se acumulan sin que nadie los
--     vea; el correo a la clínica no existe.
-- Alcance de los roles:
--   gana — authenticated: leer los avisos de su clínica y de las citas que
--          ve, y marcarlos revisados. Administrador: escribir la columna
--          nueva de SU fila de ajustes.
--   pierde — nada.
-- Contrato con spinus-consola: tabla y columna nuevas; nada existente cambia.
--
-- ═══ VUELTA ATRÁS ══════════════════════════════════════════════════════
--   DROP TRIGGER IF EXISTS trg_appointments_aviso_clinica ON public.appointments;
--   DROP TRIGGER IF EXISTS trg_cita_confirmaciones_aviso_clinica ON public.cita_confirmaciones;
--   DROP TRIGGER IF EXISTS trg_cita_reagendos_aviso_clinica ON public.cita_reagendos;
--   DROP TRIGGER IF EXISTS trg_reserva_empalmes_aviso_clinica ON public.reserva_empalmes_google;
--   DROP TABLE IF EXISTS public.avisos_clinica;  -- (respaldar antes si se quiere el registro)
--   DROP FUNCTION IF EXISTS public.aviso_clinica_de_cita(), public.aviso_clinica_de_respuesta(),
--     public.aviso_clinica_de_reagendo(), public.aviso_clinica_de_empalme(), public.aviso_clinica_revisar();
--   ALTER TABLE public.agenda_ajustes DROP COLUMN IF EXISTS correo_reserva_clinica;
--
-- ═══ AUDITORÍA ═════════════════════════════════════════════════════════
-- Independiente (subagente, 2026-11-17), contra AUDITORIA-MIGRACIONES.md y
-- CLAUDE.md, sólo lectura en la base local. Veredicto: APTA CON
-- OBSERVACIONES, sin bloqueantes. Comprobado: sin recursión (las policies
-- leen appointments, no avisos_clinica, y filtran por clinica_id); FK
-- RESTRICT a clinicas y ninguna otra; las cinco funciones con search_path
-- vacío, revoke/grant explícitos y sin EXECUTE a PUBLIC; authenticated sólo
-- SELECT y UPDATE de (revisado_en, revisado_por); 'cancelo' es el valor que
-- escribe cita_confirmacion_responder; los AFTER usan ON CONFLICT DO NOTHING
-- sobre columnas NOT NULL y no pueden romper las RPC; las policies de
-- agenda_ajustes intactas; sin efecto en la consola.
-- Observaciones y qué se hizo:
--   · (media) el WHEN de Google no pedía «por venir» ni «sin reserva»: un
--     evento pasado de la primera sincronización dejaba un aviso que no lleva
--     a nada por asignar. CORREGIDO: el WHEN usa el criterio de
--     cita_asignacion_google() (I3) con columnas que existen sin I3; caso
--     nuevo en la prueba SQL (g5), en rojo con el WHEN viejo.
--   · (baja) reaplicar el archivo revivía avisos ya revisados dentro de las
--     ventanas del arrastre. CORREGIDO: NOT EXISTS sobre cualquier aviso del
--     par.
--   · (baja) el pre-vuelo comprueba que existan las tablas de D11, E1 y E6,
--     no sus columnas: si faltase una, aborta a mitad pero el BEGIN lo
--     revierte entero. Se deja así (como D11).
--
-- ═══ APLICACIÓN LOCAL ══════════════════════════════════════════════════
-- 2026-11-17, base local (docker), dentro del candado de las e2e: en seco
-- (ROLLBACK) y dos pasadas seguidas con el veredicto igual (idempotente);
-- registrada en supabase_migrations.schema_migrations. Reaplicada tras la
-- auditoría con el WHEN corregido. supabase/pruebas-sql/i5_avisos_clinica.sql
-- en verde y cada mutación (policy sin EXISTS, WHEN sin todo el día ni «por
-- venir», reagendo que inserta, sin normalizador, UPDATE de tabla) en rojo.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1 · Pre-vuelo. Aborta ANTES de cambiar nada.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_tipo regtype;
  v_nulo boolean;
  v_def  text;
  v_n    integer;
BEGIN
  IF to_regclass('public.agenda_ajustes') IS NULL OR to_regclass('public.cita_confirmaciones') IS NULL
     OR to_regclass('public.cita_reagendos') IS NULL OR to_regclass('public.reserva_empalmes_google') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: faltan tablas de la agenda v2 (B1, E1, E6 o D11).';
  END IF;
  SELECT count(*) INTO v_n FROM pg_attribute
   WHERE attrelid = 'public.appointments'::regclass AND NOT attisdropped
     AND attname IN ('reserva_enlace_id', 'origen', 'paciente_id', 'all_day', 'clinica_id');
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: a appointments le faltan columnas de D1/C2 (encontradas % de 5).', v_n;
  END IF;
  IF to_regprocedure('public.get_clinica_id()') IS NULL OR to_regprocedure('public.log_tabla_change()') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta get_clinica_id() o log_tabla_change().';
  END IF;
  IF NOT pg_has_role(current_user, (SELECT relowner FROM pg_class WHERE oid = 'public.agenda_ajustes'::regclass), 'USAGE') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: el rol % no es dueño de public.agenda_ajustes.', current_user;
  END IF;
  -- Replay: la columna, si existe, es ÉSTA.
  SELECT a.atttypid::regtype, NOT a.attnotnull, pg_get_expr(d.adbin, d.adrelid) INTO v_tipo, v_nulo, v_def
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = 'public.agenda_ajustes'::regclass AND a.attname = 'correo_reserva_clinica' AND NOT a.attisdropped;
  IF FOUND AND (v_tipo IS DISTINCT FROM 'boolean'::regtype OR v_nulo OR v_def IS DISTINCT FROM 'false') THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: agenda_ajustes.correo_reserva_clinica ya existe con otra forma.';
  END IF;
  -- Replay: la tabla, si existe, tiene exactamente estas columnas y tipos.
  IF to_regclass('public.avisos_clinica') IS NOT NULL AND (
       SELECT count(*) FROM pg_attribute a
        WHERE a.attrelid = to_regclass('public.avisos_clinica') AND a.attnum > 0 AND NOT a.attisdropped
          AND (a.attname, a.atttypid::regtype) IN (('id', 'uuid'::regtype), ('clinica_id', 'uuid'::regtype),
              ('tipo', 'text'::regtype), ('cita_id', 'uuid'::regtype), ('creado_en', 'timestamptz'::regtype),
              ('revisado_en', 'timestamptz'::regtype), ('revisado_por', 'uuid'::regtype))) <> 7 THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.avisos_clinica existe con otra forma.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = to_regclass('public.avisos_clinica') AND attnum > 0 AND NOT attisdropped) NOT IN (0, 7) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: public.avisos_clinica tiene columnas de más.';
  END IF;
  -- Replay: las cinco funciones, si existen, son las de esta migración (md5 de prosrc).
  FOR v_def, v_tipo IN
    SELECT f.md5, NULL::regtype FROM (VALUES
      ('public.aviso_clinica_revisar()', '32733e604e44105e83cf4f65355f18fa'),
      ('public.aviso_clinica_de_cita()', '148b5b16b596b1ac666c70c75c539704'),
      ('public.aviso_clinica_de_respuesta()', '93989cb520bec0b9e621475cd6355701'),
      ('public.aviso_clinica_de_reagendo()', 'e62021c47e4487f5d05a7ca42c00899b'),
      ('public.aviso_clinica_de_empalme()', '498a7a6ac6252e2ce4801853debac68a')) AS e(firma, esperado)
    CROSS JOIN LATERAL (SELECT md5(p.prosrc) AS md5 FROM pg_proc p WHERE p.oid = to_regprocedure(e.firma)) f
    WHERE f.md5 <> e.esperado
  LOOP
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: una función aviso_clinica_* ya existe con otro cuerpo (md5 %).', v_def;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2 · El interruptor del correo a la clínica (punto 20).
-- ---------------------------------------------------------------------
ALTER TABLE public.agenda_ajustes ADD COLUMN IF NOT EXISTS correo_reserva_clinica boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agenda_ajustes.correo_reserva_clinica IS
  'Tanda I (punto 20): correo a los administradores de la clínica por cada reserva nueva por enlace (nombre, fecha, hora, médico y consultorio; nada clínico). APAGADO de fábrica. Lo cambia el administrador desde la configuración (policy de UPDATE de B1).';

-- ---------------------------------------------------------------------
-- 3 · La tabla, sus permisos y su RLS.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.avisos_clinica (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  clinica_id    uuid        NOT NULL,
  tipo          text        NOT NULL,
  cita_id       uuid        NOT NULL,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  revisado_en   timestamptz,
  revisado_por  uuid,
  CONSTRAINT avisos_clinica_pkey PRIMARY KEY (id),
  CONSTRAINT avisos_clinica_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  CONSTRAINT avisos_clinica_tipo_check CHECK (tipo IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente',
                                                       'google_por_asignar', 'empalme_google')),
  CONSTRAINT avisos_clinica_revisado_check CHECK (revisado_por IS NULL OR revisado_en IS NOT NULL)
);

-- Un solo aviso SIN REVISAR por tipo y cita (los escritores usan ON CONFLICT con este predicado).
CREATE UNIQUE INDEX IF NOT EXISTS avisos_clinica_pendiente_key ON public.avisos_clinica (tipo, cita_id)
  WHERE revisado_en IS NULL;
-- La lectura de la campana: los sin revisar de una clínica, los más nuevos primero.
CREATE INDEX IF NOT EXISTS avisos_clinica_pendientes_idx ON public.avisos_clinica (clinica_id, creado_en DESC)
  WHERE revisado_en IS NULL;
-- La FK RESTRICT a clinicas (borrar una clínica busca aquí).
CREATE INDEX IF NOT EXISTS avisos_clinica_clinica_idx ON public.avisos_clinica (clinica_id);

ALTER TABLE public.avisos_clinica ENABLE ROW LEVEL SECURITY;
-- Los privilegios por omisión de Supabase dan ALL a anon, authenticated y service_role.
REVOKE ALL ON TABLE public.avisos_clinica FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.avisos_clinica TO authenticated;
GRANT UPDATE (revisado_en, revisado_por) ON TABLE public.avisos_clinica TO authenticated;

-- Sin recursión: lee appointments, no avisos_clinica; el EXISTS corre bajo la
-- RLS de appointments de quien pregunta (el invitado, sólo las suyas).
DROP POLICY IF EXISTS avisos_clinica_select ON public.avisos_clinica;
CREATE POLICY avisos_clinica_select ON public.avisos_clinica FOR SELECT TO authenticated
  USING (clinica_id = public.get_clinica_id()
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = avisos_clinica.cita_id AND a.clinica_id = public.get_clinica_id()));
DROP POLICY IF EXISTS avisos_clinica_update ON public.avisos_clinica;
CREATE POLICY avisos_clinica_update ON public.avisos_clinica FOR UPDATE TO authenticated
  USING (clinica_id = public.get_clinica_id() AND revisado_en IS NULL
         AND EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.id = avisos_clinica.cita_id AND a.clinica_id = public.get_clinica_id()))
  WITH CHECK (clinica_id = public.get_clinica_id() AND revisado_por = auth.uid());

COMMENT ON TABLE public.avisos_clinica IS
  'Tanda I (punto 19): lo que pasó en la agenda sin que nadie de la clínica lo hiciera (reserva por enlace, cancelación y reagendado del paciente, evento de Google por asignar, empalme con Google). Se conserva hasta que alguien del personal lo revisa (revisado_en/revisado_por) y después queda como registro. Sólo la escriben los disparadores aviso_clinica_de_* (dueño postgres); el personal sólo marca revisado. Sin FK a appointments a propósito (como reserva_empalmes_google): el lector cruza con appointments.';

-- ---------------------------------------------------------------------
-- 4 · Revisar: una sola vez, con la hora del servidor.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aviso_clinica_revisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF OLD.revisado_en IS NOT NULL THEN
    NEW.revisado_en := OLD.revisado_en;
    NEW.revisado_por := OLD.revisado_por;
  ELSIF NEW.revisado_en IS NOT NULL THEN
    NEW.revisado_en := now();
  END IF;
  RETURN NEW;
END
$fn$;

-- ---------------------------------------------------------------------
-- 5 · Los escritores. SECURITY DEFINER (dueño postgres): sólo insertan o
--     reetiquetan en avisos_clinica con lo que trae la fila del disparador;
--     así no dependen de los permisos de quien llama (service_role en las
--     RPC de siempre). RETURNS trigger: no se pueden llamar por RPC.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aviso_clinica_de_cita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
  VALUES (NEW.clinica_id, CASE WHEN NEW.reserva_enlace_id IS NOT NULL THEN 'reserva_enlace' ELSE 'google_por_asignar' END, NEW.id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
  RETURN NULL;
END
$fn$;

CREATE OR REPLACE FUNCTION public.aviso_clinica_de_respuesta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
  VALUES (NEW.clinica_id, 'cancelacion_paciente', NEW.appointment_id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
  RETURN NULL;
END
$fn$;

-- E6 reserva la cita nueva con reservar_por_enlace (que deja su aviso
-- 'reserva_enlace') y DESPUÉS anota cita_reagendos, en la misma transacción:
-- ese aviso pasa a ser el del reagendado (uno por hecho, no dos).
CREATE OR REPLACE FUNCTION public.aviso_clinica_de_reagendo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  UPDATE public.avisos_clinica SET tipo = 'reagendado_paciente'
   WHERE cita_id = NEW.cita_nueva_id AND clinica_id = NEW.clinica_id
     AND tipo = 'reserva_enlace' AND revisado_en IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
    VALUES (NEW.clinica_id, 'reagendado_paciente', NEW.cita_nueva_id)
    ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
  END IF;
  RETURN NULL;
END
$fn$;

CREATE OR REPLACE FUNCTION public.aviso_clinica_de_empalme()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id)
  VALUES (NEW.clinica_id, 'empalme_google', NEW.cita_reserva_id)
  ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
  RETURN NULL;
END
$fn$;

-- Permisos de funciones (CLAUDE.md), escritos aunque sean RETURNS trigger
-- (no se pueden llamar por RPC; lo que cuenta es quién dispara el disparador).
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_revisar() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_revisar() TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_cita() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_cita() TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_respuesta() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_respuesta() TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_reagendo() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_reagendo() TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.aviso_clinica_de_empalme() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.aviso_clinica_de_empalme() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6 · Los disparadores.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_avisos_clinica_revisar
  BEFORE UPDATE ON public.avisos_clinica
  FOR EACH ROW EXECUTE FUNCTION public.aviso_clinica_revisar();
CREATE OR REPLACE TRIGGER audit_avisos_clinica
  AFTER INSERT OR UPDATE OR DELETE ON public.avisos_clinica
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();
CREATE OR REPLACE TRIGGER trg_appointments_aviso_clinica
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  -- Google: el MISMO criterio con el que `cita_asignacion_google()` (I3) la
  -- marca por asignar —sin paciente, sin reserva, con hora y por venir—, con
  -- columnas que existen sin I3: un evento PASADO que trae la primera
  -- sincronización no deja aviso (auditoría I5, hallazgo 1).
  WHEN (NEW.reserva_enlace_id IS NOT NULL
        OR (NEW.origen = 'google' AND NEW.paciente_id IS NULL AND NEW.reserva_canal IS NULL
            AND NEW.all_day IS NOT TRUE AND NEW.end_time > now()))
  EXECUTE FUNCTION public.aviso_clinica_de_cita();
CREATE OR REPLACE TRIGGER trg_cita_confirmaciones_aviso_clinica
  AFTER UPDATE OF respuesta ON public.cita_confirmaciones
  FOR EACH ROW
  WHEN (NEW.respuesta = 'cancelo' AND OLD.respuesta IS DISTINCT FROM 'cancelo')
  EXECUTE FUNCTION public.aviso_clinica_de_respuesta();
CREATE OR REPLACE TRIGGER trg_cita_reagendos_aviso_clinica
  AFTER INSERT ON public.cita_reagendos
  FOR EACH ROW EXECUTE FUNCTION public.aviso_clinica_de_reagendo();
CREATE OR REPLACE TRIGGER trg_reserva_empalmes_aviso_clinica
  AFTER INSERT ON public.reserva_empalmes_google
  FOR EACH ROW EXECUTE FUNCTION public.aviso_clinica_de_empalme();

-- ---------------------------------------------------------------------
-- 7 · Arrastre: lo que el panel enseñaba hoy entra como aviso sin revisar.
--     Idempotente: la segunda pasada no añade nada, y tampoco revive uno que
--     alguien ya revisó (NOT EXISTS sobre cualquier aviso de ese par).
-- ---------------------------------------------------------------------
INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id, creado_en)
SELECT e.clinica_id, 'empalme_google', e.cita_reserva_id, max(e.detectado_en)
  FROM public.reserva_empalmes_google e
 WHERE e.detectado_en > now() - interval '30 days'
   AND NOT EXISTS (SELECT 1 FROM public.avisos_clinica a WHERE a.tipo = 'empalme_google' AND a.cita_id = e.cita_reserva_id)
 GROUP BY e.clinica_id, e.cita_reserva_id
ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;
INSERT INTO public.avisos_clinica (clinica_id, tipo, cita_id, creado_en)
SELECT c.clinica_id, 'cancelacion_paciente', c.appointment_id, max(c.respondido_en)
  FROM public.cita_confirmaciones c
 WHERE c.respuesta = 'cancelo' AND c.respondido_en > now() - interval '48 hours'
   AND NOT EXISTS (SELECT 1 FROM public.avisos_clinica a WHERE a.tipo = 'cancelacion_paciente' AND a.cita_id = c.appointment_id)
 GROUP BY c.clinica_id, c.appointment_id
ON CONFLICT (tipo, cita_id) WHERE revisado_en IS NULL DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------
-- 8 · Veredicto en la rejilla. UN SOLO SELECT, y nada detrás.
-- ---------------------------------------------------------------------
SELECT t.n, t.comprobacion, t.valor, t.esperado,
       CASE WHEN t.esperado IS NULL THEN 'INFO' WHEN t.valor = t.esperado THEN 'OK' ELSE 'REVISAR' END AS estado
FROM (
  SELECT 1 AS n, 'correo_reserva_clinica: tipo / NOT NULL / default' AS comprobacion,
         coalesce((SELECT format_type(a.atttypid, a.atttypmod) || ' / ' || a.attnotnull::text || ' / ' || pg_get_expr(d.adbin, d.adrelid)
                     FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                    WHERE a.attrelid = 'public.agenda_ajustes'::regclass AND a.attname = 'correo_reserva_clinica' AND NOT a.attisdropped), 'AUSENTE') AS valor,
         'boolean / true / false' AS esperado
  UNION ALL
  SELECT 2, 'avisos_clinica existe / RLS activa',
         coalesce((SELECT 'sí / ' || relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.avisos_clinica')), 'AUSENTE'),
         'sí / true'
  UNION ALL
  SELECT 3, 'privilegios de tabla anon / authenticated / service_role',
         coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'avisos_clinica' AND grantee = 'anon'), '-')
         || ' / ' || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'avisos_clinica' AND grantee = 'authenticated'), '-')
         || ' / ' || coalesce((SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
                    WHERE table_schema = 'public' AND table_name = 'avisos_clinica' AND grantee = 'service_role'), '-'),
         '- / SELECT / -'
  UNION ALL
  SELECT 4, 'UPDATE de columna de authenticated',
         coalesce((SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges
                    WHERE table_schema = 'public' AND table_name = 'avisos_clinica' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'), '-'),
         'revisado_en,revisado_por'
  UNION ALL
  SELECT 5, 'policies',
         (SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avisos_clinica'),
         'avisos_clinica_select:SELECT,avisos_clinica_update:UPDATE'
  UNION ALL
  SELECT 6, 'FK a clinicas RESTRICT (y ninguna otra FK)',
         coalesce((SELECT string_agg(conname || ':' || confdeltype::text, ',') FROM pg_constraint
                    WHERE conrelid = to_regclass('public.avisos_clinica') AND contype = 'f'), 'NINGUNA'),
         'avisos_clinica_clinica_id_fkey:r'
  UNION ALL
  SELECT 7, 'funciones nuevas: DEFINER (de 4 escritores) / INVOKER (revisar), search_path vacío',
         (SELECT count(*) FILTER (WHERE p.prosecdef)::text || ' / ' || count(*) FILTER (WHERE NOT p.prosecdef)::text
            FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.aviso_clinica_de_cita()'), to_regprocedure('public.aviso_clinica_de_respuesta()'),
                           to_regprocedure('public.aviso_clinica_de_reagendo()'), to_regprocedure('public.aviso_clinica_de_empalme()'),
                           to_regprocedure('public.aviso_clinica_revisar()'))
             AND p.proconfig @> ARRAY['search_path=""']),
         '4 / 1'
  UNION ALL
  SELECT 8, 'ninguna de las 5 con EXECUTE a PUBLIC',
         (SELECT count(*)::text FROM pg_proc p
           WHERE p.oid IN (to_regprocedure('public.aviso_clinica_de_cita()'), to_regprocedure('public.aviso_clinica_de_respuesta()'),
                           to_regprocedure('public.aviso_clinica_de_reagendo()'), to_regprocedure('public.aviso_clinica_de_empalme()'),
                           to_regprocedure('public.aviso_clinica_revisar()'))
             AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                              WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE')),
         '5'
  UNION ALL
  SELECT 9, 'disparadores nuevos',
         (SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_trigger
           WHERE NOT tgisinternal AND tgname IN ('trg_avisos_clinica_revisar', 'audit_avisos_clinica', 'trg_appointments_aviso_clinica',
                                                 'trg_cita_confirmaciones_aviso_clinica', 'trg_cita_reagendos_aviso_clinica',
                                                 'trg_reserva_empalmes_aviso_clinica')),
         'audit_avisos_clinica,trg_appointments_aviso_clinica,trg_avisos_clinica_revisar,trg_cita_confirmaciones_aviso_clinica,trg_cita_reagendos_aviso_clinica,trg_reserva_empalmes_aviso_clinica'
  UNION ALL
  SELECT 10, 'policies de agenda_ajustes, intactas',
         coalesce((SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agenda_ajustes'), 'NINGUNA'),
         'agenda_ajustes_insert,agenda_ajustes_select,agenda_ajustes_update'
  UNION ALL
  SELECT 11, 'avisos sin revisar (arrastre incluido)',
         (SELECT count(*)::text FROM public.avisos_clinica WHERE revisado_en IS NULL),
         NULL
) t
ORDER BY t.n;
